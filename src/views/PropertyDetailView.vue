<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useRoute } from 'vue-router';
import { useBookingSync } from '@/composables/useBookingSync';
import { useDateKeys } from '@/composables/useDateKeys';
import { useBookingStore } from '@/stores/useBookingStore';
import { PROPERTY_CONFIGS } from '@/config/properties';
import type { Booking } from '@/types/booking';
import type { PropertyId } from '@/types/property';
import { formatIDR } from '@/utils/money';
import { formatDate } from '@/utils/date';

import BookingModal from '@/components/BookingModal.vue';

const route = useRoute();
const bookingStore = useBookingStore();
const { bookings } = storeToRefs(bookingStore);

const { syncStatus, saveBooking, deleteBooking } = useBookingSync();
const { todayStr } = useDateKeys();

const isBookingModalOpen = ref<boolean>(false);
const bookingToEdit = ref<Booking | null>(null);
const routePropertyId = route.params.id as PropertyId | undefined;
const selectedProperty = ref<PropertyId | 'all'>(routePropertyId || 'all');
const selectedMonth = ref<string>('all');
const searchQuery = ref<string>('');
const hiddenStatuses = ref<Booking['status'][]>(['Completed', 'Unavailable', 'No show']);
const collapsedMonths = ref<string[]>([]);

const currentPropertyId = computed<PropertyId>(() => {
    const paramId = route.params.id as string;

    if (paramId && paramId in PROPERTY_CONFIGS) {
        return paramId as PropertyId;
    }
    return 'piyungan';
});
const filteredBookings = computed(() => {
    const query = searchQuery.value.trim().toLowerCase();
    const prop = selectedProperty.value;
    const month = selectedMonth.value;
    const hidden = hiddenStatuses.value;

    return bookings.value
        .filter((b) => {
            if (prop !== 'all' && b.propertyId !== prop) return false;
            if (month !== 'all' && !b.checkIn.startsWith(month)) return false;
            if (hidden.includes(b.status)) return false;
            if (query) {
                const matchName = b.guestName.toLowerCase().includes(query);
                if (matchName) return true;
                const matchId = b.bookingId.toLowerCase().includes(query);
                if (matchId) return true;
                const matchNotes = b.notes ? b.notes.toLowerCase().includes(query) : false;
                if (matchNotes) return true;
                return false;
            }
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

const isCurrentBooking = (checkIn: string, checkOut: string, status: string): boolean =>
    todayStr.value >= checkIn && todayStr.value <= checkOut && status !== 'Waiting for payout';
const toggleMonth = (monthKey: string) => {
    const index = collapsedMonths.value.indexOf(monthKey);

    if (index > -1) {
        collapsedMonths.value.splice(index, 1);
    } else {
        collapsedMonths.value.push(monthKey);
    }
};
const handleAddBooking = () => {
    bookingToEdit.value = null;
    isBookingModalOpen.value = true;
};
const handleEditBooking = (booking: Booking) => {
    bookingToEdit.value = booking;
    isBookingModalOpen.value = true;
};
const handleSaveBooking = async (payload: Omit<Booking, 'id' | 'createdAt'>): Promise<void> => {
    const success = await saveBooking(payload, bookingToEdit.value);
    if (success) {
        isBookingModalOpen.value = false;
        bookingToEdit.value = null;
    }
};
const handleDeleteBooking = async (booking: Booking): Promise<void> => {
    await deleteBooking(booking);
};

watch(
    () => route.params.id,
    (newId) => {
        selectedProperty.value = (newId as PropertyId) || 'all';
    }
);
</script>

<template>
    <div class="mx-auto max-w-7xl space-y-4">
        <div
            v-if="syncStatus"
            class="rounded-lg border border-lime-500/30 bg-lime-500/10 p-3 text-xs text-lime-300">
            {{ syncStatus }}
        </div>

        <!-- Upcoming Bookings -->
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mt-12">
            <div>
                <h1 class="text-xl font-bold text-mist-100">Upcoming bookings</h1>
                <p class="text-xs text-mist-400">Check all bookings [here]</p>
            </div>

            <button
                type="button"
                class="rounded-lg bg-lime-500 px-4 py-2 text-xs font-semibold text-mist-950 hover:bg-lime-400"
                @click="handleAddBooking">
                <fa-icon icon="plus" /> Add Booking
            </button>
        </div>
        <div
            v-if="groupedBookings.length === 0"
            class="rounded-lg border border-dashed border-mist-800 p-12 text-center">
            <p class="text-sm text-mist-400">No reservations matching current filters</p>
        </div>
        <div
            v-else
            class="overflow-x-auto rounded-lg border border-mist-800 bg-mist-900 shadow-lg">
            <table class="w-full text-left text-sm text-mist-300 table-fixed">
                <thead
                    class="border-b border-mist-800 bg-mist-950/60 text-[11px] uppercase text-mist-500">
                    <tr>
                        <th class="w-40 px-4 py-2.5">ID</th>
                        <th class="w-32 px-4 py-2.5 text-center">Channel</th>
                        <th class="px-4 py-2.5">Guest</th>
                        <th class="w-32 px-4 py-2.5 text-center">Check In</th>
                        <th class="w-32 px-4 py-2.5 text-center">Check Out</th>
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
                                colspan="9"
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
                                        class="rounded-full bg-mist-800 px-2.5 py-0.5 text-xs font-normal text-mist-400">
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
                                {{ b.bookingId }}
                            </td>
                            <td class="px-4 py-3 text-center text-nowrap">
                                <span
                                    class="rounded bg-mist-800 px-2 py-0.5 text-xs text-mist-300 text-nowrap">
                                    {{ b.listing }}
                                </span>
                            </td>
                            <td class="px-4 py-3 font-medium text-mist-100 truncate">
                                {{ b.guestName }}
                            </td>
                            <td class="px-4 py-3 text-center">
                                {{ b.checkIn }}
                            </td>
                            <td class="px-4 py-3 text-center">
                                {{ b.checkOut }}
                            </td>
                            <td class="px-4 py-3 font-mono text-center">{{ b.nights }}</td>

                            <td class="px-4 py-3 font-mono text-right text-nowrap">
                                {{ formatIDR(b.payout) }}
                            </td>
                            <td class="px-4 py-3 text-center text-nowrap">
                                <span
                                    :class="[
                                        'rounded px-2 py-0.5 text-xs',
                                        b.status === 'Booked'
                                            ? 'bg-lime-500/20 text-lime-400'
                                            : b.status === 'Checked-in'
                                              ? 'bg-blue-500/20 text-blue-400'
                                              : b.status === 'Waiting for payment'
                                                ? 'bg-amber-500/20 text-amber-400'
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

        <BookingModal
            v-if="isBookingModalOpen"
            :booking-to-edit="bookingToEdit"
            :current-property="currentPropertyId"
            @close="isBookingModalOpen = false"
            @save="handleSaveBooking" />
    </div>
</template>
