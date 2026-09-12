import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useDateKeys } from '@/composables/useDateKeys';
import type { Booking } from '@/types/booking';
import type { PropertyId } from '@/types/property';

/**
 * Configuration options for the `useDailyOperations` composable.
 */
export interface UseDailyOperationsOptions {
    /**
     * Target property ID filter. Supports a static string, a `Ref`, or a getter function.
     * When omitted or set to `'all'`, metrics represent the entire portfolio.
     *
     * @example () => props.id
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
 * Tracks today's scheduled arrivals, active in-house guests, departures,
 * turnover counts, and occupancy state based on the current date, time of day,
 * and reservation status.
 *
 * @param bookings - A reactive reference to the bookings list (from `useBookingStore`).
 * @param options - Configuration options for scoping operational data.
 * @param options.propertyId - Property filter. Accepts a static ID, a reactive `Ref`,
 * or a getter function (e.g. `() => props.id`). Defaults to `'all'`.
 *
 * @returns An object containing:
 * - `todaysArrivals`: Reactive list of guests arriving today.
 * - `currentStays`: Reactive list of guests currently in-house.
 * - `todaysDepartures`: Reactive list of guests departing today.
 * - `todaysTurnover`: Total scheduled check-in (`in`) and check-out (`out`) counts.
 * - `isOccupied`: Boolean indicating if unit(s) are occupied right now.
 * - `staySections`: Deduplicated sections ready for direct `v-for` template rendering.
 *
 * @example
 * // 1. Global Portfolio / Dashboard usage:
 * const { todaysTurnover, staySections } = useDailyOperations(bookings);
 *
 * @example
 * // 2. Single Property View with reactive route prop:
 * const { isOccupied, currentStays } = useDailyOperations(bookings, {
 *   propertyId: () => props.id,
 * });
 */
export function useDailyOperations(
    bookings: MaybeRefOrGetter<Booking[]>,
    options: UseDailyOperationsOptions = {}
) {
    const { currentDay, currentHour } = useDateKeys();

    const getActivePropertyId = (): PropertyId | null => {
        const rawId = toValue(options.propertyId);
        return rawId && rawId !== 'all' ? (rawId as PropertyId) : null;
    };

    const dailyOperationsData = computed(() => {
        const today = currentDay.value;
        const hour = currentHour.value;
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

            // Arrivals
            if (checkIn === today && b.status !== 'Checked-out') {
                if (b.status !== 'Checked-in' || hour < 15) {
                    arrivals.push(b);
                }
            }

            // Departures
            if (checkOut === today) {
                if (hour < 15 || b.status === 'Checked-in') {
                    departures.push(b);
                }
            }

            // Currently Staying
            if (checkIn < today && checkOut > today) {
                stays.push(b);
            } else if (checkIn === today && (b.status === 'Checked-in' || hour >= 15)) {
                stays.push(b);
            } else if (checkOut === today && hour < 12 && b.status !== 'Checked-out') {
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
        return currentStays.value.length > 0;
    });

    const staySections = computed<StaySection[]>(() => {
        const activePropertyId = getActivePropertyId();

        const arrivals = [...todaysArrivals.value];
        let stays = [...currentStays.value];
        let departures = [...todaysDepartures.value];

        if (activePropertyId) {
            const inHouseNames = new Set(stays.map((s) => s.guestName.trim().toLowerCase()));

            // Only show "Leaving Today" if guest matches someone in-house
            departures = departures.filter((dep) =>
                inHouseNames.has(dep.guestName.trim().toLowerCase())
            );

            const departingNames = new Set(departures.map((d) => d.guestName.trim().toLowerCase()));
            stays = stays.filter((s) => !departingNames.has(s.guestName.trim().toLowerCase()));
        }

        return [
            { label: 'Arriving Today', items: arrivals },
            { label: 'Currently Staying', items: stays },
            { label: 'Leaving Today', items: departures },
        ].filter((section) => section.items.length > 0);
    });

    return {
        todaysArrivals,
        currentStays,
        todaysDepartures,
        todaysTurnover,
        isOccupied,
        staySections,
    };
}
