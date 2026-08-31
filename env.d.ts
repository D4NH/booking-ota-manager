/// <reference types="vite/client" />
/// <reference types="google.accounts" />

declare module '*.vue' {
    import type { DefineComponent } from 'vue';
    const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
    export default component;
}

interface ImportMetaEnv {
    readonly VITE_GOOGLE_CLIENT_ID: string;
    readonly VITE_SPREADSHEET_ID_PIYUNGAN: string;
    readonly VITE_SPREADSHEET_ID_WONOSARI: string;
    readonly VITE_SPREADSHEET_ID_BANTUL: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
interface Window {
    google?: {
        accounts: {
            oauth2: {
                initTokenClient: (config: {
                    client_id: string;
                    scope: string;
                    callback: (response: { access_token?: string; error?: any }) => void;
                }) => {
                    requestAccessToken: () => void;
                };
            };
        };
    };
}
