import type { Booking } from '@/types/booking';
import type { PropertyId } from '@/types/property';
import { getCurrentDate } from '@/utils/date';

export interface WeeklyData {
    labels: string[];
    currentWeek: number[];
    lastWeek: number[];
}

export interface MonthlyData {
    labels: string[];
    currentMonth: number[];
    lastMonth: number[];
}

export function useRevenueComparison() {
    /**
     * Calculates total revenue generated on a specific night
     */
    const getDailyEarnings = (
        bookings: Booking[],
        dateStr: string,
        propertyId: PropertyId | 'all'
    ): number => {
        return bookings
            .filter((b) => {
                if (b.status === 'Unavailable') return false;
                if (propertyId !== 'all' && b.propertyId !== propertyId) return false;
                return dateStr >= b.checkIn && dateStr < b.checkOut;
            })
            .reduce((sum, b) => {
                const nightlyRate = b.nights > 0 ? b.payout / b.nights : 0;
                return sum + nightlyRate;
            }, 0);
    };

    /**
     * Generates Weekly Dataset (Mon -> Sun for This Week vs Last Week)
     */
    const getWeeklyComparison = (
        bookings: Booking[],
        propertyId: PropertyId | 'all' = 'all',
        referenceDate: Date = new Date()
    ) => {
        const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

        // Find Monday of the current week (0=Sun, 1=Mon, ..., 6=Sat)
        const dayOfWeek = (referenceDate.getDay() + 6) % 7; // Mon = 0, Sun = 6
        const currentMonday = new Date(referenceDate);
        currentMonday.setDate(referenceDate.getDate() - dayOfWeek);
        currentMonday.setHours(0, 0, 0, 0);

        // Monday of last week
        const lastMonday = new Date(currentMonday);
        lastMonday.setDate(currentMonday.getDate() - 7);

        const currentWeek: number[] = [];
        const lastWeek: number[] = [];

        for (let i = 0; i < 7; i++) {
            // Current week date
            const curDate = new Date(currentMonday);
            curDate.setDate(currentMonday.getDate() + i);
            currentWeek.push(
                Math.round(getDailyEarnings(bookings, getCurrentDate(curDate), propertyId))
            );

            // Last week date
            const prevDate = new Date(lastMonday);
            prevDate.setDate(lastMonday.getDate() + i);
            lastWeek.push(
                Math.round(getDailyEarnings(bookings, getCurrentDate(prevDate), propertyId))
            );
        }

        return { labels, currentWeek, lastWeek };
    };

    /**
     * Generates Monthly Dataset (4 Weeks breakdown for This Month vs Last Month)
     */
    const getMonthlyComparison = (
        bookings: Booking[],
        propertyId: PropertyId | 'all' = 'all',
        referenceDate: Date = new Date()
    ) => {
        const labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];

        const curYear = referenceDate.getFullYear();
        const curMonth = referenceDate.getMonth(); // 0-11

        // Determine previous month & year (handles January -> previous December)
        const prevYear = curMonth === 0 ? curYear - 1 : curYear;
        const prevMonth = curMonth === 0 ? 11 : curMonth - 1;

        // Helper to sum revenue across a date range
        const sumRange = (
            year: number,
            month: number,
            startDay: number,
            endDay: number
        ): number => {
            let total = 0;
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const actualEnd = Math.min(endDay, daysInMonth);

            for (let d = startDay; d <= actualEnd; d++) {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                total += getDailyEarnings(bookings, dateStr, propertyId);
            }
            return Math.round(total);
        };

        // 4 week segments: Days 1-7, 8-14, 15-21, 22-end
        const segments = [
            { start: 1, end: 7 },
            { start: 8, end: 14 },
            { start: 15, end: 21 },
            { start: 22, end: 31 },
        ];

        const currentMonth = segments.map((s) => sumRange(curYear, curMonth, s.start, s.end));
        const lastMonth = segments.map((s) => sumRange(prevYear, prevMonth, s.start, s.end));

        return { labels, currentMonth, lastMonth };
    };

    return {
        getWeeklyComparison,
        getMonthlyComparison,
    };
}
