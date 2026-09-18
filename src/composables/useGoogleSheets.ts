import { ref } from 'vue';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const google: any;

const TOKEN_KEY = 'gdrive_token';
const EXPIRY_KEY = 'gdrive_token_expires_at';

/**
 * Dynamically injects and verifies the Google Identity Services SDK.
 */
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
    // Expire 60s early as safety margin
    return Boolean(token && Date.now() < expiresAt - 60_000);
}

// Module-level reactive state
const accessToken = ref<string | null>(isTokenValid() ? localStorage.getItem(TOKEN_KEY) : null);
const isAuthenticated = ref<boolean>(isTokenValid());

// Eagerly pre-load SDK on browser initialization
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

            // Forces Google's account selection modal to remain visible
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
        values: (string | number)[],
        range: string = 'A1'
    ): Promise<void> => {
        const encodedRange = encodeURIComponent(range);
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

        const res = await fetchWithAuth(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: [values] }),
        });

        if (!res.ok) {
            const errorBody = await res.json().catch(() => null);
            const detail = errorBody?.error?.message || res.statusText;
            throw new Error(`Google Sheets API Error (${res.status}): ${detail}`);
        }
    };

    const updateSheetRowByBookingId = async (
        spreadsheetId: string,
        bookingId: string,
        values: (string | number)[],
        sheetName: string = ''
    ): Promise<void> => {
        const idRange = sheetName ? `'${sheetName}'!A2:A` : 'A2:A';
        const rows = await fetchSheetRows(spreadsheetId, idRange);
        const rowIndex = rows.findIndex((r) => String(r[0] || '').trim() === bookingId.trim());

        if (rowIndex === -1) {
            const appendRange = sheetName ? `'${sheetName}'!A1` : 'A1';
            await appendSheetRow(spreadsheetId, values, appendRange);
            return;
        }

        const targetRowNumber = rowIndex + 2;
        const endColLetter = String.fromCharCode(64 + Math.max(values.length, 10)); // Dynamic end column
        const targetRange = sheetName
            ? `'${sheetName}'!A${targetRowNumber}:${endColLetter}${targetRowNumber}`
            : `A${targetRowNumber}:${endColLetter}${targetRowNumber}`;

        const res = await fetchWithAuth(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(targetRange)}?valueInputOption=USER_ENTERED`,
            {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ values: [values] }),
            }
        );
        if (!res.ok) throw new Error(`Google Sheets API Error (${res.status}): ${res.statusText}`);
    };

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
