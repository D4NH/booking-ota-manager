import { ref } from 'vue';
import { getOffsetDate } from '@/utils/date';

export interface DeleteSheetRowOptions {
    sheetName?: string;
    calendarId?: string;
    calendarEventId?: string;
}

interface SheetPropertiesResponse {
    sheets?: Array<{
        properties?: {
            sheetId?: number;
            title?: string;
            index?: number;
        };
    }>;
}

declare const google: {
    accounts: {
        oauth2: {
            initTokenClient: (config: {
                client_id: string;
                scope: string;
                callback: (res: {
                    access_token: string;
                    expires_in?: number;
                    error?: string;
                    error_description?: string;
                }) => void;
            }) => {
                requestAccessToken: (options: { prompt: string }) => void;
            };
        };
    };
};

const TOKEN_KEY = 'gdrive_token';
const EXPIRY_KEY = 'gdrive_token_expires_at';
const MAX_CONCURRENT_REQUESTS = 3;

const sheetIdCache = new Map<string, number>();
const inFlightRequests = new Map<string, Promise<unknown>>();
const requestQueue: (() => void)[] = [];
let activeRequestCount = 0;
let activeAuthPromise: Promise<string> | null = null;

function isTokenValid(): boolean {
    const token = localStorage.getItem(TOKEN_KEY);
    const expiresAt = Number(localStorage.getItem(EXPIRY_KEY)) || 0;
    return Boolean(token && Date.now() < expiresAt - 60_000);
}

const accessToken = ref<string | null>(isTokenValid() ? localStorage.getItem(TOKEN_KEY) : null);
const isAuthenticated = ref<boolean>(isTokenValid());

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
        sheetIdCache.clear();
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
                callback: (response) => {
                    if (response.error) {
                        if (prompt === 'none') {
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

                if (res.status === 401) {
                    token = await initAuth('select_account');
                    continue;
                }

                if ((res.status === 429 || res.status === 503) && attempt < maxRetries) {
                    const backoffMs = Math.pow(2, attempt) * 1000 + Math.random() * 800;
                    console.warn(
                        `[Google API ${res.status}] Rate limit hit. Backing off for ${Math.round(backoffMs)}ms...`
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

    async function getSheetNumericId(spreadsheetId: string, sheetName: string): Promise<number> {
        const cacheKey = `${spreadsheetId}:${sheetName.trim().toLowerCase()}`;
        if (sheetIdCache.has(cacheKey)) {
            return sheetIdCache.get(cacheKey)!;
        }

        const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(sheetId,title,index)`;
        const res = await fetchWithAuth(url);

        if (!res.ok) {
            throw new Error(
                `Failed to fetch spreadsheet metadata (${res.status}): ${res.statusText}`
            );
        }

        const data = (await res.json()) as SheetPropertiesResponse;
        const sheetsList = data.sheets || [];

        let resolvedSheetId: number | undefined;

        if (sheetName.trim()) {
            const target = sheetsList.find(
                (s) => s.properties?.title?.toLowerCase() === sheetName.trim().toLowerCase()
            );
            resolvedSheetId = target?.properties?.sheetId;
        } else {
            const firstSheet = sheetsList.find((s) => s.properties?.index === 0) || sheetsList[0];
            resolvedSheetId = firstSheet?.properties?.sheetId;
        }

        if (resolvedSheetId === undefined) {
            throw new Error(
                `Sheet tab "${sheetName || 'default'}" not found in spreadsheet ${spreadsheetId}.`
            );
        }

        sheetIdCache.set(cacheKey, resolvedSheetId);
        return resolvedSheetId;
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

        const data = (await res.json()) as { id?: string };
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

        const payload: Record<string, unknown> = { summary: newSummary };
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

        const checkInStr = String(values[3]).trim();
        let checkOutStr = String(values[4]).trim();

        if (checkInStr === checkOutStr) {
            checkOutStr = getOffsetDate(checkInStr, 1);
        }

        const summary = `${values[1] || 'Direct'} - ${values[2] || 'Guest'}`;
        const notesSuffix = values[9] ? ` | Notes: ${values[9]}` : '';
        const desc = `Confirmed reservation for ${values[2] || 'Guest'} via ${values[1] || 'Direct'}. Ref: ${values[0]}${notesSuffix}`;
        const dates = { checkIn: checkInStr, checkOut: checkOutStr };

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

    function findRowIndexByFallback(
        rows: (string | number)[][],
        id: string,
        fallbackCalId?: string
    ): number {
        let idx = rows.findIndex((r) => String(r[0] || '').trim() === id.trim());
        if (idx !== -1) return idx;

        if (fallbackCalId) {
            const cleanExpId = cleanGoogleCalendarEventId(fallbackCalId);
            idx = rows.findIndex((r) => {
                const valK = cleanGoogleCalendarEventId(String(r[10] || ''));
                const valL = cleanGoogleCalendarEventId(String(r[11] || ''));
                return valK === cleanExpId || valL === cleanExpId;
            });
            if (idx !== -1) return idx;
        }

        const match = id.match(/^(?:UNAVAILABLE|DIRECT)-(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/);
        if (match) {
            const [, expectedIn, expectedOut] = match;
            idx = rows.findIndex((r) => {
                const rowIn = String(r[3] || '')
                    .trim()
                    .slice(0, 10);
                const rowOut = String(r[4] || '')
                    .trim()
                    .slice(0, 10);
                return rowIn === expectedIn && rowOut === expectedOut;
            });
            if (idx !== -1) return idx;
        }

        return -1;
    }

    async function fetchSheetRows(
        spreadsheetId: string,
        range = 'A2:K'
    ): Promise<(string | number)[][]> {
        const cacheKey = `${spreadsheetId}_${range}`;
        if (inFlightRequests.has(cacheKey)) {
            return (await inFlightRequests.get(cacheKey)) as (string | number)[][];
        }

        const requestPromise = (async () => {
            const res = await fetchWithAuth(
                `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`
            );
            if (!res.ok) {
                throw new Error(`Google Sheets API Error (${res.status}): ${res.statusText}`);
            }
            const data = (await res.json()) as { values?: (string | number)[][] };
            return data.values || [];
        })().finally(() => {
            inFlightRequests.delete(cacheKey);
        });

        inFlightRequests.set(cacheKey, requestPromise);
        return (await requestPromise) as (string | number)[][];
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
        const data = (await res.json()) as {
            valueRanges?: Array<{ values?: (string | number)[][] }>;
        };
        return (data.valueRanges || []).map((vr) => vr.values || []);
    }

    async function appendSheetRow(
        spreadsheetId: string,
        values: (string | number)[],
        range = 'A1',
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
            const errorBody = (await res.json().catch(() => null)) as {
                error?: { message?: string };
            } | null;
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
        sheetName = '',
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
        const fallbackCalId = String(values[10] || '').trim();
        const rowIndex = findRowIndexByFallback(rows, id, fallbackCalId);

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
        const rowIndex = findRowIndexByFallback(rows, id, explicitEventId);

        if (rowIndex === -1) {
            console.warn(`[DeleteSheetRow] Row with identifier "${id}" not found in sheet.`);
            return;
        }

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

        const numericSheetId = await getSheetNumericId(spreadsheetId, sheetName);
        const startRowIndex = rowIndex + 1;
        const endRowIndex = rowIndex + 2;

        const batchUpdatePayload = {
            requests: [
                {
                    deleteDimension: {
                        range: {
                            sheetId: numericSheetId,
                            dimension: 'ROWS',
                            startIndex: startRowIndex,
                            endIndex: endRowIndex,
                        },
                    },
                },
            ],
        };

        const res = await fetchWithAuth(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(batchUpdatePayload),
            }
        );

        if (!res.ok) {
            const errorBody = (await res.json().catch(() => null)) as {
                error?: { message?: string };
            } | null;
            throw new Error(
                `Google Sheets BatchUpdate Error (${res.status}): ${errorBody?.error?.message || res.statusText}`
            );
        }
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
