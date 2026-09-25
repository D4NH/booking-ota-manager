import { ref } from 'vue';

export interface DeleteSheetRowOptions {
    sheetName?: string;
    calendarId?: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const google: any;

const TOKEN_KEY = 'gdrive_token';
const EXPIRY_KEY = 'gdrive_token_expires_at';

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

function isTokenValid(): boolean {
    const token = localStorage.getItem(TOKEN_KEY);
    const expiresAt = Number(localStorage.getItem(EXPIRY_KEY)) || 0;
    return Boolean(token && Date.now() < expiresAt - 60_000);
}

const accessToken = ref<string | null>(isTokenValid() ? localStorage.getItem(TOKEN_KEY) : null);
const isAuthenticated = ref<boolean>(isTokenValid());

if (typeof window !== 'undefined') {
    loadGoogleSdk().catch(() => {});
}

export function useGoogleSheets() {
    const logout = (): void => {
        accessToken.value = null;
        isAuthenticated.value = false;
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(EXPIRY_KEY);
    };
    const refreshAuthStatus = (): boolean => {
        const valid = isTokenValid();
        if (!valid && isAuthenticated.value) {
            logout();
        }
        return valid;
    };
    const initAuth = async (): Promise<string> => {
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
                        logout();
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

            client.requestAccessToken({ prompt: 'select_account' });
        });
    };
    const ensureAuth = async (): Promise<string> => {
        if (refreshAuthStatus() && accessToken.value) {
            return accessToken.value;
        }
        return await initAuth();
    };
    const fetchWithAuth = async (url: string, options: RequestInit = {}): Promise<Response> => {
        let token = await ensureAuth();

        let res = await fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                Authorization: `Bearer ${token}`,
            },
        });

        if (res.status === 401) {
            logout();
            token = await initAuth();
            res = await fetch(url, {
                ...options,
                headers: {
                    ...options.headers,
                    Authorization: `Bearer ${token}`,
                },
            });
        }

        return res;
    };

    const cleanGoogleCalendarEventId = (rawId: string): string => {
        if (!rawId) return '';
        let clean = rawId.trim();
        if (clean.includes('@')) clean = clean.split('@')[0] || '';
        if (clean.includes(':')) clean = clean.split(':')[0] || '';
        return clean.trim();
    };
    const createCalendarEvent = async (
        calendarId: string,
        summary: string,
        checkIn: string,
        checkOut: string,
        description?: string
    ): Promise<string> => {
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
    };
    const updateCalendarEventSummary = async (
        calendarId: string,
        eventId: string,
        newSummary: string,
        dates?: { checkIn: string; checkOut: string },
        newDescription?: string
    ): Promise<void> => {
        const cleanId = cleanGoogleCalendarEventId(eventId);
        if (!cleanId || !calendarId) return;

        const encodedCalId = encodeURIComponent(calendarId);
        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodedCalId}/events/${cleanId}`;

        const payload: Record<string, any> = {
            summary: newSummary,
        };
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
    };
    const deleteCalendarEvent = async (calendarId: string, eventId: string): Promise<void> => {
        const cleanId = cleanGoogleCalendarEventId(eventId);
        if (!cleanId || !calendarId) return;

        const encodedCalId = encodeURIComponent(calendarId);
        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodedCalId}/events/${cleanId}`;

        const res = await fetchWithAuth(url, {
            method: 'DELETE',
        });

        // 204 = Successfully deleted
        // 404 / 410 = Event is already deleted/trashed or does not exist (Safe to ignore)
        if (!res.ok && res.status !== 404 && res.status !== 410) {
            const error = await res.json().catch(() => null);
            console.warn('Calendar API DELETE error:', error);
        } else {
            console.log(`Calendar event confirmed deleted: ${cleanId}`);
        }
    };

    const fetchSheetRows = async (
        spreadsheetId: string,
        range: string = 'A2:L'
    ): Promise<(string | number)[][]> => {
        const res = await fetchWithAuth(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`
        );
        if (!res.ok) throw new Error(`Google Sheets API Error (${res.status}): ${res.statusText}`);
        const data = await res.json();
        return data.values || [];
    };
    const batchFetchSheetRows = async (
        spreadsheetId: string,
        ranges: string[]
    ): Promise<(string | number)[][][]> => {
        if (!ranges.length) return [];
        const query = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join('&');
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${query}`;
        const res = await fetchWithAuth(url);
        if (!res.ok) throw new Error(`Google Sheets Batch API Error (${res.status})`);
        const data = await res.json();
        return (data.valueRanges || []).map((vr: any) => vr.values || []);
    };
    /**
     * Appends a row. If calendarId is supplied and values have checkIn (index 3) and checkOut (index 4),
     * automatically creates an event and stores the eventId in Column K (index 10).
     */
    const appendSheetRow = async (
        spreadsheetId: string,
        values: (string | number)[],
        range: string = 'A1',
        calendarId?: string
    ): Promise<string> => {
        let calEventId = '';
        const finalValues = [...values];

        if (calendarId && finalValues[3] && finalValues[4]) {
            const summary = `${finalValues[1] || 'Direct'} - ${finalValues[2] || 'Guest'}`;
            const desc = `Booking ID: ${finalValues[0]} | Notes: ${finalValues[9] || ''}`;
            calEventId = await createCalendarEvent(
                calendarId,
                summary,
                String(finalValues[3]),
                String(finalValues[4]),
                desc
            );
            // Ensure array has enough elements to set Column K (index 10)
            while (finalValues.length < 10) finalValues.push('');
            finalValues[10] = calEventId;
        }

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
    };
    /**
     * Updates a booking row. If calendarId is supplied, also synchronizes the Google Calendar event
     * (updating dates, guest name, channel, or creating a new event if missing).
     */
    const updateSheetRowByBookingId = async (
        spreadsheetId: string,
        bookingId: string,
        values: (string | number)[],
        sheetName: string = '',
        calendarId?: string
    ): Promise<void> => {
        const searchRange = sheetName ? `'${sheetName}'!A2:K` : 'A2:K';
        const rows = await fetchSheetRows(spreadsheetId, searchRange);
        const rowIndex = rows.findIndex((r) => String(r[0] || '').trim() === bookingId.trim());

        if (rowIndex === -1) {
            const appendRange = sheetName ? `'${sheetName}'!A1` : 'A1';
            await appendSheetRow(spreadsheetId, values, appendRange, calendarId);
            return;
        }

        const targetRowNumber = rowIndex + 2;
        const existingCalEventId = calendarId ? String(rows[rowIndex]?.[10] || '').trim() : '';

        const finalValues = [...values];

        if (calendarId && finalValues[3] && finalValues[4]) {
            const summary = `${finalValues[1] || 'Direct'} - ${finalValues[2] || 'Guest'}`;
            const desc = `Booking ID: ${bookingId} | Notes: ${finalValues[9] || ''}`;

            if (existingCalEventId) {
                await updateCalendarEventSummary(
                    calendarId,
                    existingCalEventId,
                    summary,
                    { checkIn: String(finalValues[3]), checkOut: String(finalValues[4]) },
                    desc
                );
                while (finalValues.length < 10) finalValues.push('');
                finalValues[10] = existingCalEventId;
            } else {
                const newCalEventId = await createCalendarEvent(
                    calendarId,
                    summary,
                    String(finalValues[3]),
                    String(finalValues[4]),
                    desc
                );
                while (finalValues.length < 10) finalValues.push('');
                finalValues[10] = newCalEventId;
            }
        }

        const endColIndex = Math.min(26, Math.max(finalValues.length, 11));
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
    };
    /**
     * Deletes a row by matching ID in Column A.
     * Supports optional targeting of specific tabs (sheetName) and auto-deleting Google Calendar events.
     */
    const deleteSheetRowById = async (
        spreadsheetId: string,
        id: string,
        options: DeleteSheetRowOptions | string = {}
    ): Promise<void> => {
        if (!id || !spreadsheetId) return;

        let sheetName = '';
        let calendarId: string | undefined;

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
        }

        if (sheetName.includes('@group.calendar.google.com') || sheetName.includes('@gmail.com')) {
            calendarId = sheetName;
            sheetName = '';
        }

        // OPTIMIZATION: Only fetch Column A to locate row index
        const idRange = sheetName ? `'${sheetName}'!A2:A` : 'A2:A';
        const rows = await fetchSheetRows(spreadsheetId, idRange);
        const rowIndex = rows.findIndex((r) => String(r[0] || '').trim() === id.trim());

        if (rowIndex === -1) return;

        const targetRowNumber = rowIndex + 2;

        // Fetch Column K (or Column L) for that specific row only if calendar deletion is needed
        if (calendarId) {
            const calRange = sheetName
                ? `'${sheetName}'!K${targetRowNumber}:L${targetRowNumber}`
                : `K${targetRowNumber}:L${targetRowNumber}`;
            const calRows = await fetchSheetRows(spreadsheetId, calRange).catch(() => []);
            const calEventId = calRows[0]?.[1] || calRows[0]?.[0];
            if (calEventId) {
                await deleteCalendarEvent(calendarId, String(calEventId).trim()).catch(() => {});
            }
        }

        // Clear target row in Google Sheets
        const targetRange = sheetName
            ? `'${sheetName}'!A${targetRowNumber}:Z${targetRowNumber}`
            : `A${targetRowNumber}:Z${targetRowNumber}`;

        const res = await fetchWithAuth(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(targetRange)}:clear`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            }
        );

        if (!res.ok) throw new Error(`Google Sheets API Error (${res.status}): ${res.statusText}`);
    };

    // Aliased helper for booking store
    const deleteSheetRowByBookingId = (
        spreadsheetId: string,
        bookingId: string,
        calendarId?: string
    ) => deleteSheetRowById(spreadsheetId, bookingId, { calendarId });

    return {
        isAuthenticated,
        refreshAuthStatus,
        initAuth,
        ensureAuth,
        logout,
        fetchSheetRows,
        batchFetchSheetRows,
        appendSheetRow,
        updateSheetRowByBookingId,
        deleteSheetRowByBookingId,
        deleteSheetRowById,
        createCalendarEvent,
        updateCalendarEventSummary,
        deleteCalendarEvent,
    };
}
