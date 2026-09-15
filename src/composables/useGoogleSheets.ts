import { ref } from 'vue';

const TOKEN_KEY = 'gdrive_token';
const EXPIRY_KEY = 'gdrive_token_expires_at';

const isTokenValid = (): boolean => {
    const token = localStorage.getItem(TOKEN_KEY);
    const expiresAt = Number(localStorage.getItem(EXPIRY_KEY)) || 0;
    // Expire 60 seconds early to avoid mid-flight API dropouts
    return Boolean(token && Date.now() < expiresAt - 60_000);
};

const accessToken = ref<string | null>(isTokenValid() ? localStorage.getItem(TOKEN_KEY) : null);
const isAuthenticated = ref<boolean>(isTokenValid());

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
        return new Promise((resolve, reject) => {
            if (typeof google === 'undefined' || !google.accounts?.oauth2) {
                reject(new Error('Google Identity Services SDK not loaded.'));
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

                    const expiresInSec = Number(response.expires_in) || 3599;
                    const expiresAt = Date.now() + expiresInSec * 1000;

                    accessToken.value = response.access_token;
                    isAuthenticated.value = true;
                    localStorage.setItem(TOKEN_KEY, response.access_token);
                    localStorage.setItem(EXPIRY_KEY, String(expiresAt));

                    resolve(response.access_token);
                },
            });

            client.requestAccessToken({ prompt: '' });
        });
    };

    const ensureAuth = async (): Promise<string> => {
        if (refreshAuthStatus() && accessToken.value) {
            return accessToken.value;
        }
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

    const fetchSheetRows = async (
        spreadsheetId: string,
        range: string = 'A2:J'
    ): Promise<(string | number)[][]> => {
        const res = await fetchWithAuth(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`
        );
        if (!res.ok) throw new Error(`Google Sheets API Error (${res.status}): ${res.statusText}`);
        const data = await res.json();
        return data.values || [];
    };

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

    // Scan entire column A to locate row indices
    const updateSheetRowByBookingId = async (
        spreadsheetId: string,
        bookingId: string,
        values: (string | number)[]
    ): Promise<void> => {
        const rows = await fetchSheetRows(spreadsheetId, 'A2:A');
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

    // Scan entire column A for deletions
    const deleteSheetRowByBookingId = async (
        spreadsheetId: string,
        bookingId: string
    ): Promise<void> => {
        const rows = await fetchSheetRows(spreadsheetId, 'A2:A');
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
        refreshAuthStatus,
        initAuth,
        ensureAuth,
        logout,
        fetchSheetRows,
        appendSheetRow,
        updateSheetRowByBookingId,
        deleteSheetRowByBookingId,
    };
}
