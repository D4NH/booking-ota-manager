import { computed, type MaybeRefOrGetter, toValue } from 'vue';
import { storeToRefs } from 'pinia';
import { useDailyOperations } from '@/composables/useDailyOperations';
import { useBookingStore } from '@/stores/useBookingStore';
import { usePropertyStore } from '@/stores/usePropertyStore';
import type { Booking } from '@/types/booking';
import type { Property, PropertyId } from '@/types/property';
import { getCurrentDate, getCurrentHour } from '@/utils/date';
import { getActiveLockboxBooking, generatePinForBooking } from '@/utils/lockbox';

interface Options {
    includeUnavailable?: boolean;
}

/**
 * Resolves property details, aggregates single-pass annual financial metrics,
 * and manages live daily operations and lockbox access for a specific property or the entire portfolio.
 *
 * @param propertyIdSource - The target PropertyId, 'all' for portfolio-wide aggregation, or a reactive ref/getter.
 * @param options - Optional configuration parameters.
 * @param options.includeUnavailable - Whether to retain 'Unavailable' block entries in `unitBookings` (defaults to `false`).
 *
 * @returns An object containing:
 * - `selectedProperty`: Computed Property model matching `propertyIdSource` (undefined if 'all').
 * - `unitBookings`: Chronologically sorted (newest first) bookings scoped to the target property.
 * - `totalYearRevenue`: Gross revenue for the current calendar year.
 * - `totalNights`: Total nights booked for the current calendar year.
 * - `adr`: Average Daily Rate across booked nights for the current calendar year.
 * - `annualOccupancy`: Occupancy percentage (capped at 100%) based on 365 calendar days.
 * - `nextUpcoming`: First upcoming confirmed reservation after today's date.
 * - `lockboxPin`: Generated access pin for the current active lockbox reservation.
 * - `isOccupied`: Top-level reactive boolean indicating current unit occupancy.
 * - `staySections`: Array of active operational stay buckets (Arriving Today, In-House, etc.).
 * - `currentDay`: Current formatted date key (YYYY-MM-DD).
 */
export function usePropertyDetails(
    propertyIdSource: MaybeRefOrGetter<PropertyId | 'all'>,
    options: Options = {}
) {
    const bookingStore = useBookingStore();
    const propertyStore = usePropertyStore();
    const { bookings } = storeToRefs(bookingStore);
    const { properties } = storeToRefs(propertyStore);

    const dailyOps = useDailyOperations(bookings, {
        propertyId: () => id.value,
    });

    const id = computed(() => toValue(propertyIdSource));
    const selectedProperty = computed<Property | undefined>(() =>
        id.value === 'all' ? undefined : properties.value.find((p) => p.id === id.value)
    );

    const lockboxInfo = computed(() =>
        getActiveLockboxBooking({
            today: getCurrentDate(),
            currentHour: getCurrentHour(),
            currentStays: dailyOps.currentStays.value,
            todaysArrivals: dailyOps.todaysArrivals.value,
            todaysDepartures: dailyOps.todaysDepartures.value,
        })
    );
    const lockboxPin = computed(() => generatePinForBooking(lockboxInfo.value.booking));
    const unitData = computed(() => {
        const propId = id.value;
        const currentYearStr = String(new Date().getFullYear());
        const validBookings: Booking[] = [];

        let revenue = 0;
        let nights = 0;

        for (const b of bookings.value) {
            if (propId !== 'all' && b.propertyId !== propId) continue;
            if (!options.includeUnavailable && b.status === 'Unavailable') continue;

            validBookings.push(b);

            if (b.status !== 'Unavailable' && b.checkIn.startsWith(currentYearStr)) {
                revenue += b.payout || 0;
                nights += b.nights || 0;
            }
        }

        validBookings.sort((a, b) => b.checkIn.localeCompare(a.checkIn));

        const adr = nights > 0 ? Math.round(revenue / nights) : 0;
        const occupancy = Math.min(100, Math.round((nights / 365) * 100));

        return {
            bookings: validBookings,
            revenue,
            nights,
            adr,
            occupancy,
        };
    });
    const nextUpcoming = computed(() => {
        const today = getCurrentDate();
        return unitData.value.bookings
            .filter((b) => b.checkIn > today)
            .sort((a, b) => a.checkIn.localeCompare(b.checkIn))[0];
    });
    const currentDay = computed(() => getCurrentDate());
    const todayTurnover = computed(() => {
        const departures = dailyOps.todaysDepartures.value;
        const arrivals = dailyOps.todaysArrivals.value;

        if (departures.length > 0 && arrivals.length > 0) {
            return {
                departing: departures[0]?.guestName ?? 'Guest',
                arriving: arrivals[0]?.guestName ?? 'Guest',
            };
        }
        return null;
    });

    return {
        selectedProperty,
        unitBookings: computed(() => unitData.value.bookings),
        totalYearRevenue: computed(() => unitData.value.revenue),
        totalNights: computed(() => unitData.value.nights),
        adr: computed(() => unitData.value.adr),
        annualOccupancy: computed(() => unitData.value.occupancy),
        nextUpcoming,
        lockboxPin,
        isOccupied: dailyOps.isOccupied,
        staySections: dailyOps.staySections,
        todaysArrivals: dailyOps.todaysArrivals,
        todaysDepartures: dailyOps.todaysDepartures,
        todayTurnover,
        dailyOps,
        currentDay,
    };
}
