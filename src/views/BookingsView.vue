<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useBookingStore } from '@/stores/useBookingStore';
import { useGoogleSheets } from '@/composables/useGoogleSheets';
import { PROPERTY_CONFIGS, PROPERTY_LIST, type PropertyId } from '@/config/properties';
import AddBookingModal from '@/components/AddBookingModal.vue';
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
const selectedPropertyFilter = ref<string>('all');
const isModalOpen = ref<boolean>(false);
const bookingToEdit = ref<Booking | null>(null);

onMounted(async () => {
    await bookingStore.initDatabase();
});

// Filtered Bookings List
const filteredBookings = computed(() => {
    if (selectedPropertyFilter.value === 'all') return bookings.value;
    return bookings.value.filter((b) => b.propertyId === selectedPropertyFilter.value);
});

// Auth Toggle Handler
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

// Single Property File Sync Handler
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

// Batch Sync All Property Files
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

// Create or Edit Booking Modal Handlers
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

// Delete Booking Handler
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

// Helper to get styled badge details
const getPropertyConfig = (id: string) => {
    return PROPERTY_CONFIGS[id as PropertyId] || { name: id, color: '#64748b' };
};
</script>

<template>
    <div class="min-h-screen bg-mist-950 p-6 text-mist-100">
        <div class="mx-auto max-w-7xl space-y-6">
            <!-- Top Action Bar -->
            <div
                class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-mist-800 pb-5">
                <div>
                    <h1 class="text-xl font-bold tracking-tight text-mist-100">
                        Bookings Dashboard
                    </h1>
                    <p class="text-xs text-mist-400">
                        Manage reservations across Mai House Jogja properties
                    </p>
                </div>

                <div class="flex flex-wrap items-center gap-2">
                    <!-- Auth Toggle Button -->
                    <button
                        type="button"
                        :disabled="isAuthorizing"
                        class="inline-flex items-center gap-2 rounded-lg border border-mist-700 bg-mist-900 px-3 py-2 text-xs font-semibold text-mist-200 transition hover:bg-mist-800 disabled:opacity-50"
                        @click="handleConnectGoogle">
                        <span
                            :class="[
                                'h-2 w-2 rounded-full',
                                accessToken ? 'bg-lime-400' : 'bg-mist-500',
                            ]"></span>
                        {{
                            isAuthorizing
                                ? 'Connecting...'
                                : accessToken
                                  ? 'Disconnect Google'
                                  : 'Connect Google'
                        }}
                    </button>

                    <!-- Sync Batch Button -->
                    <button
                        type="button"
                        class="rounded-lg bg-lime-500 px-3.5 py-2 text-xs font-semibold text-mist-950 transition hover:bg-lime-400"
                        @click="handleSyncAllFiles">
                        Sync All Files
                    </button>

                    <!-- Individual Property Sync Buttons -->
                    <button
                        type="button"
                        class="rounded-lg border border-mist-800 bg-mist-900 px-2.5 py-2 text-xs font-medium text-mist-300 transition hover:bg-mist-800"
                        @click="handleSyncPropertyFile('piyungan')">
                        Piyungan
                    </button>

                    <button
                        type="button"
                        class="rounded-lg border border-mist-800 bg-mist-900 px-2.5 py-2 text-xs font-medium text-mist-300 transition hover:bg-mist-800"
                        @click="handleSyncPropertyFile('wonosari')">
                        Wonosari
                    </button>

                    <button
                        type="button"
                        class="rounded-lg border border-mist-800 bg-mist-900 px-2.5 py-2 text-xs font-medium text-mist-300 transition hover:bg-mist-800"
                        @click="handleSyncPropertyFile('imogiri')">
                        Imogiri
                    </button>

                    <!-- Clear All Local DB -->
                    <button
                        type="button"
                        class="rounded-lg border border-rose-900/50 bg-rose-950/40 px-3 py-2 text-xs font-semibold text-rose-400 transition hover:bg-rose-900/50"
                        @click="handleClearAll">
                        Clear Local
                    </button>

                    <!-- Add Booking Button -->
                    <button
                        type="button"
                        class="rounded-lg bg-mist-100 px-3.5 py-2 text-xs font-semibold text-mist-950 transition hover:bg-white"
                        @click="openAddModal">
                        + Add Booking
                    </button>
                </div>
            </div>

            <!-- Sync Status & Filters -->
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div class="text-xs font-medium text-mist-400">
                    <span
                        v-if="syncStatus"
                        class="text-lime-400"
                        >{{ syncStatus }}</span
                    >
                    <span
                        v-else-if="authError"
                        class="text-rose-400"
                        >{{ authError }}</span
                    >
                    <span v-else>Ready</span>
                </div>

                <div class="flex items-center gap-2">
                    <label class="text-xs text-mist-400">Filter Property:</label>
                    <select
                        v-model="selectedPropertyFilter"
                        class="rounded-lg border border-mist-800 bg-mist-900 px-3 py-1.5 text-xs text-mist-200 focus:outline-none">
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
                                No bookings available.
                            </td>
                        </tr>
                        <tr
                            v-for="b in filteredBookings"
                            :key="b.id"
                            class="hover:bg-mist-800/40 transition">
                            <td class="px-4 py-3 font-medium">
                                <span
                                    class="inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold text-white"
                                    :style="{
                                        backgroundColor: getPropertyConfig(b.propertyId).color,
                                    }">
                                    {{ getPropertyConfig(b.propertyId).name }}
                                </span>
                            </td>
                            <td class="px-4 py-3 font-mono font-semibold text-mist-300">
                                {{ b.bookingId }}
                            </td>
                            <td class="px-4 py-3 font-medium">{{ b.guestName }}</td>
                            <td class="px-4 py-3 text-mist-400">
                                {{ b.checkIn }} &rarr; {{ b.checkOut }}
                            </td>
                            <td class="px-4 py-3">{{ b.nights }}</td>
                            <td class="px-4 py-3 text-mist-300">{{ b.listing }}</td>
                            <td class="px-4 py-3">
                                <span
                                    class="rounded bg-mist-800 px-2 py-0.5 text-[10px] font-medium text-mist-300">
                                    {{ b.status }}
                                </span>
                            </td>
                            <td class="px-4 py-3 font-mono text-lime-400">
                                Rp {{ b.payout.toLocaleString() }}
                            </td>
                            <td class="px-4 py-3 text-right space-x-2">
                                <button
                                    type="button"
                                    class="text-mist-400 hover:text-mist-200"
                                    @click="openEditModal(b)">
                                    Edit
                                </button>
                                <button
                                    type="button"
                                    class="text-rose-400 hover:text-rose-300"
                                    @click="handleDeleteBooking(b)">
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
    </div>
</template>
