import { computed, unref, type ComputedRef, type Ref } from 'vue';
import { getCurrentMonth, getPreviousMonth, getDaysInMonth, parseISODate } from '@/utils/date';
import type { Booking } from '@/types/booking';
import type { Property } from '@/types/property';

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
    targetMonth?: ComputedRef<string | undefined> | string;
    propertyId?: ComputedRef<string | 'all' | undefined> | string;
}

/**
 * Calculates exact overlapping nights belonging strictly to target month ("YYYY-MM")
 */
const getOverlappingNights = (
    checkInStr: string,
    checkOutStr: string,
    targetMonthStr: string
): number => {
    if (!checkInStr || !checkOutStr || !targetMonthStr) return 0;

    const [yearStr, monthStr] = targetMonthStr.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);

    if (isNaN(year) || isNaN(month)) return 0;

    const checkInDate = parseISODate(checkInStr);
    const checkOutDate = parseISODate(checkOutStr);
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 1);

    const start = checkInDate < monthStart ? monthStart : checkInDate;
    const end = checkOutDate > monthEnd ? monthEnd : checkOutDate;

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

        for (let i = 0; i < list.length; i++) {
            const b = list[i];
            if (!b) continue;

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

            if (isCheckInCurrent && isAvailable) {
                totalPayout += payout;
                currentMonthRevenue += payout;
                totalBookingsCount++;
            }

            if (isCheckInPrevious && isAvailable) {
                lastMonthRevenue += payout;
            }

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

    const monthlyPropertyData = computed(() => {
        const currentYear = new Date().getFullYear().toString();

        const monthlyPropertyBookings = [
            { label: 'Jan', piyungan: 0, wonosari: 0, bantul: 0 },
            { label: 'Feb', piyungan: 0, wonosari: 0, bantul: 0 },
            { label: 'Mar', piyungan: 0, wonosari: 0, bantul: 0 },
            { label: 'Apr', piyungan: 0, wonosari: 0, bantul: 0 },
            { label: 'May', piyungan: 0, wonosari: 0, bantul: 0 },
            { label: 'Jun', piyungan: 0, wonosari: 0, bantul: 0 },
            { label: 'Jul', piyungan: 0, wonosari: 0, bantul: 0 },
            { label: 'Aug', piyungan: 0, wonosari: 0, bantul: 0 },
            { label: 'Sep', piyungan: 0, wonosari: 0, bantul: 0 },
            { label: 'Oct', piyungan: 0, wonosari: 0, bantul: 0 },
            { label: 'Nov', piyungan: 0, wonosari: 0, bantul: 0 },
            { label: 'Dec', piyungan: 0, wonosari: 0, bantul: 0 },
        ];

        for (const b of bookings.value) {
            if (!b.checkIn.startsWith(currentYear) || b.status === 'Unavailable') continue;

            const monthIndex = Number(b.checkIn.substring(5, 7)) - 1;
            const targetMonth = monthlyPropertyBookings[monthIndex];

            if (
                targetMonth &&
                (b.propertyId === 'piyungan' ||
                    b.propertyId === 'wonosari' ||
                    b.propertyId === 'bantul')
            ) {
                targetMonth[b.propertyId] += b.payout || 0;
            }
        }

        return monthlyPropertyBookings;
    });

    const totalPayoutValue = computed(() => metrics.value.totalPayout);
    const occupiedNightsValue = computed(() => metrics.value.occupiedNights);
    const totalCapacityNightsValue = computed(() => metrics.value.totalCapacityNights);
    const occupancyPercentageValue = computed(() => metrics.value.occupancyPercentage);
    const totalBookingsCountValue = computed(() => metrics.value.totalBookingsCount);
    const averageDailyRateValue = computed(() => metrics.value.averageDailyRate);
    const revenueGrowthPercentValue = computed(() => metrics.value.revenueGrowthPercent);

    return {
        metrics,
        totalPayout: totalPayoutValue,
        occupiedNights: occupiedNightsValue,
        totalCapacityNights: totalCapacityNightsValue,
        occupancyPercentage: occupancyPercentageValue,
        totalBookingsCount: totalBookingsCountValue,
        averageDailyRate: averageDailyRateValue,
        revenueGrowthPercent: revenueGrowthPercentValue,
        monthlyPropertyData,
    };
}
