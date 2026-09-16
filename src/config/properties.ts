import type { Property, PropertyId } from '@/types/property';

export interface PropertyConfig extends Property {
    defaultRange: string;
    spreadsheetId?: string;
}

export const PROPERTY_CONFIGS: Record<PropertyId, PropertyConfig> = {
    piyungan: {
        id: 'piyungan',
        name: 'Mai House Jogja - Piyungan',
        address:
            'Jl. Dusun Bintaran Wetan, Bantaran Wetan, Srimulyo, Kec. Piyungan, Kabupaten Bantul, Daerah Istimewa Yogyakarta 55792',
        coordinates: { lat: -7.831934505529178, lng: 110.45719640062045 },
        color: '#016730',
        price: 1499000,
        codePrefix: 'MHJ',
        spreadsheetId: import.meta.env.VITE_SPREADSHEET_ID_PIYUNGAN_2026,
        defaultRange: 'A2:J',
        bedrooms: 2,
        bathrooms: 3,
        plotSize: 123,
        wifi: { ssid: 'Mai House Jogja', pwd: 'maihouse1234' },
        available: true,
    },
    wonosari: {
        id: 'wonosari',
        name: 'Mai House Jogja - Wonosari',
        address:
            'Mulyosari, Baleharjo, Kec. Wonosari, Kabupaten Gunungkidul, Daerah Istimewa Yogyakarta 55881',
        coordinates: { lat: -7.982310543653178, lng: 110.60562857637551 },
        color: '#38bdf8',
        price: 1499000,
        codePrefix: 'MHW',
        spreadsheetId: import.meta.env.VITE_SPREADSHEET_ID_WONOSARI,
        defaultRange: 'A2:J',
        bedrooms: 2,
        bathrooms: 1,
        plotSize: 80,
        wifi: { ssid: '', pwd: '' },
        available: false,
    },
    bantul: {
        id: 'bantul',
        name: 'Mai House Jogja - Bantul',
        address:
            'Jl. Mahoni No.Rt.05, Botokenceng, Wirokerten, Kec. Banguntapan, Kabupaten Bantul, Daerah Istimewa Yogyakarta 55194',
        coordinates: { lat: -7.8512793672620855, lng: 110.3950108289017 },
        color: '#fbbf24',
        price: 1499000,
        codePrefix: 'MHB',
        defaultRange: 'A2:J',
        bedrooms: 3,
        bathrooms: 2,
        plotSize: 110,
        wifi: { ssid: '', pwd: '' },
        available: false,
    },
    nusadua: {
        id: 'nusadua',
        name: 'Mai House Bali - Nusa Dua',
        address:
            'Jl. Trompong Jl. Nusa Dua, Selatan, Benoa, Kec. Kuta Sel., Kabupaten Badung, Bali 80361',
        coordinates: { lat: -8.807494847880703, lng: 115.22192033648172 },
        color: '#e879f9',
        price: 1499000,
        codePrefix: 'MHN',
        defaultRange: 'A2:J',
        bedrooms: 2,
        bathrooms: 2,
        plotSize: 105,
        wifi: { ssid: '', pwd: '' },
        available: false,
    },
};

export const PROPERTY_LIST: Property[] = Object.values(PROPERTY_CONFIGS);

export const PROPERTY_THEMES: Record<PropertyId, string> = {
    wonosari: 'text-sky-300 bg-sky-500/15',
    piyungan: 'text-emerald-300 bg-emerald-500/15',
    bantul: 'text-amber-300 bg-amber-500/15',
    nusadua: 'text-fuchsia-300 bg-fuchsia-500/15',
};

export const PROPERTY_DOT_COLORS: Record<PropertyId, string> = {
    wonosari: 'bg-sky-400',
    piyungan: 'bg-emerald-500',
    bantul: 'bg-amber-400',
    nusadua: 'bg-fuchsia-400',
};

export const PROPERTY_BASE_CLASS =
    'rounded-sm px-1.5 py-0.5 text-xs capitalize font-medium text-nowrap';

export const getPropertyStyle = (id: PropertyId | string, isDot?: boolean) => {
    const statusColors = PROPERTY_THEMES[id as PropertyId] || PROPERTY_THEMES.piyungan;

    return isDot ? PROPERTY_DOT_COLORS[id as PropertyId] : `${PROPERTY_BASE_CLASS} ${statusColors}`;
};
