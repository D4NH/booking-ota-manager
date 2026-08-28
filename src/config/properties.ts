export type PropertyId = 'piyungan' | 'wonosari' | 'bantul';

export interface Property {
    id: PropertyId;
    name: string;
    color: string;
}

export interface PropertyTheme {
    text: string;
    bg: string;
}

export interface PropertyConfig extends Property {
    spreadsheetId: string;
    defaultRange: string;
}

export const PROPERTY_LIST: Property[] = [
    { id: 'piyungan', name: 'Mai House Jogja - Piyungan', color: '#016730' },
    { id: 'wonosari', name: 'Mai House Jogja - Wonosari', color: '#3b82f6' },
    { id: 'bantul', name: 'Mai House Jogja - Bantul', color: '#884B00' },
];

export const PROPERTY_CONFIGS: Record<PropertyId, PropertyConfig> = {
    piyungan: {
        id: 'piyungan',
        name: 'Mai House Jogja - Piyungan',
        color: '#016730',
        spreadsheetId: import.meta.env.VITE_SPREADSHEET_ID_PIYUNGAN,
        defaultRange: 'A2:J500',
    },
    wonosari: {
        id: 'wonosari',
        name: 'Mai House Jogja - Wonosari',
        color: '#60a5fa',
        spreadsheetId: import.meta.env.VITE_SPREADSHEET_ID_WONOSARI,
        defaultRange: 'A2:J500',
    },
    bantul: {
        id: 'bantul',
        name: 'Mai House Jogja - Bantul',
        color: '#fbbf24',
        spreadsheetId: import.meta.env.VITE_SPREADSHEET_ID_BANTUL,
        defaultRange: 'A2:J500',
    },
};

export const PROPERTY_THEMES: Record<PropertyId, PropertyTheme> = {
    wonosari: {
        text: 'text-blue-400',
        bg: 'bg-blue-500/10',
    },
    piyungan: {
        text: 'text-emerald-400',
        bg: 'bg-emerald-500/10',
    },
    bantul: {
        text: 'text-amber-400',
        bg: 'bg-amber-500/10',
    },
};
