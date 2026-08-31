import type { Property, PropertyId, PropertyConfig, PropertyTheme } from '@/types/property';

export const PROPERTY_CONFIGS: Record<PropertyId, PropertyConfig> = {
    piyungan: {
        id: 'piyungan',
        name: 'Mai House Jogja - Piyungan',
        address:
            'Jl. Dusun Bintaran Wetan, Bantaran Wetan, Srimulyo, Kec. Piyungan, Kabupaten Bantul, Daerah Istimewa Yogyakarta 55792',
        color: '#016730',
        price: 1499000,
        codePrefix: 'MHJ',
        spreadsheetId: import.meta.env.VITE_SPREADSHEET_ID_PIYUNGAN,
        defaultRange: 'A2:J500',
    },
    wonosari: {
        id: 'wonosari',
        name: 'Mai House Jogja - Wonosari',
        address:
            'Mulyosari, Baleharjo, Kec. Wonosari, Kabupaten Gunungkidul, Daerah Istimewa Yogyakarta 55881',
        color: '#60a5fa',
        price: 1499000,
        codePrefix: 'MHW',
        spreadsheetId: import.meta.env.VITE_SPREADSHEET_ID_WONOSARI,
        defaultRange: 'A2:J500',
    },
    bantul: {
        id: 'bantul',
        name: 'Mai House Jogja - Bantul',
        address:
            'Jl. Mahoni No.Rt.05, Botokenceng, Wirokerten, Kec. Banguntapan, Kabupaten Bantul, Daerah Istimewa Yogyakarta 55194',
        color: '#fbbf24',
        price: 1499000,
        codePrefix: 'MHB',
        spreadsheetId: import.meta.env.VITE_SPREADSHEET_ID_BANTUL,
        defaultRange: 'A2:J500',
    },
} as const;

export const PROPERTY_LIST: Property[] = Object.values(PROPERTY_CONFIGS).map(
    ({ id, name, address, color, price, codePrefix }) => ({
        id,
        name,
        address,
        color,
        price,
        codePrefix,
    })
);

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
