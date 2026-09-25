import { ref, computed, watch, toValue, type MaybeRefOrGetter } from 'vue';
import type { Booking, BookingGroup } from '@/types/booking';
import type {} from '@/components/BookingsTable.vue';
import { formatDate, getCurrentMonth } from '@/utils/date';

interface UseGroupedBookingsOptions {
    selectedMonth?: MaybeRefOrGetter<string>;
    autoCollapsePast?: boolean;
}

export function useGroupedBookings(
    bookingsSource: MaybeRefOrGetter<Booking[]>,
    options: UseGroupedBookingsOptions = {}
) {
    const { autoCollapsePast = true, selectedMonth } = options;

    const collapsedMonths = ref<string[]>([]);

    const currentMonthKey = computed(() => getCurrentMonth());
    const allGroupedBookings = computed<BookingGroup[]>(() => {
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
    const availableMonths = computed<string[]>(() => allGroupedBookings.value.map((g) => g.key));
    const groupedBookings = computed<BookingGroup[]>(() => {
        const targetMonth = selectedMonth ? toValue(selectedMonth) : 'all';
        if (!targetMonth || targetMonth === 'all') {
            return allGroupedBookings.value;
        }
        return allGroupedBookings.value.filter((g) => g.key === targetMonth);
    });

    const toggleMonth = (monthKey: string): void => {
        const idx = collapsedMonths.value.indexOf(monthKey);
        if (idx > -1) {
            collapsedMonths.value.splice(idx, 1);
        } else {
            collapsedMonths.value.push(monthKey);
        }
    };
    const collapsePastMonths = (): void => {
        const past = availableMonths.value.filter((key) => key < currentMonthKey.value);
        collapsedMonths.value = Array.from(new Set([...collapsedMonths.value, ...past]));
    };
    const expandAll = (): void => {
        collapsedMonths.value = [];
    };

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
        toggleMonth,
    };
}
