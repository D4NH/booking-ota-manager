import { computed, type Ref } from 'vue';
import { useDateKeys } from '@/composables/useDateKeys';
import type { Booking } from '@/types/booking';

export function useDailyOperations(bookings: Ref<Booking[]>) {
    const { currentDayStr, currentHour } = useDateKeys();

    const todaysArrivals = computed<Booking[]>(() => {
        if (currentHour.value >= 15) return [];

        const today = currentDayStr.value;
        return bookings.value.filter((b) => b.checkIn === today && b.status !== 'Unavailable');
    });

    const currentStays = computed<Booking[]>(() => {
        const today = currentDayStr.value;
        const hour = currentHour.value;

        return bookings.value.filter((b) => {
            if (b.status === 'Unavailable' || b.status === 'Waiting for payout') return false;
            // Mid-stay guests
            if (b.checkIn < today && b.checkOut > today) return true;
            // Arrivals show after 15:00
            if (b.checkIn === today) return hour >= 15;
            // Currently Staying until 12:00
            if (b.checkOut === today) return hour < 12;
            return false;
        });
    });

    const todaysDepartures = computed<Booking[]>(() => {
        if (currentHour.value >= 13) return [];

        const today = currentDayStr.value;
        return bookings.value.filter((b) => b.checkOut === today && b.status !== 'Unavailable');
    });

    return {
        todaysArrivals,
        currentStays,
        todaysDepartures,
    };
}
