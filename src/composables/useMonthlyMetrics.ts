import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { PROPERTY_LIST } from '@/config/properties';
import { getBookedPropertiesCount } from '@/composables/useOccupancy';
import { getCurrentMonth, getPreviousMonth, getDaysInMonth, parseISODate } from '@/utils/date';
import type { Booking } from '@/types/booking';
import type { PropertyId, MonthlyPropertyRevenue } from '@/types/property';

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
    targetMonth?: MaybeRefOrGetter<string | undefined>;
    propertyId?: MaybeRefOrGetter<PropertyId | 'all' | undefined>;
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

    const parts = targetMonthStr.split('-');
    const year = Number(parts[0]);
    const month = Number(parts[1]);

    if (!year || !month) return 0;

    const checkInTime = parseISODate(checkInStr).getTime();
    const checkOutTime = parseISODate(checkOutStr).getTime();
    const monthStartTime = new Date(year, month - 1, 1).getTime();
    const monthEndTime = new Date(year, month, 1).getTime();

    const start = Math.max(checkInTime, monthStartTime);
    const end = Math.min(checkOutTime, monthEndTime);

    if (start >= end) return 0;

    return Math.round((end - start) / 86400000);
};

/**
 * Computes monthly financial, capacity, and volume metrics for rental properties.
 *
 * Calculates total revenue payout, booked nights, occupancy rate, average daily rate (ADR),
 * and month-over-month revenue growth. Supports calculating either for a single villa
 * (capacity = 1 unit) or across the entire portfolio.
 *
 * @param bookings - A reactive reference, getter function, or array of bookings.
 * @param options - Configuration options for scoping the calculation.
 * @param options.targetMonth - Target month in 'YYYY-MM' format (e.g., '2026-09'). Defaults to the current month.
 * @param options.propertyId - Property filter. Accepts a static ID, a `Ref`, or a getter function (e.g., `() => property.id`).
 *                             Defaults to 'all' (aggregates across all active units).
 *
 * @returns An object containing reactive computed values:
 * - `metrics`: Complete monthly metrics summary object.
 * - `totalPayout`: Total gross revenue for check-ins occurring in the target month.
 * - `occupiedNights`: Exact count of occupied nights overlapping the target month.
 * - `totalCapacityNights`: Total available room-nights (days in month × active units).
 * - `occupancyPercentage`: Occupancy rate percentage (0 - 100).
 * - `totalBookingsCount`: Number of active bookings checking in during the month.
 * - `averageDailyRate`: Average revenue earned per occupied night (ADR).
 * - `revenueGrowthPercent`: Percentage change in revenue compared to the previous month.
 * - `monthlyPropertyData`: 12-month breakdown array (Jan–Dec) per property for charts.
 *
 * @example
 * // 1. Global portfolio metrics for current month:
 * const { totalPayout, occupancyPercentage } = useMonthlyMetrics(bookings);
 *
 * @example
 * // 2. Single property metrics inside a card with reactive getter:
 * const { occupancyPercentage, totalPayout, totalBookingsCount } = useMonthlyMetrics(
 *   () => bookings,
 *   {
 *     propertyId: () => property.id,
 *   }
 * );
 *
 * @example
 * // 3. Specific historical month (e.g., August 2026):
 * const { metrics } = useMonthlyMetrics(bookings, {
 *   targetMonth: '2026-08',
 *   propertyId: 'piyungan',
 * });
 */
export function useMonthlyMetrics(
    bookings: MaybeRefOrGetter<Booking[]>,
    options: UseMonthlyMetricsOptions = {}
) {
    const metrics = computed<MonthlyMetrics>(() => {
        let totalPayout = 0;
        let occupiedNights = 0;
        let totalBookingsCount = 0;
        let currentMonthRevenue = 0;
        let lastMonthRevenue = 0;

        const rawMonth = toValue(options.targetMonth);
        const targetDate = rawMonth
            ? new Date(Number(rawMonth.split('-')[0]), Number(rawMonth.split('-')[1]) - 1, 1)
            : new Date();

        const currentMonth = rawMonth || getCurrentMonth(targetDate);
        const previousMonth = getPreviousMonth(targetDate);

        const list = toValue(bookings) || [];
        const rawPropertyId = toValue(options.propertyId);
        const activePropertyId =
            rawPropertyId && rawPropertyId !== 'all' ? (rawPropertyId as PropertyId) : null;
        const isSingleProperty = !!activePropertyId;

        const daysInCurrentMonth = getDaysInMonth(currentMonth);
        const activeUnitsCount = isSingleProperty ? 1 : Math.max(1, getBookedPropertiesCount(list));
        const totalCapacityNights = activeUnitsCount * daysInCurrentMonth;

        const monthStartStr = `${currentMonth}-01`;
        const monthEndStr = `${currentMonth}-${String(daysInCurrentMonth).padStart(2, '0')}`;

        for (let i = 0; i < list.length; i++) {
            const b = list[i];
            if (!b || b.status === 'Unavailable') continue;

            if (activePropertyId && b.propertyId !== activePropertyId) {
                continue;
            }

            const checkIn = b.checkIn || '';
            const checkOut = b.checkOut || '';
            const payout = b.payout || 0;

            const isCheckInCurrent = checkIn.startsWith(currentMonth);
            const isCheckInPrevious = checkIn.startsWith(previousMonth);

            if (isCheckInCurrent) {
                totalPayout += payout;
                currentMonthRevenue += payout;
                totalBookingsCount++;
            }

            if (isCheckInPrevious) {
                lastMonthRevenue += payout;
            }

            if (checkIn <= monthEndStr && checkOut >= monthStartStr) {
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

    const monthlyPropertyData = computed<MonthlyPropertyRevenue[]>(() => {
        const currentYear = new Date().getFullYear().toString();
        const list = toValue(bookings) || [];

        const labels = [
            'Jan',
            'Feb',
            'Mar',
            'Apr',
            'May',
            'Jun',
            'Jul',
            'Aug',
            'Sep',
            'Oct',
            'Nov',
            'Dec',
        ];

        // Initialize complete row objects upfront with default zero balances
        const monthlyPropertyBookings: MonthlyPropertyRevenue[] = labels.map((label) => {
            const row = { label } as MonthlyPropertyRevenue;
            for (let i = 0; i < PROPERTY_LIST.length; i++) {
                const prop = PROPERTY_LIST[i];
                if (prop) {
                    row[prop.id] = 0;
                }
            }
            return row;
        });

        for (let i = 0; i < list.length; i++) {
            const b = list[i];
            if (!b || !b.checkIn?.startsWith(currentYear) || b.status === 'Unavailable') {
                continue;
            }

            const monthIndex = Number(b.checkIn.substring(5, 7)) - 1;
            const target = monthlyPropertyBookings[monthIndex];

            if (target && b.propertyId in target) {
                const currentVal = target[b.propertyId];
                if (typeof currentVal === 'number') {
                    target[b.propertyId] = currentVal + (b.payout || 0);
                }
            }
        }

        return monthlyPropertyBookings;
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
        monthlyPropertyData,
    };
}
