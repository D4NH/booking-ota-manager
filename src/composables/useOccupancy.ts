import type { Booking } from '@/types/booking';
import type { PropertyId } from '@/types/property';
import { getDaysInMonth, getCurrentMonth } from '@/utils/date';

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
        const daysInMonth = getDaysInMonth(getCurrentMonth());
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
 * Capacity dynamically scales to only properties that had bookings.
 */
export function calculateYearlyOccupancy(
    bookings: Booking[],
    year: number,
    selectedProperty: PropertyId | 'all' = 'all',
    referenceDate: Date = new Date()
): YearOccupancyResult {
    const bookedPropertiesCount = getBookedPropertiesCount(bookings, year);

    // If 'all' is selected: use only properties with >= 1 booking. If a single property is selected: 1.
    const activeUnits = selectedProperty === 'all' ? bookedPropertiesCount : 1;

    // Days in year (handles leap years)
    const isLeapYear = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    const daysInYear = isLeapYear(year) ? 366 : 365;

    // Total available capacity (0 if no properties have bookings)
    const totalAvailableNights = daysInYear * activeUnits;

    // Filter eligible bookings for this year & property
    const eligibleBookings = bookings.filter((b) => {
        if (b.status === 'Unavailable') return false;
        if (selectedProperty !== 'all' && b.propertyId !== selectedProperty) return false;
        return b.checkIn < `${year + 1}-01-01` && b.checkOut > `${year}-01-01`;
    });

    let totalBookedNights = 0;
    let ytdBookedNights = 0;
    let ytdAvailableNights = 0;

    // Track monthly data
    const monthlyData = Array.from({ length: 12 }, (_, monthIdx) => {
        const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
        return {
            daysInMonth,
            booked: 0,
            available: daysInMonth * activeUnits,
        };
    });

    const todayStr = `${referenceDate.getFullYear()}-${String(referenceDate.getMonth() + 1).padStart(2, '0')}-${String(referenceDate.getDate()).padStart(2, '0')}`;
    const isTargetYearCurrent = referenceDate.getFullYear() === year;

    for (let day = 0; day < daysInYear; day++) {
        const currentDate = new Date(year, 0, 1 + day);
        const y = currentDate.getFullYear();
        const m = currentDate.getMonth(); // 0 to 11
        const d = String(currentDate.getDate()).padStart(2, '0');
        const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${d}`;

        const bookedOnThisDay = eligibleBookings.filter(
            (b) => dateStr >= b.checkIn && dateStr < b.checkOut
        ).length;

        totalBookedNights += bookedOnThisDay;

        const targetMonth = monthlyData[m];
        if (targetMonth) {
            targetMonth.booked += bookedOnThisDay;
        }

        // YTD calculations
        if (isTargetYearCurrent) {
            if (dateStr <= todayStr) {
                ytdBookedNights += bookedOnThisDay;
                ytdAvailableNights += activeUnits;
            }
        } else if (year < referenceDate.getFullYear()) {
            ytdBookedNights = totalBookedNights;
            ytdAvailableNights = totalAvailableNights;
        }
    }

    // Monthly percentage
    const monthlyOccupancy = monthlyData.map((m) =>
        m.available > 0 ? Math.round((m.booked / m.available) * 100) : 0
    );

    // Safe division (prevents NaN / Division by zero if activeUnits is 0)
    const fullYearPercentage =
        totalAvailableNights > 0 ? Math.round((totalBookedNights / totalAvailableNights) * 100) : 0;

    const ytdPercentage =
        ytdAvailableNights > 0
            ? Math.round((ytdBookedNights / ytdAvailableNights) * 100)
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
