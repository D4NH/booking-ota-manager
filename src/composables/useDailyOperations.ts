import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useDateKeys } from '@/composables/useDateKeys';
import type { Booking } from '@/types/booking';
import type { PropertyId } from '@/types/property';

export interface UseDailyOperationsOptions {
    /**
     * Target property ID filter. Supports a static ID, a `Ref`, or a getter function.
     * When omitted or set to `'all'`, aggregates operations across all properties.
     *
     * @example () => id
     */
    propertyId?: MaybeRefOrGetter<PropertyId | 'all' | undefined>;
}

export interface StaySection {
    label: string;
    items: Booking[];
}

/**
 * Computes real-time daily operational metrics for rental properties.
 *
 * Enforces strict operational time windows:
 * - Arrivals: Visible before 15:00 (and not yet checked in). Empty after 15:00.
 * - Stays: Mid-stay guests, checked-in arrivals, and same-day departures (before 12:00).
 * - Departures: Visible only during the turnover cleaning window (12:00 to 15:00).
 * - Turnover: Total day's scheduled check-ins (in) and check-outs (out).
 *
 * @param bookings - A reactive reference, getter function, or raw array of bookings.
 * @param options - Configuration options for scoping operational data.
 * @param options.propertyId - Property filter (supports 'all', static string, Ref, or getter).
 *
 * @returns An object containing:
 * - `todaysArrivals`: Computed list of guests arriving today.
 * - `currentStays`: Computed list of guests currently in-house.
 * - `todaysDepartures`: Computed list of guests departing today (12:00–15:00).
 * - `todaysTurnover`: Total scheduled check-in (`in`) and check-out (`out`) counts.
 * - `isOccupied`: Boolean indicating if unit(s) have active guests right now.
 * - `staySections`: Deduplicated sections ready for direct template rendering.
 */
export function useDailyOperations(
    bookings: MaybeRefOrGetter<Booking[]>,
    options: UseDailyOperationsOptions = {}
) {
    const { currentDay, currentHour } = useDateKeys();

    /**
     * Resolves property ID filter using `toValue` to support getters, refs, and strings.
     */
    const getActivePropertyId = (): PropertyId | null => {
        const rawId = toValue(options.propertyId);
        return rawId && rawId !== 'all' ? (rawId as PropertyId) : null;
    };

    /**
     * All daily operations based on date, time of day, and status.
     */
    const dailyOperationsData = computed(() => {
        const today = currentDay.value;
        const hour = currentHour.value; // 0 to 23
        const activePropertyId = getActivePropertyId();
        const list = toValue(bookings) || [];

        const arrivals: Booking[] = [];
        const stays: Booking[] = [];
        const departures: Booking[] = [];

        let totalScheduledArrivals = 0;
        let totalScheduledDepartures = 0;

        for (let i = 0; i < list.length; i++) {
            const b = list[i];
            if (!b || b.status === 'Unavailable') continue;
            if (activePropertyId && b.propertyId !== activePropertyId) continue;

            const checkIn = b.checkIn || '';
            const checkOut = b.checkOut || '';

            if (checkIn === today) totalScheduledArrivals++;
            if (checkOut === today) totalScheduledDepartures++;

            // Arrivals before 15:00
            if (checkIn === today && hour < 15) {
                arrivals.push(b);
            }
            // Departures before 13:00
            if (checkOut === today && hour < 13) {
                departures.push(b);
            }
            // Mid-stay guest
            if (checkIn < today && checkOut > today) {
                stays.push(b);
            } else if (checkIn === today && checkOut > today && hour >= 15) {
                stays.push(b);
            }
        }

        return {
            arrivals,
            stays,
            departures,
            turnover: {
                in: totalScheduledArrivals,
                out: totalScheduledDepartures,
            },
        };
    });

    const todaysArrivals = computed(() => dailyOperationsData.value.arrivals);
    const currentStays = computed(() => dailyOperationsData.value.stays);
    const todaysDepartures = computed(() => dailyOperationsData.value.departures);
    const todaysTurnover = computed(() => dailyOperationsData.value.turnover);

    const isOccupied = computed<boolean>(() => {
        // 1. In-house or in the arrivals queue
        if (currentStays.value.length > 0 || todaysArrivals.value.length > 0) {
            return true;
        }

        // 2. Fallback: Anyone already 'Checked-in' today (even if before 15:00)
        const activePropertyId = getActivePropertyId();
        const list = toValue(bookings) || [];
        const today = currentDay.value;

        return list.some((b) => {
            if (!b || b.status === 'Unavailable') return false;
            if (activePropertyId && b.propertyId !== activePropertyId) return false;
            return b.checkIn === today && b.status === 'Checked-in';
        });
    });

    /**
     * Formatted operational sections ready for direct template rendering.
     * Automatically omits empty sections.
     */
    const staySections = computed<StaySection[]>(() =>
        [
            { label: 'Arriving Today', items: todaysArrivals.value },
            { label: 'Currently Staying', items: currentStays.value },
            { label: 'Leaving Today', items: todaysDepartures.value },
        ].filter((section) => section.items.length > 0)
    );

    return {
        todaysArrivals,
        currentStays,
        todaysDepartures,
        todaysTurnover,
        isOccupied,
        staySections,
    };
}
