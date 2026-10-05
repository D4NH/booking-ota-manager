import { ref } from 'vue';

export interface DeleteSheetRowOptions {
    sheetName?: string;
    calendarId?: string;
    calendarEventId?: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const google: any;

const TOKEN_KEY = 'gdrive_token';
const EXPIRY_KEY = 'gdrive_token_expires_at';

function isTokenValid(): boolean {
    const token = localStorage.getItem(TOKEN_KEY);
    const expiresAt = Number(localStorage.getItem(EXPIRY_KEY)) || 0;
    return Boolean(token && Date.now() < expiresAt - 60_000);
}

const accessToken = ref<string | null>(isTokenValid() ? localStorage.getItem(TOKEN_KEY) : null);
const isAuthenticated = ref<boolean>(isTokenValid());
let activeAuthPromise: Promise<string> | null = null;

const inFlightRequests = new Map<string, Promise<any>>();

const MAX_CONCURRENT_REQUESTS = 3;
let activeRequestCount = 0;
const requestQueue: (() => void)[] = [];

function acquireRequestSlot(): Promise<void> {
    if (activeRequestCount < MAX_CONCURRENT_REQUESTS) {
        activeRequestCount++;
        return Promise.resolve();
    }
    return new Promise((resolve) => {
        requestQueue.push(() => {
            activeRequestCount++;
            resolve();
        });
    });
}
function releaseRequestSlot(): void {
    activeRequestCount--;
    if (requestQueue.length > 0) {
        const next = requestQueue.shift();
        if (next) next();
    }
}
function loadGoogleSdk(): Promise<void> {
    return new Promise((resolve, reject) => {
        if (typeof google !== 'undefined' && google?.accounts?.oauth2) {
            resolve();
            return;
        }

        const scriptUrl = 'https://accounts.google.com/gsi/client';
        const existing = document.querySelector<HTMLScriptElement>(`script[src="${scriptUrl}"]`);

        if (existing) {
            existing.addEventListener('load', () => resolve());
            existing.addEventListener('error', () =>
                reject(new Error('Google SDK blocked by tracking protection or ad-blocker.'))
            );
            return;
        }

        const script = document.createElement('script');
        script.src = scriptUrl;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () =>
            reject(new Error('Google SDK blocked by tracking protection or ad-blocker.'));

        document.head.appendChild(script);
    });
}

if (typeof window !== 'undefined') {
    loadGoogleSdk().catch(() => {});
}

async function wait(ms: number): Promise<void> {
    return new Promise((res) => setTimeout(res, ms));
}
export function useGoogleSheets() {
    function logout(): void {
        accessToken.value = null;
        isAuthenticated.value = false;
        activeAuthPromise = null;
        inFlightRequests.clear();
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(EXPIRY_KEY);
    }

    function refreshAuthStatus(): boolean {
        const valid = isTokenValid();
        if (!valid && isAuthenticated.value) {
            accessToken.value = null;
            isAuthenticated.value = false;
        } else if (valid && !isAuthenticated.value) {
            accessToken.value = localStorage.getItem(TOKEN_KEY);
            isAuthenticated.value = true;
        }
        return valid;
    }

    async function initAuth(prompt: 'none' | 'select_account' = 'select_account'): Promise<string> {
        await loadGoogleSdk();

        return new Promise((resolve, reject) => {
            if (typeof google === 'undefined' || !google?.accounts?.oauth2) {
                reject(new Error('Google Accounts Identity Services SDK not available.'));
                return;
            }

            const client = google.accounts.oauth2.initTokenClient({
                client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
                scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/calendar.events',
                callback: (response: any) => {
                    if (response.error) {
                        if (prompt === 'none') {
                            // Silent token renewal failed, prompt user next
                            logout();
                        }
                        reject(new Error(response.error_description || response.error));
                        return;
                    }

                    const expiresInSec = Number(response.expires_in) || 3599;
                    const expiresAt = Date.now() + expiresInSec * 1000;

                    accessToken.value = response.access_token;
                    isAuthenticated.value = true;
                    localStorage.setItem(TOKEN_KEY, response.access_token);
                    localStorage.setItem(EXPIRY_KEY, String(expiresAt));

                    resolve(response.access_token);
                },
            });

            // If prompt is 'none', attempt silent renewal without popup window
            client.requestAccessToken({ prompt: prompt === 'none' ? '' : 'select_account' });
        });
    }

    async function ensureAuth(): Promise<string> {
        if (refreshAuthStatus() && accessToken.value) {
            return accessToken.value;
        }

        if (activeAuthPromise) return activeAuthPromise;

        activeAuthPromise = initAuth('none')
            .catch(() => initAuth('select_account'))
            .finally(() => {
                activeAuthPromise = null;
            });

        return activeAuthPromise;
    }

    async function fetchWithAuth(
        url: string,
        options: RequestInit = {},
        maxRetries = 3
    ): Promise<Response> {
        await acquireRequestSlot();

        try {
            let token = await ensureAuth();

            for (let attempt = 0; attempt <= maxRetries; attempt++) {
                const res = await fetch(url, {
                    ...options,
                    headers: {
                        ...options.headers,
                        Authorization: `Bearer ${token}`,
                    },
                });

                // 401 Token Expired: Renew silently
                if (res.status === 401) {
                    token = await initAuth('select_account');
                    continue;
                }

                // 429 Rate Limit or 503 Server Busy: Exponential Backoff with Jitter
                if ((res.status === 429 || res.status === 503) && attempt < maxRetries) {
                    const backoffMs = Math.pow(2, attempt) * 1000 + Math.random() * 800;
                    console.warn(
                        `[Google API ${res.status}] Rate limit reached. Backing off for ${Math.round(backoffMs)}ms (retry ${attempt + 1}/${maxRetries})...`
                    );
                    await wait(backoffMs);
                    continue;
                }

                return res;
            }

            throw new Error('Google API rate limit exceeded maximum backoff retries.');
        } finally {
            releaseRequestSlot();
        }
    }

    function cleanGoogleCalendarEventId(rawId: string): string {
        if (!rawId) return '';
        let clean = rawId.trim();
        if (clean.includes('@')) clean = clean.split('@')[0] || '';
        if (clean.includes(':')) clean = clean.split(':')[0] || '';
        return clean.trim();
    }

    async function createCalendarEvent(
        calendarId: string,
        summary: string,
        checkIn: string,
        checkOut: string,
        description?: string
    ): Promise<string> {
        if (!calendarId) return '';
        const encodedCalId = encodeURIComponent(calendarId);
        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodedCalId}/events`;

        const res = await fetchWithAuth(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                summary,
                description: description || '',
                start: { date: checkIn },
                end: { date: checkOut },
            }),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => null);
            console.warn('Failed to create calendar event:', err);
            return '';
        }

        const data = await res.json();
        return cleanGoogleCalendarEventId(data.id || '');
    }

    async function updateCalendarEventSummary(
        calendarId: string,
        eventId: string,
        newSummary: string,
        dates?: { checkIn: string; checkOut: string },
        newDescription?: string
    ): Promise<void> {
        const cleanId = cleanGoogleCalendarEventId(eventId);
        if (!cleanId || !calendarId) return;

        const encodedCalId = encodeURIComponent(calendarId);
        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodedCalId}/events/${cleanId}`;

        const payload: Record<string, any> = { summary: newSummary };
        if (newDescription !== undefined) payload.description = newDescription;
        if (dates?.checkIn && dates?.checkOut) {
            payload.start = { date: dates.checkIn };
            payload.end = { date: dates.checkOut };
        }

        const res = await fetchWithAuth(url, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!res.ok && res.status !== 404) {
            const error = await res.json().catch(() => null);
            console.warn('Calendar API PATCH error:', error);
        }
    }

    async function deleteCalendarEvent(calendarId: string, eventId: string): Promise<void> {
        const cleanId = cleanGoogleCalendarEventId(eventId);
        if (!cleanId || !calendarId) return;

        const encodedCalId = encodeURIComponent(calendarId);
        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodedCalId}/events/${cleanId}`;

        const res = await fetchWithAuth(url, { method: 'DELETE' });

        if (!res.ok && res.status !== 404 && res.status !== 410) {
            const error = await res.json().catch(() => null);
            console.warn('Calendar API DELETE error:', error);
        }
    }

    async function syncCalendarForBookingValues(
        values: (string | number)[],
        calendarId?: string,
        existingCalEventId?: string
    ): Promise<string> {
        if (!calendarId || !values[3] || !values[4]) {
            return existingCalEventId || '';
        }

        const summary = `${values[1] || 'Direct'} - ${values[2] || 'Guest'}`;
        const notesSuffix = values[9] ? ` | Notes: ${values[9]}` : '';
        const desc = `Confirmed reservation for ${values[2] || 'Guest'} via ${values[1] || 'Direct'}. Ref: ${values[0]}${notesSuffix}`;
        const dates = { checkIn: String(values[3]), checkOut: String(values[4]) };

        let finalEventId = existingCalEventId || '';

        if (finalEventId) {
            await updateCalendarEventSummary(calendarId, finalEventId, summary, dates, desc);
        } else {
            finalEventId = await createCalendarEvent(
                calendarId,
                summary,
                dates.checkIn,
                dates.checkOut,
                desc
            );
        }

        while (values.length < 10) values.push('');
        values[10] = finalEventId;

        return finalEventId;
    }

    async function fetchSheetRows(
        spreadsheetId: string,
        range: string = 'A2:K'
    ): Promise<(string | number)[][]> {
        const cacheKey = `${spreadsheetId}_${range}`;
        if (inFlightRequests.has(cacheKey)) {
            return inFlightRequests.get(cacheKey)!;
        }

        const requestPromise = (async () => {
            const res = await fetchWithAuth(
                `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`
            );
            if (!res.ok) {
                throw new Error(`Google Sheets API Error (${res.status}): ${res.statusText}`);
            }
            const data = await res.json();
            return (data.values as (string | number)[][]) || [];
        })().finally(() => {
            inFlightRequests.delete(cacheKey);
        });

        inFlightRequests.set(cacheKey, requestPromise);
        return requestPromise;
    }

    async function batchFetchSheetRows(
        spreadsheetId: string,
        ranges: string[]
    ): Promise<(string | number)[][][]> {
        if (!ranges.length) return [];
        const query = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join('&');
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${query}`;
        const res = await fetchWithAuth(url);
        if (!res.ok) throw new Error(`Google Sheets Batch API Error (${res.status})`);
        const data = await res.json();
        return (data.valueRanges || []).map((vr: any) => vr.values || []);
    }

    async function appendSheetRow(
        spreadsheetId: string,
        values: (string | number)[],
        range: string = 'A1',
        calendarId?: string
    ): Promise<string> {
        const finalValues = [...values];
        const existingEventId = String(finalValues[10] || '').trim();
        const calEventId = await syncCalendarForBookingValues(
            finalValues,
            calendarId,
            existingEventId
        );

        const encodedRange = encodeURIComponent(range);
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

        const res = await fetchWithAuth(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: [finalValues] }),
        });

        if (!res.ok) {
            const errorBody = await res.json().catch(() => null);
            throw new Error(
                `Google Sheets API Error (${res.status}): ${errorBody?.error?.message || res.statusText}`
            );
        }

        return calEventId;
    }

    async function updateSheetRowById(
        spreadsheetId: string,
        id: string,
        values: (string | number)[],
        sheetName: string = '',
        calendarId?: string
    ): Promise<void> {
        const searchRange = sheetName
            ? calendarId
                ? `'${sheetName}'!A2:K`
                : `'${sheetName}'!A2:A`
            : calendarId
              ? 'A2:K'
              : 'A2:A';

        const rows = await fetchSheetRows(spreadsheetId, searchRange);
        const rowIndex = rows.findIndex((r) => String(r[0] || '').trim() === id.trim());

        if (rowIndex === -1) {
            const appendRange = sheetName ? `'${sheetName}'!A1` : 'A1';
            await appendSheetRow(spreadsheetId, values, appendRange, calendarId);
            return;
        }

        const targetRowNumber = rowIndex + 2;
        const existingCalEventId = calendarId ? String(rows[rowIndex]?.[10] || '').trim() : '';

        const finalValues = [...values];
        await syncCalendarForBookingValues(finalValues, calendarId, existingCalEventId);

        const endColIndex = Math.min(26, finalValues.length);
        const endColLetter = String.fromCharCode(64 + endColIndex);
        const targetRange = sheetName
            ? `'${sheetName}'!A${targetRowNumber}:${endColLetter}${targetRowNumber}`
            : `A${targetRowNumber}:${endColLetter}${targetRowNumber}`;

        const res = await fetchWithAuth(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(targetRange)}?valueInputOption=USER_ENTERED`,
            {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ values: [finalValues] }),
            }
        );

        if (!res.ok) throw new Error(`Google Sheets API Error (${res.status}): ${res.statusText}`);
    }

    async function deleteSheetRowById(
        spreadsheetId: string,
        id: string,
        options: DeleteSheetRowOptions | string = {}
    ): Promise<void> {
        if (!id || !spreadsheetId) return;

        let sheetName = '';
        let calendarId: string | undefined;
        let explicitEventId: string | undefined;

        if (typeof options === 'string') {
            if (options.includes('@group.calendar.google.com') || options.includes('@gmail.com')) {
                calendarId = options;
                sheetName = '';
            } else {
                sheetName = options;
            }
        } else if (options && typeof options === 'object') {
            sheetName = options.sheetName || '';
            calendarId = options.calendarId;
            explicitEventId = options.calendarEventId;
        }

        if (sheetName.includes('@group.calendar.google.com') || sheetName.includes('@gmail.com')) {
            calendarId = sheetName;
            sheetName = '';
        }

        const idRange = sheetName
            ? calendarId
                ? `'${sheetName}'!A2:K`
                : `'${sheetName}'!A2:A`
            : calendarId
              ? 'A2:K'
              : 'A2:A';

        const rows = await fetchSheetRows(spreadsheetId, idRange);
        const rowIndex = rows.findIndex((r) => String(r[0] || '').trim() === id.trim());

        if (rowIndex === -1) return;

        const targetRowNumber = rowIndex + 2;

        if (calendarId) {
            let calEventId = explicitEventId ? cleanGoogleCalendarEventId(explicitEventId) : '';

            if (!calEventId && rows[rowIndex]) {
                const row = rows[rowIndex];
                const valK = String(row[10] || '').trim(); // Col K (index 10) in Booking Sheets
                const valL = String(row[11] || '').trim(); // Col L (index 11) in Staging Sheets

                if (valK && !valK.includes(' ') && !valK.startsWith('+')) {
                    calEventId = cleanGoogleCalendarEventId(valK);
                } else if (valL && !valL.includes(' ') && !valL.startsWith('+')) {
                    calEventId = cleanGoogleCalendarEventId(valL);
                }
            }

            if (calEventId) {
                await deleteCalendarEvent(calendarId, calEventId).catch((err) => {
                    console.warn('Failed to delete calendar event:', err);
                });
            }
        }

        const targetRange = sheetName
            ? `'${sheetName}'!A${targetRowNumber}:Z${targetRowNumber}`
            : `A${targetRowNumber}:Z${targetRowNumber}`;

        const res = await fetchWithAuth(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(targetRange)}:clear`,
            { method: 'POST', headers: { 'Content-Type': 'application/json' } }
        );

        if (!res.ok) throw new Error(`Google Sheets API Error (${res.status}): ${res.statusText}`);
    }

    return {
        isAuthenticated,
        refreshAuthStatus,
        initAuth,
        ensureAuth,
        logout,
        fetchSheetRows,
        batchFetchSheetRows,
        appendSheetRow,
        updateSheetRowById,
        deleteSheetRowById,
        createCalendarEvent,
        updateCalendarEventSummary,
        deleteCalendarEvent,
    };
}
