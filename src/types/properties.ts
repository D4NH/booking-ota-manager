export type PropertyId = 'piyungan' | 'wonosari' | 'bantul';

export interface Property {
    id: PropertyId; // e.g., 'piyungan'
    name: string; // e.g., 'Mai House Jogja'
    address: string; // e.g., 'Jl. Jalan'
    codePrefix: string; // e.g., 'MHJ'
    color: string; // UI color badge
}

export interface PropertyTheme {
    text: string;
    bg: string;
}

export interface PropertyConfig extends Property {
    spreadsheetId: string;
    defaultRange: string;
}

export type LiveStatus = 'Occupied' | 'Checking-in' | 'Checking-out' | 'Vacant';

export interface PropertyPerformance {
    id: PropertyId;
    name: string;
    monthlyRevenue: number;
    totalBookingsCount: number;
    occupancyRate: number;
    liveStatus: LiveStatus;
    currentGuestName?: string;
}

export interface PortfolioSummary {
    totalPropertiesCount: number;
    totalActiveListings: number;
    totalMonthlyPayout: number;
}

export interface MonthlyPropertyRevenue {
    label: string;
    piyungan: number;
    wonosari: number;
    bantul: number;
}
