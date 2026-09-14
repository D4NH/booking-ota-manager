import type { Property, PropertyId, PropertyConfig, PropertyTheme } from '@/types/property';

export const PROPERTY_CONFIGS: Record<PropertyId, PropertyConfig> = {
    piyungan: {
        id: 'piyungan' as PropertyId,
        name: 'Mai House Jogja - Piyungan',
        address:
            'Jl. Dusun Bintaran Wetan, Bantaran Wetan, Srimulyo, Kec. Piyungan, Kabupaten Bantul, Daerah Istimewa Yogyakarta 55792',
        coordinates: {
            lat: -7.831934505529178,
            lng: 110.45719640062045,
        },
        color: '#016730',
        price: 1499000,
        codePrefix: 'MHJ',
        spreadsheetId: import.meta.env.VITE_SPREADSHEET_ID_PIYUNGAN,
        defaultRange: 'A2:J500',
        bedrooms: 2,
        bathrooms: 3,
        plotSize: 123,
        wifi: {
            ssid: 'Mai House Jogja',
            pwd: 'maihouse1234',
        },
        available: true,
    },
    wonosari: {
        id: 'wonosari' as PropertyId,
        name: 'Mai House Jogja - Wonosari',
        address:
            'Mulyosari, Baleharjo, Kec. Wonosari, Kabupaten Gunungkidul, Daerah Istimewa Yogyakarta 55881',
        coordinates: {
            lat: -7.982310543653178,
            lng: 110.60562857637551,
        },
        color: '#60a5fa',
        price: 1499000,
        codePrefix: 'MHW',
        spreadsheetId: import.meta.env.VITE_SPREADSHEET_ID_WONOSARI,
        defaultRange: 'A2:J500',
        bedrooms: 2,
        bathrooms: 1,
        plotSize: 80,
        wifi: {
            ssid: '',
            pwd: '',
        },
        available: false,
    },
    bantul: {
        id: 'bantul' as PropertyId,
        name: 'Mai House Jogja - Bantul',
        address:
            'Jl. Mahoni No.Rt.05, Botokenceng, Wirokerten, Kec. Banguntapan, Kabupaten Bantul, Daerah Istimewa Yogyakarta 55194',
        coordinates: {
            lat: -7.8512793672620855,
            lng: 110.3950108289017,
        },
        color: '#fbbf24',
        price: 1499000,
        codePrefix: 'MHB',
        spreadsheetId: import.meta.env.VITE_SPREADSHEET_ID_BANTUL,
        defaultRange: 'A2:J500',
        bedrooms: 3,
        bathrooms: 2,
        plotSize: 110,
        wifi: {
            ssid: '',
            pwd: '',
        },
        available: false,
    },
    nusadua: {
        id: 'nusadua' as PropertyId,
        name: 'Mai House Bali - Nusa Dua',
        address:
            'Jl. Trompong Jl. Nusa Dua, Selatan, Benoa, Kec. Kuta Sel., Kabupaten Badung, Bali 80361',
        coordinates: {
            lat: -8.807494847880703,
            lng: 115.22192033648172,
        },
        color: '#F33F5D',
        price: 1499000,
        codePrefix: 'MHN',
        spreadsheetId: import.meta.env.VITE_SPREADSHEET_ID_NUSADUA,
        defaultRange: 'A2:J500',
        bedrooms: 2,
        bathrooms: 2,
        plotSize: 105,
        wifi: {
            ssid: '',
            pwd: '',
        },
        available: false,
    },
} as const;

export const PROPERTY_LIST: Property[] = Object.values(PROPERTY_CONFIGS).map(
    ({
        id,
        name,
        address,
        coordinates,
        color,
        price,
        codePrefix,
        bedrooms,
        bathrooms,
        plotSize,
        wifi,
        available,
    }) => ({
        id,
        name,
        address,
        coordinates,
        color,
        price,
        codePrefix,
        bedrooms,
        bathrooms,
        plotSize,
        wifi,
        available,
    })
);

export const PROPERTY_THEMES: Record<PropertyId, PropertyTheme> = {
    wonosari: {
        text: 'text-blue-400',
        color: 'bg-blue-400',
        bg: 'bg-blue-500/10',
    },
    piyungan: {
        text: 'text-emerald-400',
        color: 'bg-emerald-400',
        bg: 'bg-emerald-500/10',
    },
    bantul: {
        text: 'text-amber-400',
        color: 'bg-amber-400',
        bg: 'bg-amber-500/10',
    },
    nusadua: {
        text: 'text-rose-400',
        color: 'bg-rose-400',
        bg: 'bg-rose-500/10',
    },
};

export const getPropertyTheme = (id: PropertyId | string): PropertyTheme =>
    PROPERTY_THEMES[id as PropertyId] || PROPERTY_THEMES.piyungan;
