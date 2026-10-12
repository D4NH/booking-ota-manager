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

export function buildDailyEarningsMap(
    bookings: Booking[],
    propertyId: PropertyId | 'all',
    startDate: string,
    endDate: string
): Map<string, number> {
    const dailyMap = new Map<string, number>();

    for (let i = 0; i < bookings.length; i++) {
        const b = bookings[i];
        if (!b || b.status === 'Unavailable' || b.nights <= 0) continue;
        if (propertyId !== 'all' && b.propertyId !== propertyId) continue;
        if (b.checkOut <= startDate || b.checkIn >= endDate) continue;

        const nightlyRate = b.payout / b.nights;
        const [y, m, d] = b.checkIn.split('-').map(Number);
        if (!y || !m || !d) continue;

        const cur = new Date(Date.UTC(y, m - 1, d));
        const outDate = new Date(b.checkOut);

        while (cur < outDate) {
            const dateStr = cur.toISOString().slice(0, 10);
            if (dateStr >= startDate && dateStr <= endDate) {
                dailyMap.set(dateStr, (dailyMap.get(dateStr) ?? 0) + nightlyRate);
            }
            cur.setUTCDate(cur.getUTCDate() + 1);
        }
    }

    return dailyMap;
}

export function getWeeklyComparison(
    bookings: Booking[],
    propertyId: PropertyId | 'all' = 'all',
    referenceDate: Date = new Date()
): WeeklyData {
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dayOfWeek = (referenceDate.getDay() + 6) % 7;
    const currentMonday = new Date(referenceDate);
    currentMonday.setDate(referenceDate.getDate() - dayOfWeek);
    currentMonday.setHours(0, 0, 0, 0);

    const lastMonday = new Date(currentMonday);
    lastMonday.setDate(currentMonday.getDate() - 7);

    const startIso = getCurrentDate(lastMonday);
    const endSun = new Date(currentMonday);
    endSun.setDate(currentMonday.getDate() + 6);
    const endIso = getCurrentDate(endSun);

    const dailyEarnings = buildDailyEarningsMap(bookings, propertyId, startIso, endIso);

    const currentWeek: number[] = [];
    const lastWeek: number[] = [];

    for (let i = 0; i < 7; i++) {
        const curDate = new Date(currentMonday);
        curDate.setDate(currentMonday.getDate() + i);
        currentWeek.push(Math.round(dailyEarnings.get(getCurrentDate(curDate)) ?? 0));

        const prevDate = new Date(lastMonday);
        prevDate.setDate(lastMonday.getDate() + i);
        lastWeek.push(Math.round(dailyEarnings.get(getCurrentDate(prevDate)) ?? 0));
    }

    return { labels, currentWeek, lastWeek };
}

export function getMonthlyComparison(
    bookings: Booking[],
    propertyId: PropertyId | 'all' = 'all',
    referenceDate: Date = new Date()
): MonthlyData {
    const labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
    const curYear = referenceDate.getFullYear();
    const curMonth = referenceDate.getMonth();
    const prevYear = curMonth === 0 ? curYear - 1 : curYear;
    const prevMonth = curMonth === 0 ? 11 : curMonth - 1;

    const prevMonthStart = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-01`;
    const curMonthEnd = `${curYear}-${String(curMonth + 1).padStart(2, '0')}-31`;

    const earningsMap = buildDailyEarningsMap(bookings, propertyId, prevMonthStart, curMonthEnd);

    function sumSegment(year: number, month: number, startDay: number, endDay: number): number {
        let total = 0;
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const actualEnd = Math.min(endDay, daysInMonth);

        for (let d = startDay; d <= actualEnd; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            total += earningsMap.get(dateStr) ?? 0;
        }
        return Math.round(total);
    }

    const segments = [
        { start: 1, end: 7 },
        { start: 8, end: 14 },
        { start: 15, end: 21 },
        { start: 22, end: 31 },
    ];

    const currentMonth = segments.map((s) => sumSegment(curYear, curMonth, s.start, s.end));
    const lastMonth = segments.map((s) => sumSegment(prevYear, prevMonth, s.start, s.end));

    return { labels, currentMonth, lastMonth };
}
