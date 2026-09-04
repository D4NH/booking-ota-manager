import { computed, unref, type Ref } from 'vue';
import type { Booking } from '@/types/booking';
import type { Property } from '@/types/property';
import { getCurrentMonth, getPreviousMonth, getDaysInMonth } from '@/utils/date';

export interface MonthlyMetrics {
    totalPayout: number;
    occupiedNights: number;
    totalCapacityNights: number;
    occupancyPercentage: number;
    totalBookingsCount: number;
    averageDailyRate: number;
    revenueGrowthPercent: number;
}

export interface UseMonthlyMetricsOptions {
    targetMonth?: Ref<string | undefined> | string;
    propertyId?: Ref<string | 'all' | undefined> | string;
}

/**
 * Helper to safely split "YYYY-MM-DD" strings into number tuple [year, month, day]
 */
const parseDateTuple = (dateStr: string): [number, number, number] | null => {
    if (!dateStr) return null;
    const parts = dateStr.split('-').map(Number);
    if (parts.length < 3 || parts.some(isNaN)) return null;
    return [parts[0]!, parts[1]!, parts[2]!];
};

/**
 * Calculates exact overlapping nights belonging strictly to target month ("YYYY-MM")
 */
export const getOverlappingNights = (
    checkInStr: string,
    checkOutStr: string,
    targetMonthStr: string
): number => {
    if (!checkInStr || !checkOutStr || !targetMonthStr) return 0;

    const [yearStr, monthStr] = targetMonthStr.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);

    if (isNaN(year) || isNaN(month)) return 0;

    const inTuple = parseDateTuple(checkInStr);
    const outTuple = parseDateTuple(checkOutStr);

    if (!inTuple || !outTuple) return 0;

    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 1);

    const checkIn = new Date(inTuple[0], inTuple[1] - 1, inTuple[2]);
    const checkOut = new Date(outTuple[0], outTuple[1] - 1, outTuple[2]);

    const start = checkIn < monthStart ? monthStart : checkIn;
    const end = checkOut > monthEnd ? monthEnd : checkOut;

    if (start >= end) return 0;

    const diffMs = end.getTime() - start.getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
};

export function useMonthlyMetrics(
    bookings: Ref<Booking[]>,
    properties: Ref<Property[]>,
    options: UseMonthlyMetricsOptions = {}
) {
    const metrics = computed<MonthlyMetrics>(() => {
        let totalPayout = 0;
        let occupiedNights = 0;
        let totalBookingsCount = 0;
        let currentMonthRevenue = 0;
        let lastMonthRevenue = 0;

        const rawMonth = unref(options.targetMonth);
        const currentMonth = rawMonth || getCurrentMonth(new Date());
        const previousMonth = getPreviousMonth(new Date());
        const list = bookings.value || [];
        const propertyList = properties.value || [];
        const rawPropertyId = unref(options.propertyId);
        const activePropertyId = rawPropertyId && rawPropertyId !== 'all' ? rawPropertyId : null;
        const filterByProperty = activePropertyId && activePropertyId !== 'all';
        const activePropertiesCount = filterByProperty
            ? propertyList.filter((p) => p.id === activePropertyId).length
            : propertyList.length;
        const daysInCurrentMonth = getDaysInMonth(currentMonth);
        const totalCapacityNights = activePropertiesCount * daysInCurrentMonth;

        // Single O(N) pass to aggregate all counts and metrics
        for (let i = 0; i < list.length; i++) {
            const b = list[i];
            if (!b) continue;

            // Property filter check
            if (filterByProperty && b.propertyId !== activePropertyId) {
                continue;
            }

            const checkIn = b.checkIn || '';
            const checkOut = b.checkOut || '';
            const payout = b.payout || 0;
            const isAvailable = b.status !== 'Unavailable';

            const isCheckInCurrent = checkIn.startsWith(currentMonth);
            const isCheckInPrevious = checkIn.startsWith(previousMonth);
            const isCheckOutCurrent = checkOut.startsWith(currentMonth);

            // 1. Current Month Active Booking Aggregations
            if (isCheckInCurrent && isAvailable) {
                totalPayout += payout;
                currentMonthRevenue += payout;
                totalBookingsCount++;
            }

            // 2. Previous Month Revenue Tracking (for growth calculation)
            if (isCheckInPrevious && isAvailable) {
                lastMonthRevenue += payout;
            }

            // 3. Occupied Nights Calculation
            if (isCheckInCurrent || isCheckOutCurrent) {
                occupiedNights += getOverlappingNights(checkIn, checkOut, currentMonth);
            }
        }

        const occupancyPercentage =
            totalCapacityNights > 0
                ? Math.min(100, Math.round((occupiedNights / totalCapacityNights) * 100))
                : 0;

        const averageDailyRate = occupiedNights > 0 ? Math.round(totalPayout / occupiedNights) : 0;

        const revenueGrowthPercent =
            lastMonthRevenue === 0
                ? 0
                : Math.round(((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100);

        return {
            totalPayout,
            occupiedNights,
            totalCapacityNights,
            occupancyPercentage,
            totalBookingsCount,
            averageDailyRate,
            revenueGrowthPercent,
        };
    });

    return {
        metrics,
        totalPayout: computed(() => metrics.value.totalPayout),
        occupiedNights: computed(() => metrics.value.occupiedNights),
        totalCapacityNights: computed(() => metrics.value.totalCapacityNights),
        occupancyPercentage: computed(() => metrics.value.occupancyPercentage),
        totalBookingsCount: computed(() => metrics.value.totalBookingsCount),
        averageDailyRate: computed(() => metrics.value.averageDailyRate),
        revenueGrowthPercent: computed(() => metrics.value.revenueGrowthPercent),
    };
}
