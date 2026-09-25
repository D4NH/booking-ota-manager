// src/composables/useMonthlyMetrics.ts
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

const MS_PER_DAY = 86_400_000;

/**
 * Fast UTC night overlap without per-iteration Date allocations
 */
function calculateOverlappingNights(
    checkInStr: string,
    checkOutStr: string,
    monthStartMs: number,
    monthEndMs: number
): number {
    const [y1, m1, d1] = checkInStr.split('-').map(Number);
    const [y2, m2, d2] = checkOutStr.split('-').map(Number);
    if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return 0;

    // Use pure UTC milliseconds to prevent 7-hour WIB timezone offsets
    const checkInMs = Date.UTC(y1, m1 - 1, d1);
    const checkOutMs = Date.UTC(y2, m2 - 1, d2);

    const start = Math.max(checkInMs, monthStartMs);
    const end = Math.min(checkOutMs, monthEndMs);

    if (start >= end) return 0;
    return Math.round((end - start) / MS_PER_DAY);
}

/**
 * Computes monthly financial, capacity, and volume analytics for a single property or the entire portfolio.
 *
 * Evaluates revenue payout, exact date-clamped night occupancy, average daily rate (ADR),
 * month-over-month revenue growth, and annual 12-month property revenue distributions.
 *
 * @param bookings - A reactive `Ref`, getter function, or raw array of Booking records.
 * @param options - Configuration options for scoping the calculation.
 * @param options.targetMonth - Target month in 'YYYY-MM' format ('2026-09'). Defaults to the current month.
 * @param options.propertyId - Property filter. Accepts a static PropertyId, 'all', a `Ref`, or a getter function. Defaults to 'all'.
 *
 * @returns An object containing reactive computed values:
 * - `metrics`: Consolidated `MonthlyMetrics` summary object.
 * - `totalPayout`: Gross revenue for reservations checking in during the target month.
 * - `occupiedNights`: Exact count of occupied nights falling strictly within the target month boundaries.
 * - `totalCapacityNights`: Total available room-nights (days in month × active unit count).
 * - `occupancyPercentage`: Occupancy rate percentage capped between 0 and 100.
 * - `totalBookingsCount`: Number of confirmed bookings checking in during the target month.
 * - `averageDailyRate`: Average Daily Rate (ADR) calculated as `totalPayout / occupiedNights`.
 * - `revenueGrowthPercent`: Month-over-month percentage revenue change compared to previous month check-ins.
 * - `monthlyPropertyData`: 12-month (Jan–Dec) per-property revenue matrix for the current calendar year.
 *
 * @example
 * // Portfolio-wide metrics for the active month:
 * const { totalPayout, occupancyPercentage, averageDailyRate } = useMonthlyMetrics(bookings);
 *
 * @example
 * // Reactive single-property metrics bound to route params or component props:
 * const { occupancyPercentage, totalBookingsCount } = useMonthlyMetrics(
 *   () => bookingStore.bookings,
 *   {
 *     propertyId: () => props.propertyId,
 *   }
 * );
 *
 * @example
 * // Historical month audit (August 2026 for a specific villa):
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
        let lastMonthRevenue = 0;

        const rawMonth = toValue(options.targetMonth);
        const currentMonth = rawMonth || getCurrentMonth();
        const previousMonth = getPreviousMonth(parseISODate(currentMonth));

        const [yearStr, monthStr] = currentMonth.split('-');
        const year = Number(yearStr);
        const month = Number(monthStr);

        // Precalculate boundary timestamps ONCE per calculation run
        const monthStartMs = Date.UTC(year, month - 1, 1);
        const monthEndMs = Date.UTC(year, month, 1);

        const list = toValue(bookings) ?? [];
        const rawPropertyId = toValue(options.propertyId);
        const activePropertyId =
            rawPropertyId && rawPropertyId !== 'all' ? (rawPropertyId as PropertyId) : null;
        const isSingleProperty = Boolean(activePropertyId);

        const daysInCurrentMonth = getDaysInMonth(currentMonth);
        const activeUnitsCount = isSingleProperty ? 1 : Math.max(1, getBookedPropertiesCount(list));
        const totalCapacityNights = activeUnitsCount * daysInCurrentMonth;

        const monthStartStr = `${currentMonth}-01`;
        const monthEndStr = `${currentMonth}-${String(daysInCurrentMonth).padStart(2, '0')}`;

        for (let i = 0; i < list.length; i++) {
            const b = list[i];
            if (!b || b.status === 'Unavailable' || b.status === 'No show') continue;

            if (activePropertyId && b.propertyId !== activePropertyId) continue;

            const checkIn = b.checkIn || '';
            const checkOut = b.checkOut || '';
            const payout = b.payout || 0;

            if (checkIn.startsWith(currentMonth)) {
                totalPayout += payout;
                totalBookingsCount++;
            }

            if (checkIn.startsWith(previousMonth)) {
                lastMonthRevenue += payout;
            }

            // Check if stay spans any portion of target month
            if (checkIn <= monthEndStr && checkOut > monthStartStr) {
                occupiedNights += calculateOverlappingNights(
                    checkIn,
                    checkOut,
                    monthStartMs,
                    monthEndMs
                );
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
                : Math.round(((totalPayout - lastMonthRevenue) / lastMonthRevenue) * 100);

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
    // 12-Month Annual Breakdown per Property
    const monthlyPropertyData = computed<MonthlyPropertyRevenue[]>(() => {
        const currentYear = new Date().getFullYear().toString();
        const list = toValue(bookings) ?? [];

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

        const monthlyBreakdown: MonthlyPropertyRevenue[] = labels.map((label) => {
            const row = { label } as MonthlyPropertyRevenue;
            for (const prop of PROPERTY_LIST) {
                row[prop.id] = 0;
            }
            return row;
        });

        for (let i = 0; i < list.length; i++) {
            const b = list[i];
            if (
                !b ||
                !b.checkIn?.startsWith(currentYear) ||
                b.status === 'Unavailable' ||
                b.status === 'No show'
            ) {
                continue;
            }

            const monthIndex = Number(b.checkIn.substring(5, 7)) - 1;
            const targetMonthRow = monthlyBreakdown[monthIndex];

            if (targetMonthRow && b.propertyId in targetMonthRow) {
                targetMonthRow[b.propertyId] += b.payout || 0;
            }
        }

        return monthlyBreakdown;
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
