export type PropertyId = 'piyungan' | 'wonosari' | 'imogiri';

export interface Property {
    id: PropertyId;
    name: string;
    color: string;
}

export interface PropertyConfig extends Property {
    spreadsheetId: string;
    defaultRange: string;
}

export const PROPERTY_LIST: Property[] = [
    { id: 'piyungan', name: 'Mai House Jogja - Piyungan', color: '#10b981' },
    { id: 'wonosari', name: 'Mai House Jogja - Wonosari', color: '#3b82f6' },
    { id: 'imogiri', name: 'Mai House Jogja - Imogiri', color: '#f59e0b' },
];

export const PROPERTY_CONFIGS: Record<PropertyId, PropertyConfig> = {
    piyungan: {
        id: 'piyungan',
        name: 'Mai House Jogja - Piyungan',
        color: '#10b981',
        spreadsheetId: import.meta.env.VITE_SPREADSHEET_ID_PIYUNGAN,
        defaultRange: 'A2:J500',
    },
    wonosari: {
        id: 'wonosari',
        name: 'Mai House Jogja - Wonosari',
        color: '#3b82f6',
        spreadsheetId: import.meta.env.VITE_SPREADSHEET_ID_WONOSARI,
        defaultRange: 'A2:J500',
    },
    imogiri: {
        id: 'imogiri',
        name: 'Mai House Jogja - Imogiri',
        color: '#f59e0b',
        spreadsheetId: import.meta.env.VITE_SPREADSHEET_ID_IMOGIRI,
        defaultRange: 'A2:J500',
    },
};
