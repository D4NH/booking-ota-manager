<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useBookingStore } from '@/stores/useBookingStore';
import { useGoogleSheets } from '@/composables/useGoogleSheets';
import { PROPERTY_CONFIGS, PROPERTY_LIST, type PropertyId } from '@/config/properties';
import AddBookingModal from '@/components/AddBookingModal.vue';
import GoogleSyncButton from '@/components/GoogleSyncButton.vue';
import type { Booking } from '@/db';

const bookingStore = useBookingStore();
const { bookings, isLoading } = storeToRefs(bookingStore);

const {
    accessToken,
    isAuthorizing,
    authError,
    initAuth,
    clearToken,
    fetchSheetRows,
    appendSheetRow,
    deleteSheetRowByBookingId,
} = useGoogleSheets();

const syncStatus = ref<string>('');
const isModalOpen = ref<boolean>(false);
const showSyncButtons = ref<boolean>(false);
const bookingToEdit = ref<Booking | null>(null);

// Filter States
const selectedPropertyFilter = ref<string>('all');
const selectedStatusFilter = ref<string>('all');
const getCurrentMonthString = (): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
};
const selectedMonthFilter = ref<string>(getCurrentMonthString());
const searchQuery = ref<string>('');

const availableMonths = computed(() => {
    const months = new Set<string>();
    bookings.value.forEach((b) => {
        if (b.checkIn) {
            months.add(b.checkIn.slice(0, 7)); // Extracts 'YYYY-MM'
        }
    });
    return Array.from(months).sort().reverse();
});

const formatMonthLabel = (monthStr: string): string => {
    const [year, month] = monthStr.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
};

const filteredBookings = computed(() => {
    const filtered = bookings.value.filter((b) => {
        const matchesProperty =
            selectedPropertyFilter.value === 'all' || b.propertyId === selectedPropertyFilter.value;

        const matchesStatus =
            selectedStatusFilter.value === 'all' || b.status === selectedStatusFilter.value;

        const matchesMonth =
            selectedMonthFilter.value === 'all' || b.checkIn.startsWith(selectedMonthFilter.value);

        const matchesSearch =
            !searchQuery.value.trim() ||
            b.guestName.toLowerCase().includes(searchQuery.value.trim().toLowerCase()) ||
            b.bookingId.toLowerCase().includes(searchQuery.value.trim().toLowerCase());

        return matchesProperty && matchesStatus && matchesMonth && matchesSearch;
    });

    // Sort by Check-in Date Ascending (Oldest on top)
    return filtered.sort((a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime());
});

const resetFilters = (): void => {
    selectedPropertyFilter.value = 'all';
    selectedStatusFilter.value = 'all';
    selectedMonthFilter.value = 'all';
    searchQuery.value = '';
};

const handleConnectGoogle = async (): Promise<void> => {
    try {
        if (accessToken.value) {
            clearToken();
            syncStatus.value = 'Disconnected Google Drive.';
            return;
        }
        await initAuth();
        syncStatus.value = 'Connected Google Drive successfully.';
    } catch (err) {
        console.error('OAuth connection error:', err);
    }
};

const handleSyncPropertyFile = async (propertyId: PropertyId): Promise<void> => {
    const config = PROPERTY_CONFIGS[propertyId];

    if (!config?.spreadsheetId) {
        syncStatus.value = `Missing spreadsheet ID for ${config?.name || propertyId} in .env.local`;
        return;
    }

    syncStatus.value = `Fetching ${config.name}...`;

    try {
        const rows = await fetchSheetRows(config.spreadsheetId, config.defaultRange);

        if (rows.length === 0) {
            syncStatus.value = `No records found in ${config.name}.`;
            return;
        }

        const { added, updated } = await bookingStore.importFromGoogleSheetRows(rows, propertyId);
        syncStatus.value = `${config.name} synced: ${added} added, ${updated} updated.`;
    } catch (err) {
        console.error(`Sync error for ${propertyId}:`, err);
        syncStatus.value = `Failed to sync ${config.name}.`;
    }
};

const handleSyncAllFiles = async (): Promise<void> => {
    syncStatus.value = 'Syncing all property files...';
    let totalAdded = 0;
    let totalUpdated = 0;

    const propertyKeys: PropertyId[] = ['piyungan', 'wonosari', 'imogiri'];

    try {
        for (const propId of propertyKeys) {
            const config = PROPERTY_CONFIGS[propId];
            if (!config?.spreadsheetId) continue;

            syncStatus.value = `Syncing ${config.name}...`;
            const rows = await fetchSheetRows(config.spreadsheetId, config.defaultRange);

            if (rows.length > 0) {
                const { added, updated } = await bookingStore.importFromGoogleSheetRows(
                    rows,
                    propId
                );
                totalAdded += added;
                totalUpdated += updated;
            }
        }

        syncStatus.value = `Batch sync complete: ${totalAdded} added, ${totalUpdated} updated.`;
    } catch (err) {
        console.error('Batch sync error:', err);
        syncStatus.value = 'Batch sync failed.';
    }
};

// Clear All Local Records
const handleClearAll = async (): Promise<void> => {
    const confirmed = confirm(
        'Are you sure you want to delete ALL local booking records?\n\nThis will clear your local database. You can re-sync from Google Sheets anytime.'
    );
    if (confirmed) {
        await bookingStore.clearAllBookings();
        syncStatus.value = 'All local records cleared.';
    }
};

const openAddModal = (): void => {
    bookingToEdit.value = null;
    isModalOpen.value = true;
};

const openEditModal = (booking: Booking): void => {
    bookingToEdit.value = booking;
    isModalOpen.value = true;
};

const handleSaveBooking = async (payload: Omit<Booking, 'id' | 'createdAt'>): Promise<void> => {
    try {
        if (bookingToEdit.value) {
            await bookingStore.updateBooking({ ...bookingToEdit.value, ...payload });
            syncStatus.value = 'Booking updated locally.';
        } else {
            await bookingStore.addBookingWithRemoteSync(
                payload,
                accessToken.value ? { appendSheetRow } : undefined
            );
            syncStatus.value = 'New booking saved and queued to Drive.';
        }
    } catch (err) {
        console.error('Save error:', err);
        syncStatus.value = 'Error saving booking record.';
    }
};

const handleDeleteBooking = async (booking: Booking): Promise<void> => {
    const confirmed = confirm(`Remove reservation for ${booking.guestName}?`);
    if (!confirmed) return;

    try {
        syncStatus.value = 'Removing entry...';
        await bookingStore.deleteBookingWithRemoteSync(
            booking.id,
            booking.bookingId,
            booking.propertyId as PropertyId,
            accessToken.value ? { deleteSheetRowByBookingId } : undefined
        );
        syncStatus.value = 'Booking removed.';
    } catch (err) {
        console.error('Deletion error:', err);
        syncStatus.value = 'Failed to delete booking completely.';
    }
};

const getPropertyConfig = (id: string) => {
    return PROPERTY_CONFIGS[id as PropertyId] || { name: id, color: '#64748b' };
};

onMounted(async () => {
    // Fallback to 'all' if the current month has no records yet
    const hasCurrentMonthBookings = bookings.value.some((b) =>
        b.checkIn.startsWith(selectedMonthFilter.value)
    );
    if (!hasCurrentMonthBookings && bookings.value.length > 0) {
        selectedMonthFilter.value = 'all';
    }
});
</script>

<template>
    <div class="mx-auto max-w-7xl space-y-6">
        <div
            class="flex items-center justify-between rounded-lg border border-amber-500/20 bg-mist-950/60 px-3 py-2 text-xs">
            <ul class="list-disc list-outside ml-3">
                <li>Bookings via Trip.com need to be blocked in Tiket.com</li>
                <li>Bookings via Tiket.com need to be blocked in Airbnb.com</li>
            </ul>
        </div>

        <div
            class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-mist-800 pb-5">
            <div>
                <h1 class="text-xl font-bold tracking-tight text-mist-100">Bookings Dashboard</h1>
                <p class="text-xs text-mist-400">
                    Manage reservations across Mai House Jogja properties
                </p>
            </div>

            <div class="flex flex-wrap items-center gap-4">
                <button
                    type="button"
                    class="rounded-lg bg-white px-3.5 py-2 text-xs font-semibold text-mist-950 transition hover:bg-lime-400"
                    @click="showSyncButtons = !showSyncButtons">
                    <fa-icon icon="chevron-left" />
                </button>
                <div
                    v-if="showSyncButtons"
                    class="space-x-3">
                    <GoogleSyncButton variant="primary" />

                    <GoogleSyncButton
                        property-id="piyungan"
                        variant="outline"
                        @sync-complete="(res) => console.log('Synced Piyungan:', res)" />

                    <GoogleSyncButton
                        property-id="wonosari"
                        variant="outline"
                        @sync-complete="(res) => console.log('Synced Wonosari:', res)" />

                    <GoogleSyncButton
                        property-id="imogiri"
                        variant="outline"
                        @sync-complete="(res) => console.log('Synced Imogiri:', res)" />

                    <button
                        type="button"
                        class="rounded-lg border border-rose-900/50 bg-rose-950/40 px-3 py-2 text-xs font-semibold text-rose-400 transition hover:bg-rose-900/50"
                        @click="handleClearAll">
                        Clear Local DB
                    </button>
                </div>

                <button
                    type="button"
                    class="rounded-lg bg-lime-500 px-3.5 py-2 text-xs font-semibold text-mist-950 transition hover:bg-lime-400"
                    @click="openAddModal">
                    + Add Booking
                </button>
            </div>
        </div>

        <div class="text-xs font-medium text-mist-400">
            <span
                v-if="syncStatus"
                class="text-lime-400">
                {{ syncStatus }}
            </span>
            <span
                v-else-if="authError"
                class="text-rose-400">
                {{ authError }}
            </span>
            <span v-else>Ready</span>
        </div>

        <div
            class="grid grid-cols-1 gap-3 rounded-xl border border-mist-800 bg-mist-900 p-4 sm:grid-cols-2 lg:grid-cols-5">
            <div class="lg:col-span-2">
                <label class="mb-1 block text-[10px] uppercase font-bold text-mist-400">
                    Search Guest / ID
                </label>
                <input
                    v-model="searchQuery"
                    type="text"
                    placeholder="Type guest name or booking ID..."
                    class="w-full rounded-lg border border-mist-800 bg-mist-950 px-3 py-1.5 text-xs text-mist-200 placeholder:text-mist-600 focus:border-lime-500 focus:outline-none" />
            </div>

            <div>
                <label class="mb-1 block text-[10px] uppercase font-bold text-mist-400">
                    Month
                </label>
                <select
                    v-model="selectedMonthFilter"
                    class="w-full rounded-lg border border-mist-800 bg-mist-950 px-3 py-1.5 text-xs text-mist-200 focus:outline-none">
                    <option value="all">All Months</option>
                    <option
                        v-for="m in availableMonths"
                        :key="m"
                        :value="m">
                        {{ formatMonthLabel(m) }}
                    </option>
                </select>
            </div>

            <div>
                <label class="mb-1 block text-[10px] uppercase font-bold text-mist-400">
                    Status
                </label>
                <select
                    v-model="selectedStatusFilter"
                    class="w-full rounded-lg border border-mist-800 bg-mist-950 px-3 py-1.5 text-xs text-mist-200 focus:outline-none">
                    <option value="all">All Statuses</option>
                    <option value="Booked">Booked</option>
                    <option value="Checked-in">Checked-in</option>
                    <option value="Waiting for payment">Waiting for payment</option>
                    <option value="Waiting for payout">Waiting for payout</option>
                    <option value="Completed">Completed</option>
                    <option value="No show">No show</option>
                    <option value="Unavailable">Unavailable</option>
                </select>
            </div>

            <div>
                <div class="flex items-center justify-between mb-1">
                    <label class="text-[10px] uppercase font-bold text-mist-400">Property</label>
                    <button
                        type="button"
                        class="text-[10px] font-medium text-lime-400 hover:underline"
                        @click="resetFilters">
                        Reset All
                    </button>
                </div>
                <select
                    v-model="selectedPropertyFilter"
                    class="w-full rounded-lg border border-mist-800 bg-mist-950 px-3 py-1.5 text-xs text-mist-200 focus:outline-none">
                    <option value="all">All Properties</option>
                    <option
                        v-for="prop in PROPERTY_LIST"
                        :key="prop.id"
                        :value="prop.id">
                        {{ prop.name }}
                    </option>
                </select>
            </div>
        </div>

        <!-- Data Table -->
        <div class="overflow-x-auto rounded-xl border border-mist-800 bg-mist-900">
            <table class="w-full text-left text-xs">
                <thead
                    class="border-b border-mist-800 bg-mist-950/50 text-mist-400 uppercase tracking-wider">
                    <tr>
                        <th class="px-4 py-3">Property</th>
                        <th class="px-4 py-3">Booking ID</th>
                        <th class="px-4 py-3">Guest Name</th>
                        <th class="px-4 py-3">Dates</th>
                        <th class="px-4 py-3">Nights</th>
                        <th class="px-4 py-3">Channel</th>
                        <th class="px-4 py-3">Status</th>
                        <th class="px-4 py-3">Payout</th>
                        <th class="px-4 py-3 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-mist-800 text-mist-200">
                    <tr v-if="isLoading">
                        <td
                            colspan="9"
                            class="px-4 py-8 text-center text-mist-500">
                            Loading records...
                        </td>
                    </tr>
                    <tr v-else-if="filteredBookings.length === 0">
                        <td
                            colspan="9"
                            class="px-4 py-8 text-center text-mist-500">
                            No matching bookings found.
                        </td>
                    </tr>
                    <tr
                        v-for="booking in filteredBookings"
                        :key="booking.id"
                        class="hover:bg-mist-800/40 transition">
                        <td class="px-4 py-3 font-medium">
                            <span
                                class="capitalize inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold text-white"
                                :style="{
                                    backgroundColor: getPropertyConfig(booking.propertyId).color,
                                }">
                                {{ getPropertyConfig(booking.propertyId).id }}
                            </span>
                        </td>
                        <td class="px-4 py-3 font-mono font-semibold text-mist-300">
                            {{ booking.bookingId }}
                        </td>
                        <td class="px-4 py-3 font-medium">{{ booking.guestName }}</td>
                        <td class="px-4 py-3 text-mist-400">
                            {{ booking.checkIn }} &rarr; {{ booking.checkOut }}
                        </td>
                        <td class="px-4 py-3">{{ booking.nights }}</td>
                        <td class="px-4 py-3 text-mist-300">{{ booking.listing }}</td>
                        <td class="px-4 py-3">
                            <span
                                class="rounded bg-mist-800 px-2 py-0.5 text-[10px] font-medium text-mist-300">
                                {{ booking.status }}
                            </span>
                        </td>
                        <td class="px-4 py-3 font-mono text-lime-400">
                            Rp {{ booking.payout.toLocaleString() }}
                        </td>
                        <td class="px-4 py-3 text-right space-x-2">
                            <button
                                type="button"
                                class="text-mist-400 hover:text-mist-200"
                                @click="openEditModal(booking)">
                                Edit
                            </button>
                            <button
                                type="button"
                                class="text-rose-400 hover:text-rose-300"
                                @click="handleDeleteBooking(booking)">
                                Delete
                            </button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Add / Edit Modal -->
        <AddBookingModal
            v-if="isModalOpen"
            :booking-to-edit="bookingToEdit"
            @close="isModalOpen = false"
            @save="handleSaveBooking" />
    </div>
</template>
