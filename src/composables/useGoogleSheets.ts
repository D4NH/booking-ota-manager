import { ref } from 'vue';

const accessToken = ref<string | null>(localStorage.getItem('gdrive_token'));
const isAuthenticated = ref<boolean>(Boolean(localStorage.getItem('gdrive_token')));

export const useGoogleSheets = () => {
    const initAuth = async (): Promise<string> => {
        return new Promise((resolve, reject) => {
            // @ts-ignore
            if (typeof google === 'undefined') {
                reject(new Error('Google API Client not loaded'));
                return;
            }

            // @ts-ignore
            const client = google.accounts.oauth2.initTokenClient({
                client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
                scope: 'https://www.googleapis.com/auth/spreadsheets',
                callback: (response: any) => {
                    if (response.error) {
                        reject(new Error(response.error));
                        return;
                    }
                    accessToken.value = response.access_token;
                    isAuthenticated.value = true;
                    localStorage.setItem('gdrive_token', response.access_token);
                    resolve(response.access_token);
                },
            });
            client.requestAccessToken();
        });
    };

    const ensureAuth = async (): Promise<string> => {
        if (accessToken.value) return accessToken.value;
        return await initAuth();
    };

    const logout = (): void => {
        accessToken.value = null;
        isAuthenticated.value = false;
        localStorage.removeItem('gdrive_token');
    };

    const fetchSheetRows = async (
        spreadsheetId: string,
        range: string = 'A2:J500'
    ): Promise<(string | number)[][]> => {
        const token = await ensureAuth();
        const res = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) throw new Error('Failed to fetch rows from Google Sheet');
        const data = await res.json();
        return data.values || [];
    };

    const appendSheetRow = async (
        spreadsheetId: string,
        values: (string | number)[]
    ): Promise<void> => {
        const token = await ensureAuth();
        const res = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:append?valueInputOption=USER_ENTERED`,
            {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ values: [values] }),
            }
        );
        if (!res.ok) throw new Error('Failed to append row');
    };

    const updateSheetRowByBookingId = async (
        spreadsheetId: string,
        bookingId: string,
        values: (string | number)[]
    ): Promise<void> => {
        const token = await ensureAuth();
        const rows = await fetchSheetRows(spreadsheetId, 'A2:A500');
        const rowIndex = rows.findIndex((r) => String(r[0] || '').trim() === bookingId.trim());

        if (rowIndex === -1) {
            await appendSheetRow(spreadsheetId, values);
            return;
        }

        const targetRowNumber = rowIndex + 2;
        const range = `A${targetRowNumber}:J${targetRowNumber}`;
        const res = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
            {
                method: 'PUT',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ values: [values] }),
            }
        );
        if (!res.ok) throw new Error('Failed to update row');
    };

    const deleteSheetRowByBookingId = async (
        spreadsheetId: string,
        bookingId: string
    ): Promise<void> => {
        const token = await ensureAuth();
        const rows = await fetchSheetRows(spreadsheetId, 'A2:A500');
        const rowIndex = rows.findIndex((r) => String(r[0] || '').trim() === bookingId.trim());

        if (rowIndex === -1) return;

        const targetRowNumber = rowIndex + 2;
        const range = `A${targetRowNumber}:J${targetRowNumber}`;
        const res = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`,
            {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            }
        );
        if (!res.ok) throw new Error('Failed to clear row');
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
};
