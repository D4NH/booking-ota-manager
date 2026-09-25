import type { Booking } from '@/types/booking';
import type { PropertyId } from '@/types/property';

export interface MonthlyStats {
    percentage: number;
    bookedNights: number;
    totalAvailableNights: number;
}

export interface YearlyStats {
    year: number;
    percentage: number;
    ytdPercentage: number;
    bookedNights: number;
    totalAvailableNights: number;
    vacantNights: number;
    totalBookingsCount: number;
    activePropertiesCount: number;
    monthlyOccupancy: number[];
}

export function useOccupancy() {
    /**
     * Checks if a booking occupies the overnight stay of a given date (YYYY-MM-DD)
     */
    const isBookingActiveOnDate = (b: Booking, dateStr: string): boolean =>
        b.status === 'Unavailable' ? false : dateStr >= b.checkIn && dateStr < b.checkOut;
    /**
     * Calculate Occupancy for a Specific Month
     * Returns: { percentage: number, bookedNights: number, totalNights: number }
     */
    const calculateMonthlyOccupancy = (
        bookings: Booking[],
        year: number,
        month: number, // 1 to 12
        selectedProperty?: PropertyId | 'all',
        totalPropertiesCount: number = 3
    ) => {
        const daysInMonth = new Date(year, month, 0).getDate();
        const activeUnitsCount = selectedProperty === 'all' ? totalPropertiesCount : 1;
        const totalAvailableNights = daysInMonth * activeUnitsCount;

        let bookedNights = 0;

        // Iterate through each calendar day of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

            // Filter bookings for this day
            const activeOnDay = bookings.filter((b) => {
                if (selectedProperty !== 'all' && b.propertyId !== selectedProperty) {
                    return false;
                }
                return isBookingActiveOnDate(b, dateStr);
            });

            bookedNights += activeOnDay.length;
        }

        const percentage =
            totalAvailableNights > 0 ? Math.round((bookedNights / totalAvailableNights) * 100) : 0;

        return {
            percentage,
            bookedNights,
            totalAvailableNights,
        };
    };
    /**
     * Calculate 12-Month Array (For Jan - Dec Line / Area Chart)
     * Returns an array of 12 percentages: [45, 30, 35, ...]
     */
    const calculateYearlyMonthlyTrend = (
        bookings: Booking[],
        year: number,
        selectedProperty: PropertyId | 'all',
        totalPropertiesCount: number = 3
    ): number[] => {
        const result: number[] = [];
        for (let m = 1; m <= 12; m++) {
            const { percentage } = calculateMonthlyOccupancy(
                bookings,
                year,
                m,
                selectedProperty,
                totalPropertiesCount
            );
            result.push(percentage);
        }
        return result;
    };

    return {
        isBookingActiveOnDate,
        calculateMonthlyOccupancy,
        calculateYearlyMonthlyTrend,
    };
}

export interface YearOccupancyResult {
    year: number;
    percentage: number; // Full year occupancy % (0 - 100)
    ytdPercentage: number; // Year-to-date % (up to reference date)
    bookedNights: number; // Total nights occupied in this year
    totalAvailableNights: number; // (Days in Year) * (Active Units with > 0 Bookings)
    vacantNights: number; // Total unsold nights across active units
    totalBookingsCount: number; // Total distinct bookings in this year
    activePropertiesCount: number; // Number of properties with >= 1 booking
    monthlyOccupancy: number[]; // 12 values [Jan%, Feb%, ..., Dec%]
}

/**
 * Returns the number of properties that have at least 1 booking.
 * Properties with 0 bookings are excluded.
 */
export function getBookedPropertiesCount(bookings: Booking[], year?: number): number {
    const currentYear = new Date().getFullYear();
    const activeProperties = new Set<PropertyId>();
    const targetYear = year ?? currentYear;

    for (const b of bookings) {
        if (b.status === 'Unavailable') continue;
        if (!targetYear || !b.checkIn.startsWith(`${targetYear}`)) continue;

        if (b.checkIn < `${targetYear + 1}-01-01` && b.checkOut > `${targetYear}-01-01`) {
            activeProperties.add(b.propertyId);
        }
    }

    return activeProperties.size;
}

/**
 * Calculates complete annual occupancy statistics.
 * Capacity dynamically scales to properties that had bookings.
 */
export function calculateYearlyOccupancy(
    bookings: Booking[],
    year: number,
    selectedProperty: PropertyId | 'all' = 'all',
    referenceDate: Date = new Date()
): YearOccupancyResult {
    const bookedPropertiesCount = getBookedPropertiesCount(bookings, year);
    const activeUnits = selectedProperty === 'all' ? bookedPropertiesCount : 1;

    const isLeapYear = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    const daysInYear = isLeapYear(year) ? 366 : 365;
    const totalAvailableNights = daysInYear * activeUnits;

    const monthlyData = Array.from({ length: 12 }, (_, idx) => {
        const daysInMonth = new Date(year, idx + 1, 0).getDate();
        return {
            booked: 0,
            available: daysInMonth * activeUnits,
        };
    });

    const yearStartMs = Date.UTC(year, 0, 1);
    const yearEndMs = Date.UTC(year + 1, 0, 1);
    const refMs = Date.UTC(
        referenceDate.getFullYear(),
        referenceDate.getMonth(),
        referenceDate.getDate()
    );

    let totalBookedNights = 0;
    let ytdBookedNights = 0;
    let ytdAvailableNights = 0;

    const eligibleBookings = bookings.filter((b) => {
        if (b.status === 'Unavailable') return false;
        if (selectedProperty !== 'all' && b.propertyId !== selectedProperty) return false;
        return b.checkIn < `${year + 1}-01-01` && b.checkOut > `${year}-01-01`;
    });

    // Calculation across 12 months
    for (let i = 0; i < eligibleBookings.length; i++) {
        const b = eligibleBookings[i];
        if (!b) continue;

        const [y1, m1, d1] = b.checkIn.split('-').map(Number);
        const [y2, m2, d2] = b.checkOut.split('-').map(Number);
        if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) continue;

        const bInMs = Date.UTC(y1, m1 - 1, d1);
        const bOutMs = Date.UTC(y2, m2 - 1, d2);

        // Clamped year range
        const startMs = Math.max(bInMs, yearStartMs);
        const endMs = Math.min(bOutMs, yearEndMs);
        if (startMs >= endMs) continue;

        const stayNights = Math.round((endMs - startMs) / 86_400_000);
        totalBookedNights += stayNights;

        // YTD Nights
        if (referenceDate.getFullYear() === year) {
            const ytdEndMs = Math.min(endMs, refMs + 86_400_000);
            if (startMs < ytdEndMs) {
                ytdBookedNights += Math.round((ytdEndMs - startMs) / 86_400_000);
            }
        }

        // Allocate to monthly buckets
        for (let m = 0; m < 12; m++) {
            const mStart = Date.UTC(year, m, 1);
            const mEnd = Date.UTC(year, m + 1, 1);
            const overlapStart = Math.max(bInMs, mStart);
            const overlapEnd = Math.min(bOutMs, mEnd);

            const targetMonth = monthlyData[m];
            if (targetMonth && overlapStart < overlapEnd) {
                targetMonth.booked += Math.round((overlapEnd - overlapStart) / 86_400_000);
            }
        }
    }

    if (referenceDate.getFullYear() === year) {
        const dayOfYear = Math.ceil((refMs - yearStartMs) / 86_400_000) + 1;
        ytdAvailableNights = Math.min(daysInYear, Math.max(0, dayOfYear)) * activeUnits;
    } else if (year < referenceDate.getFullYear()) {
        ytdBookedNights = totalBookedNights;
        ytdAvailableNights = totalAvailableNights;
    }

    const monthlyOccupancy = monthlyData.map((m) =>
        m.available > 0 ? Math.min(100, Math.round((m.booked / m.available) * 100)) : 0
    );

    const fullYearPercentage =
        totalAvailableNights > 0
            ? Math.min(100, Math.round((totalBookedNights / totalAvailableNights) * 100))
            : 0;

    const ytdPercentage =
        ytdAvailableNights > 0
            ? Math.min(100, Math.round((ytdBookedNights / ytdAvailableNights) * 100))
            : fullYearPercentage;

    return {
        year,
        percentage: fullYearPercentage,
        ytdPercentage,
        bookedNights: totalBookedNights,
        totalAvailableNights,
        vacantNights: Math.max(0, totalAvailableNights - totalBookedNights),
        totalBookingsCount: eligibleBookings.length,
        activePropertiesCount: bookedPropertiesCount,
        monthlyOccupancy,
    };
}
