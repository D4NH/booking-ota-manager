<!-- src/views/BookingsView.vue -->
<script setup lang="ts">
import { ref, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useBookingStore } from '@/stores/useBookingStore';
import { useGoogleSheets } from '@/composables/useGoogleSheets';
import type { Booking } from '@/db';
import { PROPERTY_LIST, type PropertyId } from '@/config/properties';

import AddBookingModal from '@/components/AddBookingModal.vue';
import GoogleSyncButton from '@/components/GoogleSyncButton.vue';

const bookingStore = useBookingStore();

const { bookings } = storeToRefs(bookingStore);

const { appendSheetRow, updateSheetRowByBookingId, deleteSheetRowByBookingId } = useGoogleSheets();

// Filters & Local State
const selectedProperty = ref<PropertyId | 'all'>('all');
const selectedMonth = ref<string>('all');
const searchQuery = ref<string>('');
const hiddenStatuses = ref<Booking['status'][]>(['Completed', 'Unavailable', 'No show']);
const collapsedMonths = ref<string[]>([]);

const isBookingModalOpen = ref<boolean>(false);
const bookingToEdit = ref<Booking | null>(null);
const syncStatus = ref<string>('');

const validStatuses: Booking['status'][] = [
    'Booked',
    'Checked-in',
    'Waiting for payment',
    'Completed',
    'No show',
    'Unavailable',
];

// Toggle Inverse Status Filter
const toggleStatusVisibility = (status: Booking['status']): void => {
    const index = hiddenStatuses.value.indexOf(status);
    if (index > -1) {
        hiddenStatuses.value.splice(index, 1);
    } else {
        hiddenStatuses.value.push(status);
    }
};

// Toggle Collapsible Month Headers
const toggleMonth = (monthKey: string): void => {
    const index = collapsedMonths.value.indexOf(monthKey);
    if (index > -1) {
        collapsedMonths.value.splice(index, 1);
    } else {
        collapsedMonths.value.push(monthKey);
    }
};

const formatMonthHeader = (monthKey: string): string => {
    const [year, month] = monthKey.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

const availableMonths = computed(() => {
    const months = bookings.value.map((b) => b.checkIn.substring(0, 7));
    const uniqueMonths = months.filter((m, i) => months.indexOf(m) === i);
    return uniqueMonths.sort((a, b) => a.localeCompare(b));
});

// Filtered Bookings sorted Oldest to Newest (Ascending checkIn)
const filteredBookings = computed(() => {
    const query = searchQuery.value.trim().toLowerCase();

    return bookings.value
        .filter((b) => {
            if (selectedProperty.value !== 'all' && b.propertyId !== selectedProperty.value)
                return false;
            if (selectedMonth.value !== 'all' && !b.checkIn.startsWith(selectedMonth.value))
                return false;
            if (hiddenStatuses.value.includes(b.status)) return false;
            if (query) {
                const matchName = b.guestName.toLowerCase().includes(query);
                const matchId = b.bookingId.toLowerCase().includes(query);
                const matchNotes = b.notes?.toLowerCase().includes(query) || false;
                if (!matchName && !matchId && !matchNotes) return false;
            }
            return true;
        })
        .sort((a, b) => a.checkIn.localeCompare(b.checkIn));
});

// Grouped Bookings by Month
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
            label: formatMonthHeader(key),
            count: groups[key]?.length,
            bookings: groups[key],
        }));
});

// Handlers
const openAddModal = (): void => {
    bookingToEdit.value = null;
    isBookingModalOpen.value = true;
};
const openEditModal = (booking: Booking): void => {
    bookingToEdit.value = booking;
    isBookingModalOpen.value = true;
};
const handleSaveBooking = async (payload: Omit<Booking, 'id' | 'createdAt'>): Promise<void> => {
    try {
        if (bookingToEdit.value) {
            syncStatus.value = 'Syncing update...';
            await bookingStore.updateBookingWithRemoteSync(
                { ...bookingToEdit.value, ...payload },
                { updateSheetRowByBookingId }
            );
            syncStatus.value = 'Booking updated locally & in Google Sheets.';
        } else {
            syncStatus.value = 'Syncing new booking...';
            await bookingStore.addBookingWithRemoteSync(payload, { appendSheetRow });
            syncStatus.value = 'Booking saved locally & in Google Sheets.';
        }
    } catch (err) {
        console.error('Save Sync Error:', err);
        syncStatus.value = 'Saved locally, but Google Sheet sync failed.';
    } finally {
        setTimeout(() => (syncStatus.value = ''), 4000);
    }
};
const handleDeleteBooking = async (booking: Booking): Promise<void> => {
    if (!window.confirm(`Delete booking ${booking.bookingId} (${booking.guestName})?`)) return;

    try {
        syncStatus.value = 'Syncing deletion...';
        await bookingStore.deleteBookingWithRemoteSync(booking, { deleteSheetRowByBookingId });
        syncStatus.value = `Booking ${booking.bookingId} deleted locally & in Google Sheets.`;
    } catch (err) {
        console.error('Delete Sync Error:', err);
        syncStatus.value = 'Deleted locally, but Google Sheet sync failed.';
    } finally {
        setTimeout(() => (syncStatus.value = ''), 4000);
    }
};
const handleClearAllLocal = async (): Promise<void> => {
    if (!window.confirm('Wipe ALL local bookings? (Google Sheets files will remain untouched)'))
        return;

    try {
        await bookingStore.clearAllLocalBookings();
        syncStatus.value = 'All local bookings cleared.';
    } catch (err) {
        console.error('Clear DB Error:', err);
        syncStatus.value = 'Failed to clear local data.';
    } finally {
        setTimeout(() => (syncStatus.value = ''), 3000);
    }
};
</script>

<template>
    <div class="space-y-6 p-6">
        <!-- Header -->
        <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
                <h1 class="text-xl font-bold text-mist-100">Reservations</h1>
                <p class="text-xs text-mist-400">
                    Showing {{ filteredBookings.length }} of {{ bookings.length }} total bookings
                </p>
            </div>

            <div class="flex items-center gap-3">
                <button
                    type="button"
                    class="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/20"
                    @click="handleClearAllLocal">
                    Clear Local DB
                </button>
                <GoogleSyncButton :property-id="selectedProperty" />
                <button
                    type="button"
                    class="rounded-lg bg-lime-500 px-4 py-2 text-xs font-semibold text-mist-950 hover:bg-lime-400"
                    @click="openAddModal">
                    + Add Booking
                </button>
            </div>
        </div>

        <!-- Status Alert -->
        <div
            v-if="syncStatus"
            class="rounded-lg border border-lime-500/30 bg-lime-500/10 p-3 text-xs text-lime-300">
            ℹ️ {{ syncStatus }}
        </div>

        <!-- Filter Bar -->
        <div class="space-y-3 rounded-xl border border-mist-800 bg-mist-900 p-4">
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                    <label class="mb-1 block text-xs font-medium text-mist-400">Property</label>
                    <select
                        v-model="selectedProperty"
                        class="w-full rounded-lg border border-mist-700 bg-mist-950 px-3 py-1.5 text-xs text-mist-200 focus:border-lime-500 focus:outline-none">
                        <option value="all">All Properties</option>
                        <option
                            v-for="prop in PROPERTY_LIST"
                            :key="prop.id"
                            :value="prop.id">
                            {{ prop.name }}
                        </option>
                    </select>
                </div>

                <div>
                    <label class="mb-1 block text-xs font-medium text-mist-400">Filter Month</label>
                    <select
                        v-model="selectedMonth"
                        class="w-full rounded-lg border border-mist-700 bg-mist-950 px-3 py-1.5 text-xs text-mist-200 focus:border-lime-500 focus:outline-none">
                        <option value="all">All Months</option>
                        <option
                            v-for="mKey in availableMonths"
                            :key="mKey"
                            :value="mKey">
                            {{ formatMonthHeader(mKey) }}
                        </option>
                    </select>
                </div>

                <div>
                    <label class="mb-1 block text-xs font-medium text-mist-400">Search</label>
                    <input
                        v-model="searchQuery"
                        type="text"
                        placeholder="Search guest, ID or notes..."
                        class="w-full rounded-lg border border-mist-700 bg-mist-950 px-3 py-1.5 text-xs text-mist-200 placeholder:text-mist-600 focus:border-lime-500 focus:outline-none" />
                </div>
            </div>

            <!-- Inverse Status Filter -->
            <div class="flex flex-wrap items-center gap-2 pt-2 border-t border-mist-800">
                <span class="text-xs font-medium text-mist-400">Filter:</span>
                <button
                    v-for="status in validStatuses"
                    :key="status"
                    type="button"
                    :class="[
                        'rounded-full px-2.5 py-1 text-xs border transition',
                        hiddenStatuses.includes(status)
                            ? 'border-rose-500/40 bg-rose-500/10 text-rose-400 line-through'
                            : 'border-mist-700 bg-mist-800 text-mist-300 hover:border-mist-600',
                    ]"
                    @click="toggleStatusVisibility(status)">
                    {{ status }}
                </button>
            </div>
        </div>

        <!-- Empty State -->
        <div
            v-if="groupedBookings.length === 0"
            class="rounded-xl border border-dashed border-mist-800 p-12 text-center">
            <p class="text-sm text-mist-400">No reservations matching current filters</p>
        </div>

        <!-- Grouped Table View with Perfect Alignment -->
        <div
            v-else
            class="overflow-x-auto rounded-xl border border-mist-800 bg-mist-900 shadow-lg">
            <table class="w-full text-left text-xs text-mist-300 table-fixed">
                <thead
                    class="border-b border-mist-800 bg-mist-950/60 text-[11px] uppercase tracking-wider text-mist-500">
                    <tr>
                        <th class="w-42 px-4 py-2.5">ID</th>
                        <th class="w-28 px-4 py-2.5 text-center">Channel</th>
                        <th class="w-28 px-4 py-2.5 text-center">Property</th>
                        <th class="px-4 py-2.5">Guest</th>
                        <th class="w-32 px-4 py-2.5 text-center">Check In</th>
                        <th class="w-32 px-4 py-2.5 text-center">Check Out</th>
                        <th class="w-28 px-4 py-2.5 text-center">Nights</th>
                        <th class="w-32 px-4 py-2.5 text-center">Payout</th>
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
                                colspan="10"
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
                            class="hover:bg-mist-800/30">
                            <td class="px-4 py-3 font-mono text-lime-400 truncate">
                                {{ b.bookingId }}
                            </td>
                            <td class="px-4 py-3 text-center">
                                <span
                                    class="rounded bg-mist-800 px-2 py-0.5 text-[10px] text-mist-300">
                                    {{ b.listing }}
                                </span>
                            </td>
                            <td class="px-4 py-3 text-center">
                                <span
                                    class="rounded bg-slate-800/80 border border-slate-700/60 px-2 py-0.5 text-[10px] font-semibold text-slate-300 capitalize">
                                    {{ b.propertyId }}
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

                            <td class="px-4 py-3 font-mono text-center">
                                Rp {{ b.payout.toLocaleString('id-ID') }}
                            </td>
                            <td class="px-4 py-3 text-center">
                                <span
                                    :class="[
                                        'rounded px-2 py-0.5 text-[10px] font-semibold',
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
                                        class="text-mist-400 hover:text-mist-100"
                                        @click="openEditModal(b)">
                                        Edit
                                    </button>
                                    <span class="text-mist-700">|</span>
                                    <button
                                        type="button"
                                        class="text-rose-400 hover:text-rose-300"
                                        @click="handleDeleteBooking(b)">
                                        Delete
                                    </button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </template>
            </table>
        </div>

        <!-- Booking Modal -->
        <AddBookingModal
            v-if="isBookingModalOpen"
            :booking-to-edit="bookingToEdit"
            @close="isBookingModalOpen = false"
            @save="handleSaveBooking" />
    </div>
</template>
