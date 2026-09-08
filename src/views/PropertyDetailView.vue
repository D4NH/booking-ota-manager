<script setup lang="ts">
import { ref, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useRoute } from 'vue-router';
import { useBookingSync } from '@/composables/useBookingSync';
import { useDailyOperations } from '@/composables/useDailyOperations';
import { useDateKeys } from '@/composables/useDateKeys';
import { useBookingStore } from '@/stores/useBookingStore';
import { useModalStore } from '@/stores/useModalStore';
import type { Booking } from '@/types/booking';
import type { PropertyId } from '@/types/property';
import { formatIDR } from '@/utils/money';
import { formatDate, getCurrentMonth } from '@/utils/date';

const route = useRoute();
const bookingStore = useBookingStore();
const { bookings } = storeToRefs(bookingStore);
const modalStore = useModalStore();

const { deleteBooking } = useBookingSync();
const { currentDay } = useDateKeys();

const hiddenStatuses = ref<Booking['status'][]>(['Completed', 'No show']);
const collapsedMonths = ref<string[]>([]);

const selectedPropertyId = computed<string>(() => {
    const id = route.params.id;
    return typeof id === 'string' && id ? id : 'all';
});
const currentMonth = computed(() => formatDate(getCurrentMonth(new Date()), { monthHeader: true }));
const filteredBookings = computed(() => {
    const prop = selectedPropertyId.value;
    const hidden = hiddenStatuses.value;

    return bookings.value
        .filter((b) => {
            if (prop !== 'all' && b.propertyId !== prop) return false;
            if (hidden.includes(b.status)) return false;

            return true;
        })
        .sort((a, b) => a.checkIn.localeCompare(b.checkIn));
});
const groupedBookings = computed(() => {
    const groups: Record<string, Booking[]> = {};

    filteredBookings.value.forEach((b) => {
        const monthKey = b.checkIn.substring(0, 7);

        if (!groups[monthKey]) groups[monthKey] = [];
        groups[monthKey].push(b);
    });

    return Object.keys(groups)
        .sort((a, b) => a.localeCompare(b))
        .map((key) => ({
            key,
            label: formatDate(key, { monthHeader: true }),
            count: groups[key]?.length,
            bookings: groups[key],
        }));
});

const { todaysArrivals, todaysDepartures, currentStays } = useDailyOperations(bookings, {
    propertyId: selectedPropertyId,
});

const isCurrentBooking = (checkIn: string, checkOut: string, status: string): boolean =>
    currentDay.value >= checkIn && currentDay.value <= checkOut && status !== 'Waiting for payout';
const toggleMonth = (monthKey: string) => {
    const index = collapsedMonths.value.indexOf(monthKey);

    if (index > -1) {
        collapsedMonths.value.splice(index, 1);
    } else {
        collapsedMonths.value.push(monthKey);
    }
};
const handleAddBooking = (propertyId: PropertyId) => modalStore.openBookingModal({ propertyId });
const handleEditBooking = (booking: Booking) => modalStore.openBookingModal({ booking });
const handleDeleteBooking = async (booking: Booking): Promise<void> => {
    await deleteBooking(booking);
};
</script>

<template>
    <div class="space-y-4">
        <!-- Daily Operations -->
        <div class="mt-8">
            <h2 class="text-xl font-bold text-mist-100">Daily Operations</h2>
            <p class="mt-1 text-xs text-mist-400">Active Stays</p>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <!-- Arriving Today -->
            <div class="shadow-md">
                <div
                    class="h-full flex flex-col space-y-3 rounded-md border border-mist-800 bg-mist-900 p-4">
                    <div
                        class="flex items-center justify-between border-b border-mist-800 pb-4 mb-4">
                        <h3 class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                            Arriving Today
                        </h3>
                        <span
                            class="rounded-md bg-mist-500/20 px-2 py-0.5 text-[10px] font-bold text-mist-400">
                            {{ todaysArrivals.length }}
                        </span>
                    </div>
                    <div
                        v-if="todaysArrivals.length === 0"
                        class="flex flex-1 items-center justify-center text-center text-xs text-mist-500 min-h-15">
                        No arrivals scheduled for today.
                    </div>
                    <div
                        v-else
                        class="divide-y divide-mist-800">
                        <div
                            v-for="b in todaysArrivals"
                            :key="b.id"
                            class="space-y-2 py-4 first:pt-0 last:pb-0">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                    <span class="font-semibold text-sm text-mist-200">
                                        {{ b.guestName }}
                                    </span>
                                    <button
                                        type="button"
                                        class="cursor-pointer text-xs text-mist-400 hover:text-mist-100"
                                        @click="handleEditBooking(b)">
                                        <fa-icon icon="pen-to-square" />
                                    </button>
                                </div>
                                <span class="text-xs font-medium text-mist-400">
                                    {{ b.listing }}
                                </span>
                            </div>
                            <div class="flex justify-between text-xs text-mist-400">
                                <span>
                                    {{ formatDate(b.checkIn, { shortMonth: true }) }}
                                    &rarr;
                                    {{ formatDate(b.checkOut, { shortMonth: true }) }} &bull;
                                    {{ b.nights }} night(s)
                                </span>
                                <span class="font-mono text-lime-400">
                                    {{ formatIDR(b.payout) }}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <!-- Current Stays -->
            <div class="shadow-md">
                <div
                    class="h-full flex flex-col space-y-3 rounded-md border border-mist-800 bg-mist-900 p-4">
                    <div
                        class="flex items-center justify-between border-b border-mist-800 pb-4 mb-4">
                        <h3 class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                            Currently Staying
                        </h3>
                        <span
                            class="rounded-md bg-mist-500/20 px-2 py-0.5 text-[10px] font-bold text-mist-400">
                            {{ currentStays.length }}
                        </span>
                    </div>
                    <div
                        v-if="currentStays.length === 0"
                        class="flex flex-1 items-center justify-center text-center text-xs text-mist-500">
                        No guests currently in-house.
                    </div>
                    <div
                        v-else
                        class="divide-y divide-mist-800">
                        <div
                            v-for="b in currentStays"
                            :key="b.id"
                            class="space-y-2 py-4 first:pt-0 last:pb-0">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                    <span class="font-semibold text-sm text-mist-200">
                                        {{ b.guestName }}
                                    </span>
                                    <button
                                        type="button"
                                        class="cursor-pointer text-xs text-mist-400 hover:text-mist-100"
                                        @click="handleEditBooking(b)">
                                        <fa-icon icon="pen-to-square" />
                                    </button>
                                </div>
                                <span class="text-xs font-medium text-mist-400">
                                    {{ b.listing }}
                                </span>
                            </div>
                            <div class="flex justify-between text-xs text-mist-400">
                                <span>
                                    {{ formatDate(b.checkIn, { shortMonth: true }) }}
                                    &rarr;
                                    {{ formatDate(b.checkOut, { shortMonth: true }) }} &bull;
                                    {{ b.nights }} night(s)
                                </span>
                                <span class="font-mono text-lime-400">
                                    {{ formatIDR(b.payout) }}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <!-- Today's Departures -->
            <div class="shadow-md">
                <div
                    class="h-full flex flex-col space-y-3 rounded-md border border-mist-800 bg-mist-900 p-4">
                    <div
                        class="flex items-center justify-between border-b border-mist-800 pb-4 mb-4">
                        <h3 class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                            Today's Departures
                        </h3>
                        <span
                            class="rounded-md bg-mist-500/20 px-2 py-0.5 text-[10px] font-bold text-mist-400">
                            {{ todaysDepartures.length }}
                        </span>
                    </div>
                    <div
                        v-if="todaysDepartures.length === 0"
                        class="flex flex-1 items-center justify-center text-center text-xs text-mist-500">
                        No departures scheduled for today.
                    </div>
                    <div
                        v-else
                        class="divide-y divide-mist-800">
                        <div
                            v-for="b in todaysDepartures"
                            :key="b.id"
                            class="space-y-2 py-4 first:pt-0 last:pb-0">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                    <span class="font-semibold text-sm text-mist-200">
                                        {{ b.guestName }}
                                    </span>
                                    <button
                                        type="button"
                                        class="cursor-pointer text-xs text-mist-400 hover:text-mist-100"
                                        @click="handleEditBooking(b)">
                                        <fa-icon icon="pen-to-square" />
                                    </button>
                                </div>
                                <span class="text-xs font-medium text-mist-400">
                                    {{ b.listing }}
                                </span>
                            </div>
                            <div class="flex justify-between text-xs text-mist-400">
                                <span>
                                    {{ formatDate(b.checkIn, { shortMonth: true }) }}
                                    &rarr;
                                    {{ formatDate(b.checkOut, { shortMonth: true }) }} &bull;
                                    {{ b.nights }} night(s)
                                </span>
                                <span class="font-mono text-lime-400">
                                    {{ formatIDR(b.payout) }}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Upcoming Bookings -->
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mt-8">
            <div>
                <h2 class="text-xl font-bold text-mist-100">Upcoming Bookings</h2>
                <p class="mt-1 text-xs text-mist-400">Starting from {{ currentMonth }}</p>
            </div>

            <button
                type="button"
                class="rounded-md bg-lime-500 px-4 py-2 text-xs font-semibold text-mist-950 hover:bg-lime-400"
                @click="handleAddBooking(selectedPropertyId as PropertyId)">
                <fa-icon icon="plus" /> Add Booking
            </button>
        </div>
        <div
            v-if="groupedBookings.length === 0"
            class="rounded-md border border-dashed border-mist-800 p-12 text-center">
            <p class="text-sm text-mist-400">No reservations matching current filters</p>
        </div>
        <div
            v-else
            class="overflow-x-auto rounded-md border border-mist-800 bg-mist-900 shadow-md">
            <table class="w-full text-left text-sm text-mist-300 table-fixed">
                <thead
                    class="border-b border-mist-800 bg-mist-950/60 text-[11px] uppercase text-mist-500">
                    <tr>
                        <th class="w-40 px-4 py-2.5">ID</th>
                        <th class="w-32 px-4 py-2.5 text-center">Channel</th>
                        <th class="px-4 py-2.5">Guest</th>
                        <th class="w-50 px-4 py-2.5 text-center">Stay Date</th>
                        <th class="w-28 px-4 py-2.5 text-center">Nights</th>
                        <th class="w-38 px-4 py-2.5 text-right">Payout</th>
                        <th class="w-40 px-4 py-2.5 text-center">Status</th>
                        <th class="w-28 px-4 py-2.5 text-right">Actions</th>
                    </tr>
                </thead>
                <template
                    v-for="group in groupedBookings"
                    :key="group.key">
                    <tbody class="border-t border-mist-800 bg-mist-950/40">
                        <tr>
                            <td
                                colspan="8"
                                class="p-0">
                                <button
                                    type="button"
                                    class="flex w-full items-center justify-between px-4 py-2.5 font-bold text-mist-200 hover:bg-mist-800/40"
                                    @click="toggleMonth(group.key)">
                                    <span class="flex items-center gap-2">
                                        <span class="text-xs text-mist-400">
                                            {{ collapsedMonths.includes(group.key) ? '▶' : '▼' }}
                                        </span>
                                        {{ group.label }}
                                    </span>
                                    <span
                                        class="rounded-md bg-mist-800 px-2.5 py-0.5 text-xs font-normal text-mist-400">
                                        {{ group.count }}
                                    </span>
                                </button>
                            </td>
                        </tr>
                    </tbody>
                    <tbody
                        v-show="!collapsedMonths.includes(group.key)"
                        class="divide-y divide-mist-800/60">
                        <tr
                            v-for="b in group.bookings"
                            :key="b.id || b.bookingId"
                            :class="[
                                'transition',
                                isCurrentBooking(b.checkIn, b.checkOut, b.status)
                                    ? 'bg-mist-800 font-medium ring-1 ring-inset ring-mist-500/40 hover:bg-mist-900/30'
                                    : 'hover:bg-mist-800/30',
                            ]">
                            <td class="px-4 py-3 font-mono text-lime-400 truncate text-xs">
                                {{ b.status === 'Unavailable' ? '-' : b.bookingId }}
                            </td>
                            <td class="px-4 py-3 text-center text-nowrap">
                                <span
                                    class="rounded-md bg-mist-800 px-2 py-0.5 text-xs text-mist-300 text-nowrap">
                                    {{ b.listing }}
                                </span>
                            </td>
                            <td class="px-4 py-3 font-medium text-mist-100 truncate">
                                {{ b.guestName }}
                            </td>
                            <td class="px-4 py-3 text-center">
                                {{ formatDate(b.checkIn, { shortMonth: true }) }}
                                &rarr;
                                {{ formatDate(b.checkOut, { shortMonth: true }) }}
                            </td>
                            <td class="px-4 py-3 font-mono text-center">{{ b.nights }}</td>

                            <td
                                class="px-4 py-3 font-mono text-right text-nowrap group relative"
                                :class="{ 'cursor-zoom-in': b.payout !== 0 }">
                                {{ formatIDR(b.payout) }}
                                <div
                                    v-if="b.payout !== 0"
                                    class="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 w-50 -translate-x-1/2 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100">
                                    <div
                                        class="rounded-md border border-mist-700 bg-mist-900 p-2.5 text-xs text-mist-100 shadow-xl">
                                        <div class="flex items-center justify-between">
                                            <span class="font-bold text-mist-200">
                                                Payout 15%
                                            </span>
                                            <span class="font-semibold text-mist-400">
                                                {{ formatIDR(b.payout * 0.15) }}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </td>
                            <td class="px-4 py-3 text-center text-nowrap">
                                <span
                                    :class="[
                                        'rounded-md px-2 py-0.5 text-xs text-nowrap',
                                        b.status === 'Booked'
                                            ? 'bg-lime-500/20 text-lime-400'
                                            : b.status === 'Checked-in'
                                              ? 'bg-blue-500/20 text-blue-400'
                                              : b.status === 'Waiting for payout'
                                                ? 'bg-sky-500/20 text-sky-400'
                                                : b.status === 'Waiting for payment'
                                                  ? 'bg-amber-500/20 text-amber-400'
                                                  : b.status === 'Unavailable'
                                                    ? 'bg-rose-500/20 text-rose-400'
                                                    : 'bg-mist-800 text-mist-400',
                                    ]">
                                    {{ b.status }}
                                </span>
                            </td>
                            <td class="px-4 py-3 text-right">
                                <div class="flex items-center justify-end gap-2">
                                    <button
                                        type="button"
                                        class="cursor-pointer text-mist-400 hover:text-mist-100"
                                        @click="handleEditBooking(b)">
                                        <fa-icon icon="pen-to-square" />
                                    </button>
                                    <span class="text-mist-700">|</span>
                                    <button
                                        type="button"
                                        class="cursor-pointer text-rose-400 hover:text-rose-300"
                                        @click="handleDeleteBooking(b)">
                                        <fa-icon icon="trash-can" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </template>
            </table>
        </div>
    </div>
</template>
