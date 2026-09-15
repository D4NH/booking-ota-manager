import { computed, type MaybeRefOrGetter, toValue } from 'vue';
import { storeToRefs } from 'pinia';
import { useDailyOperations } from '@/composables/useDailyOperations';
import { useDateKeys } from '@/composables/useDateKeys';
import { useBookingStore } from '@/stores/useBookingStore';
import { usePropertyStore } from '@/stores/usePropertyStore';
import type { Booking } from '@/types/booking';
import type { Property, PropertyId } from '@/types/property';
import { getCurrentDate } from '@/utils/date';
import { getActiveLockboxBooking, generatePinForBooking } from '@/utils/lockbox';

interface Options {
    includeUnavailable?: boolean;
}

export function usePropertyDetails(
    propertyIdSource: MaybeRefOrGetter<PropertyId | 'all'>,
    options: Options = {}
) {
    const bookingStore = useBookingStore();
    const propertyStore = usePropertyStore();
    const { bookings } = storeToRefs(bookingStore);
    const { properties } = storeToRefs(propertyStore);

    const { currentDay, currentHour } = useDateKeys();
    const id = computed(() => toValue(propertyIdSource));

    const selectedProperty = computed<Property | undefined>(() =>
        id.value === 'all' ? undefined : properties.value.find((p) => p.id === id.value)
    );

    const dailyOps = useDailyOperations(bookings, {
        propertyId: () => id.value,
    });

    const lockboxInfo = computed(() =>
        getActiveLockboxBooking({
            today: currentDay.value,
            currentHour: currentHour.value,
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

            if (
                b.status !== 'Unavailable' &&
                b.status !== 'No show' &&
                b.checkIn.startsWith(currentYearStr)
            ) {
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

    return {
        selectedProperty,
        unitBookings: computed(() => unitData.value.bookings),
        totalRevenue: computed(() => unitData.value.revenue),
        totalNights: computed(() => unitData.value.nights),
        adr: computed(() => unitData.value.adr),
        annualOccupancy: computed(() => unitData.value.occupancy),
        nextUpcoming,
        lockboxPin,
        isOccupied: dailyOps.isOccupied,
        staySections: dailyOps.staySections,
        currentDay,
    };
}
