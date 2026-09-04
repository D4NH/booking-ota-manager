import { computed, unref, type Ref } from 'vue';
import type { Booking } from '@/types/booking';
import { useDateKeys } from '@/composables/useDateKeys';

export function useDailyOperations(
    bookings: Ref<Booking[]>,
    selectedPropertyId: Ref<string | 'all'> | string = 'all'
) {
    const { currentDayStr, currentHour } = useDateKeys();

    const todaysArrivals = computed<Booking[]>(() => {
        const hour = currentHour.value;
        if (hour >= 15) return [];

        const today = currentDayStr.value;
        const activePropertyId = unref(selectedPropertyId);
        const filterByProperty = activePropertyId && activePropertyId !== 'all';
        const list = bookings.value || [];
        const result: Booking[] = [];

        for (let i = 0; i < list.length; i++) {
            const b = list[i];
            if (!b || b.status === 'Unavailable') continue;

            if (filterByProperty && b.propertyId !== activePropertyId) continue;

            if (b.checkIn === today) {
                result.push(b);
            }
        }

        return result;
    });

    const currentStays = computed<Booking[]>(() => {
        const today = currentDayStr.value;
        const hour = currentHour.value;
        const activePropertyId = unref(selectedPropertyId);
        const filterByProperty = activePropertyId && activePropertyId !== 'all';
        const list = bookings.value || [];
        const result: Booking[] = [];

        for (let i = 0; i < list.length; i++) {
            const b = list[i];
            if (!b || b.status !== 'Checked-in') continue;

            if (filterByProperty && b.propertyId !== activePropertyId) continue;

            const checkIn = b.checkIn || '';
            const checkOut = b.checkOut || '';

            // Mid-stay guests
            if (checkIn < today && checkOut > today) {
                result.push(b);
            }
            // Arrivals show after 15:00
            else if (checkIn === today && hour >= 15) {
                result.push(b);
            }
            // Departures stay visible until 12:00
            else if (checkOut === today && hour < 12) {
                result.push(b);
            }
        }

        return result;
    });

    const todaysDepartures = computed<Booking[]>(() => {
        const hour = currentHour.value;
        if (hour >= 15) return [];

        const today = currentDayStr.value;
        const activePropertyId = unref(selectedPropertyId);
        const filterByProperty = activePropertyId && activePropertyId !== 'all';
        const list = bookings.value || [];
        const result: Booking[] = [];

        for (let i = 0; i < list.length; i++) {
            const b = list[i];
            if (!b) continue;

            if (filterByProperty && b.propertyId !== activePropertyId) continue;

            if (b.checkOut === today) {
                result.push(b);
            }
        }

        return result;
    });

    return {
        todaysArrivals,
        currentStays,
        todaysDepartures,
    };
}
