import { ref } from 'vue';

const accessToken = ref<string | null>(localStorage.getItem('gdrive_token'));
const isAuthenticated = ref<boolean>(Boolean(localStorage.getItem('gdrive_token')));

export function useGoogleSheets() {
    const logout = (): void => {
        accessToken.value = null;
        isAuthenticated.value = false;
        localStorage.removeItem('gdrive_token');
    };

    const initAuth = async (): Promise<string> => {
        return new Promise((resolve, reject) => {
            if (typeof google === 'undefined' || !google.accounts?.oauth2) {
                reject(new Error('Google Accounts Identity Services SDK not loaded.'));
                return;
            }

            /* eslint-disable @typescript-eslint/no-explicit-any */
            const client = google.accounts.oauth2.initTokenClient({
                client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
                scope: 'https://www.googleapis.com/auth/spreadsheets',
                callback: (response: any) => {
                    if (response.error) {
                        logout();
                        reject(new Error(response.error_description || response.error));
                        return;
                    }
                    accessToken.value = response.access_token;
                    isAuthenticated.value = true;
                    localStorage.setItem('gdrive_token', response.access_token);
                    resolve(response.access_token);
                },
            });
            client.requestAccessToken({ prompt: 'consent' });
        });
    };

    const ensureAuth = async (): Promise<string> => {
        if (accessToken.value) return accessToken.value;
        return await initAuth();
    };

    // Universal API Wrapper: Auto-handles 401, clears invalid tokens, and retries auth
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

    // Fetch matrix rows from target sheet range
    const fetchSheetRows = async (
        spreadsheetId: string,
        range: string = 'A2:J500'
    ): Promise<(string | number)[][]> => {
        const res = await fetchWithAuth(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`
        );
        if (!res.ok) throw new Error(`Google Sheets API Error (${res.status}): ${res.statusText}`);
        const data = await res.json();
        return data.values || [];
    };

    // Append new row
    const appendSheetRow = async (
        spreadsheetId: string,
        values: (string | number)[]
    ): Promise<void> => {
        const res = await fetchWithAuth(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:append?valueInputOption=USER_ENTERED`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ values: [values] }),
            }
        );
        if (!res.ok) throw new Error(`Google Sheets API Error (${res.status}): ${res.statusText}`);
    };

    // Update existing row matched by Booking ID
    const updateSheetRowByBookingId = async (
        spreadsheetId: string,
        bookingId: string,
        values: (string | number)[]
    ): Promise<void> => {
        const rows = await fetchSheetRows(spreadsheetId, 'A2:A500');
        const rowIndex = rows.findIndex((r) => String(r[0] || '').trim() === bookingId.trim());

        if (rowIndex === -1) {
            await appendSheetRow(spreadsheetId, values);
            return;
        }

        const targetRowNumber = rowIndex + 2;
        const range = `A${targetRowNumber}:J${targetRowNumber}`;
        const res = await fetchWithAuth(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
            {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ values: [values] }),
            }
        );
        if (!res.ok) throw new Error(`Google Sheets API Error (${res.status}): ${res.statusText}`);
    };

    // Clear target row in Google Sheets
    const deleteSheetRowByBookingId = async (
        spreadsheetId: string,
        bookingId: string
    ): Promise<void> => {
        const rows = await fetchSheetRows(spreadsheetId, 'A2:A500');
        const rowIndex = rows.findIndex((r) => String(r[0] || '').trim() === bookingId.trim());

        if (rowIndex === -1) return;

        const targetRowNumber = rowIndex + 2;
        const range = `A${targetRowNumber}:J${targetRowNumber}`;
        const res = await fetchWithAuth(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            }
        );
        if (!res.ok) throw new Error(`Google Sheets API Error (${res.status}): ${res.statusText}`);
    };

    return {
        isAuthenticated,
        initAuth,
        ensureAuth,
        logout,
        fetchSheetRows,
        appendSheetRow,
        updateSheetRowByBookingId,
        deleteSheetRowByBookingId,
    };
}
