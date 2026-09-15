import { ref, computed, watch, toValue, type MaybeRefOrGetter } from 'vue';
import type { Booking } from '@/types/booking';
import type { BookingGroup } from '@/components/BookingsTable.vue';
import { formatDate, getCurrentMonth } from '@/utils/date';

interface UseGroupedBookingsOptions {
    autoCollapsePast?: boolean;
}

export function useGroupedBookings(
    bookingsSource: MaybeRefOrGetter<Booking[]>,
    options: UseGroupedBookingsOptions = {}
) {
    const { autoCollapsePast = true } = options;

    const collapsedMonths = ref<string[]>([]);
    const currentMonthKey = computed(() => getCurrentMonth());

    const groupedBookings = computed<BookingGroup[]>(() => {
        const list = toValue(bookingsSource);
        const groups = new Map<string, Booking[]>();

        for (const b of list) {
            if (!b.checkIn || b.checkIn.length < 7) continue;
            const monthKey = b.checkIn.substring(0, 7);
            const existing = groups.get(monthKey) ?? [];
            existing.push(b);
            groups.set(monthKey, existing);
        }

        return Array.from(groups.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, bookings]) => ({
                key,
                label: formatDate(key, { monthHeader: true }),
                count: bookings.length,
                bookings: bookings.sort((a, b) => a.checkIn.localeCompare(b.checkIn)),
            }));
    });

    const availableMonths = computed<string[]>(() => groupedBookings.value.map((g) => g.key));

    function collapsePastMonths(): void {
        const past = availableMonths.value.filter((key) => key < currentMonthKey.value);
        collapsedMonths.value = Array.from(new Set([...collapsedMonths.value, ...past]));
    }

    function expandAll(): void {
        collapsedMonths.value = [];
    }

    // Reactively auto-collapse past months when bookings arrive or month filter resets
    if (autoCollapsePast) {
        watch(
            availableMonths,
            (months) => {
                if (months.length > 0) {
                    collapsePastMonths();
                }
            },
            { immediate: true }
        );
    }

    return {
        groupedBookings,
        availableMonths,
        collapsedMonths,
        currentMonthKey,
        collapsePastMonths,
        expandAll,
    };
}
