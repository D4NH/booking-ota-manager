import { ref } from 'vue';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES =
    'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets';
const STORAGE_KEY = 'google_access_token';

export function useGoogleSheets() {
    const accessToken = ref<string | null>(sessionStorage.getItem(STORAGE_KEY));
    const isAuthorizing = ref<boolean>(false);
    const isLoadingData = ref<boolean>(false);
    const authError = ref<string | null>(null);

    const saveToken = (token: string): void => {
        accessToken.value = token;
        sessionStorage.setItem(STORAGE_KEY, token);
    };

    const clearToken = (): void => {
        accessToken.value = null;
        sessionStorage.removeItem(STORAGE_KEY);
    };

    const initAuth = (): Promise<string> => {
        return new Promise((resolve, reject) => {
            if (!CLIENT_ID) {
                const err = 'Missing VITE_GOOGLE_CLIENT_ID in .env.local';
                authError.value = err;
                return reject(new Error(err));
            }

            if (!window.google?.accounts?.oauth2) {
                const err = 'Google Identity Services script not loaded in index.html';
                authError.value = err;
                return reject(new Error(err));
            }

            isAuthorizing.value = true;
            authError.value = null;

            const client = window.google.accounts.oauth2.initTokenClient({
                client_id: CLIENT_ID,
                scope: SCOPES,
                callback: (response) => {
                    isAuthorizing.value = false;
                    if (response.access_token) {
                        saveToken(response.access_token);
                        resolve(response.access_token);
                    } else {
                        authError.value = 'Failed to obtain access token';
                        reject(new Error(response.error || 'Authentication failed'));
                    }
                },
            });

            client.requestAccessToken();
        });
    };

    /**
     * Reads rows from a specified Google Sheet file.
     */
    const fetchSheetRows = async (
        spreadsheetId: string,
        range: string = 'A2:J500'
    ): Promise<string[][]> => {
        if (!spreadsheetId) throw new Error('Target spreadsheet ID is missing.');
        if (!accessToken.value) await initAuth();

        isLoadingData.value = true;
        try {
            const res = await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
                {
                    headers: { Authorization: `Bearer ${accessToken.value}` },
                }
            );

            if (res.status === 401) {
                clearToken();
                authError.value = 'Session expired. Please reconnect Google Drive.';
                throw new Error('Unauthorized token');
            }

            const data = await res.json();
            if (data.error) throw new Error(data.error.message || 'Error fetching sheet data');
            return (data.values || []) as string[][];
        } finally {
            isLoadingData.value = false;
        }
    };

    /**
     * Appends a new row array to the end of a specified Google Sheet file.
     */
    const appendSheetRow = async (
        spreadsheetId: string,
        values: (string | number)[],
        range: string = 'A:J'
    ): Promise<void> => {
        if (!spreadsheetId) throw new Error('Target spreadsheet ID is missing.');

        // Auto-trigger auth if token is missing
        if (!accessToken.value) {
            await initAuth();
        }

        const res = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken.value}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ values: [values] }),
            }
        );

        if (res.status === 401) {
            clearToken();
            await initAuth(); // Retry once after refreshing expired session token
            throw new Error('Unauthorized token. Session refreshed.');
        }

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(
                errData.error?.message || 'Failed to append row to target Google Sheet'
            );
        }
    };

    const updateSheetRowByBookingId = async (
        spreadsheetId: string,
        bookingId: string,
        values: (string | number)[],
        range: string = 'A2:A500'
    ): Promise<void> => {
        if (!spreadsheetId) throw new Error('Target spreadsheet ID is missing.');
        if (!accessToken.value) await initAuth();

        // 1. Fetch column A to find matching row index
        const rows = await fetchSheetRows(spreadsheetId, range);
        const rowIndex = rows.findIndex((r) => r[0]?.trim() === bookingId.trim());

        if (rowIndex === -1) {
            console.warn(
                `Booking ID ${bookingId} not found in target Google Sheet. Appending instead.`
            );
            await appendSheetRow(spreadsheetId, values);
            return;
        }

        const targetRowNumber = rowIndex + 2;
        const targetRange = `A${targetRowNumber}:J${targetRowNumber}`;

        // 2. Update the specific row
        const res = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(targetRange)}?valueInputOption=USER_ENTERED`,
            {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${accessToken.value}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ values: [values] }),
            }
        );

        if (res.status === 401) {
            clearToken();
            throw new Error('Unauthorized token');
        }

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(
                errData.error?.message || `Failed to update row ${targetRowNumber} in Google Sheet`
            );
        }
    };

    /**
     * Finds a row by matching booking ID in column A and clears that row in the specified Google Sheet file.
     */
    const deleteSheetRowByBookingId = async (
        spreadsheetId: string,
        bookingId: string,
        range: string = 'A2:A500'
    ): Promise<void> => {
        if (!spreadsheetId) throw new Error('Target spreadsheet ID is missing.');
        if (!accessToken.value) await initAuth();

        const rows = await fetchSheetRows(spreadsheetId, range);
        const rowIndex = rows.findIndex((r) => r[0]?.trim() === bookingId.trim());

        if (rowIndex === -1) {
            console.warn(
                `Booking ID ${bookingId} not found in target Google Sheet. Skipping remote clear.`
            );
            return;
        }

        // Offset by +2 for 1-based sheet indexing starting at row A2
        const targetRowNumber = rowIndex + 2;
        const targetRange = `A${targetRowNumber}:J${targetRowNumber}`;

        const res = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(targetRange)}:clear`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken.value}`,
                },
            }
        );

        if (res.status === 401) {
            clearToken();
            throw new Error('Unauthorized token');
        }

        if (!res.ok) {
            throw new Error(`Failed to clear row ${targetRowNumber} in target Google Sheet`);
        }
    };

    return {
        accessToken,
        isAuthorizing,
        isLoadingData,
        authError,
        initAuth,
        clearToken,
        fetchSheetRows,
        appendSheetRow,
        updateSheetRowByBookingId,
        deleteSheetRowByBookingId,
    };
}
