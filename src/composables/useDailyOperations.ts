import { computed, unref, type Ref } from 'vue';
import type { Booking } from '@/types/booking';
import { useDateKeys } from '@/composables/useDateKeys';

export interface UseDailyOperationsOptions {
    propertyId?: Ref<string | 'all' | undefined> | string;
}

export function useDailyOperations(
    bookings: Ref<Booking[]>,
    options: UseDailyOperationsOptions = {}
) {
    const { currentDayStr, currentHour } = useDateKeys();
    const getActivePropertyId = () => {
        const rawId = unref(options.propertyId);
        return rawId && rawId !== 'all' ? rawId : null;
    };

    const todaysArrivals = computed<Booking[]>(() => {
        const hour = currentHour.value;
        if (hour >= 15) return [];

        const today = currentDayStr.value;
        const activePropertyId = getActivePropertyId();
        const list = bookings.value || [];
        const result: Booking[] = [];

        for (let i = 0; i < list.length; i++) {
            const b = list[i];
            if (!b || b.status === 'Unavailable') continue;

            if (activePropertyId && b.propertyId !== activePropertyId) continue;

            if (b.checkIn === today) {
                result.push(b);
            }
        }

        return result;
    });
    const currentStays = computed<Booking[]>(() => {
        const today = currentDayStr.value;
        const hour = currentHour.value;
        const activePropertyId = getActivePropertyId();
        const list = bookings.value || [];
        const result: Booking[] = [];

        for (let i = 0; i < list.length; i++) {
            const b = list[i];
            if (!b || b.status === 'Unavailable') continue;

            if (activePropertyId && b.propertyId !== activePropertyId) continue;

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
        const activePropertyId = getActivePropertyId();
        const list = bookings.value || [];
        const result: Booking[] = [];

        for (let i = 0; i < list.length; i++) {
            const b = list[i];
            if (!b) continue;

            if (activePropertyId && b.propertyId !== activePropertyId) continue;

            if (b.checkOut === today) {
                result.push(b);
            }
        }

        return result;
    });
    const isOccupied = computed<boolean>(() => {
        const activePropertyId = getActivePropertyId();
        const list = bookings.value || [];
        const today = currentDayStr.value;

        for (let i = 0; i < list.length; i++) {
            const b = list[i];
            if (!b || b.status === 'Unavailable') continue;

            if (activePropertyId && b.propertyId !== activePropertyId) continue;

            if (b.checkIn <= today && b.checkOut >= today) {
                return true;
            }
        }

        return false;
    });
    const todaysTurnover = computed(() => ({
        in: todaysArrivals.value.length || currentStays.value.length,
        out: todaysDepartures.value.length,
    }));

    return {
        todaysArrivals,
        currentStays,
        todaysDepartures,
        isOccupied,
        todaysTurnover,
    };
}
