export type PropertyId = 'piyungan' | 'wonosari' | 'bantul' | 'nusadua';

export interface Property {
    id: PropertyId;
    name: string;
    address: string;
    coordinates?: {
        lat: number;
        lng: number;
    };
    price: number;
    codePrefix: string;
    color: string;
    bedrooms: number;
    bathrooms: number;
    plotSize: number;
    wifi?: {
        ssid: string;
        pwd: string;
    };
    available: boolean;
}

export interface PropertyTheme {
    text: string;
    color: string;
    bg: string;
}

export type LiveStatus = 'Occupied' | 'Checking-in' | 'Checking-out' | 'Vacant';

export interface ListingBreakdown {
    listing: string;
    count: number;
    payout: number;
}

export interface PropertyPerformance {
    id: PropertyId;
    name: string;
    monthlyRevenue: number;
    totalBookingsCount: number;
    occupancyRate: number;
    liveStatus: LiveStatus;
    currentGuestName?: string;
    listings: ListingBreakdown[];
}

export interface PortfolioSummary {
    totalPropertiesCount: number;
    totalActiveListings: number;
    totalMonthlyPayout: number;
}

export type MonthlyPropertyRevenue = {
    label: string;
} & Record<PropertyId, number>;

export interface PropertyForm {
    id: PropertyId | '';
    name: string;
    address: string;
    color: string;
    price: number | '';
    codePrefix: string;
}
