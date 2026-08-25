<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useBookingStore } from '@/stores/useBookingStore';
import { useGoogleSheets } from '@/composables/useGoogleSheets';
import { PROPERTY_CONFIGS, PROPERTY_LIST, type PropertyId } from '@/config/properties';
import AddBookingModal from '@/components/AddBookingModal.vue';
import type { Booking } from '@/db';

const route = useRoute();
const bookingStore = useBookingStore();
const { bookings, isLoading } = storeToRefs(bookingStore);
const { updateSheetRowByBookingId } = useGoogleSheets();

const isModalOpen = ref<boolean>(false);
const bookingToEdit = ref<Booking | null>(null);

// 1. Resolve Active Property ID from Route Params with Fallback
const currentPropertyId = computed<PropertyId>(() => {
    const paramId = route.params.id as string;
    if (paramId && paramId in PROPERTY_CONFIGS) {
        return paramId as PropertyId;
    }
    return 'piyungan';
});

const activeConfig = computed(() => PROPERTY_CONFIGS[currentPropertyId.value]);

// Date Calculations (Current Date: 2026-08-25)
const getTodayString = (): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const todayStr = computed(() => getTodayString());
const currentMonthStr = computed(() => todayStr.value.slice(0, 7));

// 2. Property-Scoped Bookings
const propertyBookings = computed(() => {
    return bookings.value.filter((b) => b.propertyId === currentPropertyId.value);
});

// 3. Status Filters
const currentInHouse = computed(() => {
    const currentHour = new Date().getHours(); // 24-hour format (e.g., 10 for 10:00, 13 for 13:00)

    return propertyBookings.value.filter((b) => {
        if (b.status === 'Unavailable') return false;

        // 1. Guests staying multi-day strictly in between check-in and check-out dates
        const isMidStay = b.checkIn < todayStr.value && b.checkOut > todayStr.value;
        if (isMidStay) return true;

        // 2. Morning (< 12:00): Show guest who is checking out today
        if (currentHour < 12) {
            return b.checkOut === todayStr.value;
        }

        // 3. Afternoon / Evening (>= 12:00): Show guest who is checking in today
        return b.checkIn === todayStr.value;
    });
});

const todaysArrivals = computed(() => {
    return propertyBookings.value.filter(
        (b) => b.checkIn === todayStr.value && b.status !== 'Unavailable'
    );
});

const todaysDepartures = computed(() => {
    return propertyBookings.value.filter(
        (b) => b.checkOut === todayStr.value && b.status !== 'Unavailable'
    );
});

const upcomingReservations = computed(() => {
    return propertyBookings.value
        .filter((b) => b.checkIn > todayStr.value && b.status !== 'Unavailable')
        .sort((a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime());
});

// 4. Monthly Performance Metrics Card Data
const propertyStats = computed(() => {
    const currentMonthBookings = propertyBookings.value.filter(
        (b) => b.checkIn.startsWith(currentMonthStr.value) && b.status !== 'Unavailable'
    );

    const monthlyPayout = currentMonthBookings.reduce((sum, b) => sum + b.payout, 0);
    const totalNightsBooked = currentMonthBookings.reduce((sum, b) => sum + b.nights, 0);

    const parts = currentMonthStr.value.split('-');
    const year = parseInt(parts[0] || '2026', 10);
    const month = parseInt(parts[1] || '8', 10);
    const daysInMonth = new Date(year, month, 0).getDate();

    const occupancyRate =
        daysInMonth > 0 ? Math.min(100, Math.round((totalNightsBooked / daysInMonth) * 100)) : 0;

    return {
        monthlyPayout,
        totalNightsBooked,
        occupancyRate,
        totalReservations: currentMonthBookings.length,
    };
});

const openEditModal = (booking: Booking): void => {
    bookingToEdit.value = booking;
    isModalOpen.value = true;
};

const handleSaveBooking = async (payload: Omit<Booking, 'id' | 'createdAt'>): Promise<void> => {
    if (!bookingToEdit.value) return;

    try {
        // Sync update to both Dexie IndexedDB and the target Google Sheet file
        await bookingStore.updateBookingWithRemoteSync(
            { ...bookingToEdit.value, ...payload },
            { updateSheetRowByBookingId }
        );
    } catch (err) {
        console.error('Failed to sync booking update to Google Sheets:', err);
    }
};
</script>

<template>
    <div class="mx-auto max-w-7xl space-y-6">
        <!-- Property Header -->
        <div
            class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-mist-800 pb-5">
            <div class="flex items-center gap-3">
                <div>
                    <h1 class="text-xl font-bold tracking-tight text-mist-100">
                        {{ activeConfig.name }}
                    </h1>
                    <p class="text-xs text-mist-400">Property Overview & Management</p>
                </div>
            </div>

            <!-- Property Switcher Tabs -->
            <div class="flex items-center gap-1 rounded-lg border border-mist-800 bg-mist-900 p-1">
                <router-link
                    v-for="prop in PROPERTY_LIST"
                    :key="prop.id"
                    :to="`/${prop.id}`"
                    :class="[
                        'rounded-md px-3 py-1.5 text-xs font-semibold transition',
                        currentPropertyId === prop.id
                            ? 'bg-mist-800 text-mist-100'
                            : 'text-mist-400 hover:text-mist-200',
                    ]">
                    {{ prop.name.replace('Mai House Jogja - ', '') }}
                </router-link>
            </div>
        </div>

        <!-- Performance Summary Cards -->
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div class="rounded-xl border border-mist-800 bg-mist-900 p-4">
                <p class="text-[10px] uppercase font-bold text-mist-400">Monthly Revenue</p>
                <p class="mt-1 font-mono text-xl font-bold text-lime-400">
                    Rp {{ propertyStats.monthlyPayout.toLocaleString() }}
                </p>
                <p class="mt-1 text-[10px] text-mist-500">Target Month Earnings</p>
            </div>

            <div class="rounded-xl border border-mist-800 bg-mist-900 p-4">
                <p class="text-[10px] uppercase font-bold text-mist-400">Occupancy Rate</p>
                <p class="mt-1 text-xl font-bold text-mist-100">
                    {{ propertyStats.occupancyRate }}%
                </p>
                <p class="mt-1 text-[10px] text-mist-500">Days booked vs total days</p>
            </div>

            <div class="rounded-xl border border-mist-800 bg-mist-900 p-4">
                <p class="text-[10px] uppercase font-bold text-mist-400">Nights Booked</p>
                <p class="mt-1 text-xl font-bold text-mist-100">
                    {{ propertyStats.totalNightsBooked }} Nights
                </p>
                <p class="mt-1 text-[10px] text-mist-500">Total occupied room nights</p>
            </div>

            <div class="rounded-xl border border-mist-800 bg-mist-900 p-4">
                <p class="text-[10px] uppercase font-bold text-mist-400">Total Reservations</p>
                <p class="mt-1 text-xl font-bold text-mist-100">
                    {{ propertyStats.totalReservations }} Bookings
                </p>
                <p class="mt-1 text-[10px] text-mist-500">Active monthly entries</p>
            </div>
        </div>

        <!-- Main Operational Split View -->
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div class="space-y-4 rounded-xl border border-mist-800 bg-mist-900 p-5">
                <div class="flex items-center justify-between border-b border-mist-800 pb-3">
                    <h2 class="text-xs font-bold uppercase text-mist-200">Arriving Today</h2>
                    <span
                        class="rounded bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold text-blue-400">
                        {{ todaysArrivals.length }}
                    </span>
                </div>

                <div
                    v-if="todaysArrivals.length === 0"
                    class="py-8 text-center text-xs text-mist-500">
                    No guests currently staying at {{ activeConfig.name }}.
                </div>
                <div
                    v-else
                    class="space-y-3">
                    <div
                        v-for="b in todaysArrivals"
                        :key="b.id"
                        class="rounded-lg border border-mist-800 bg-mist-950 p-4 space-y-2">
                        <div class="flex items-center justify-between">
                            <span class="font-bold text-sm text-mist-100">{{ b.guestName }}</span>
                            <span class="font-mono text-xs text-mist-400">
                                {{ b.listing }}
                            </span>
                        </div>

                        <div class="text-xs text-mist-400 space-y-1">
                            <p>
                                No:
                                <span class="text-mist-200">
                                    {{ b.bookingId }}
                                </span>
                            </p>

                            <p class="pb-2">
                                Stay:
                                <span class="text-mist-200">
                                    {{ b.checkIn }} &rarr; {{ b.checkOut }} &bull;
                                    {{ b.nights }} night(s)
                                </span>
                            </p>
                        </div>

                        <div
                            class="flex items-center justify-between border-t border-mist-800/80 pt-2 text-xs">
                            <span class="font-mono text-lime-400">
                                Rp {{ b.payout.toLocaleString() }}
                            </span>
                            <button
                                type="button"
                                class="cursor-pointer text-xs font-semibold text-mist-400 hover:text-mist-200"
                                @click="openEditModal(b)">
                                <fa-icon icon="pen-to-square" /> Edit
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- In-House Guests Section -->
            <div class="space-y-4 rounded-xl border border-mist-800 bg-mist-900 p-5">
                <div class="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div>
                        <h2 class="text-xs font-bold uppercase text-slate-300">
                            Currently Staying
                        </h2>
                    </div>
                    <span
                        class="rounded bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold text-blue-400">
                        {{ currentInHouse.length }}
                    </span>
                </div>

                <div
                    v-if="currentInHouse.length === 0"
                    class="py-8 text-center text-xs text-mist-500">
                    No guests currently staying at {{ activeConfig.name }}.
                </div>
                <div
                    v-else
                    class="space-y-3">
                    <div
                        v-for="b in currentInHouse"
                        :key="b.id"
                        class="rounded-lg border border-mist-800 bg-mist-950 p-4 space-y-2">
                        <div class="flex items-center justify-between">
                            <span class="font-bold text-sm text-mist-100">{{ b.guestName }}</span>
                            <span class="font-mono text-xs text-mist-400">
                                {{ b.listing }}
                            </span>
                        </div>

                        <div class="text-xs text-mist-400 space-y-1">
                            <p>
                                No:
                                <span class="text-mist-200">
                                    {{ b.bookingId }}
                                </span>
                            </p>

                            <p class="pb-2">
                                Stay:
                                <span class="text-mist-200">
                                    {{ b.checkIn }} &rarr; {{ b.checkOut }} &bull;
                                    {{ b.nights }} night(s)
                                </span>
                            </p>
                        </div>

                        <div
                            class="flex items-center justify-between border-t border-mist-800/80 pt-2 text-xs">
                            <span class="font-mono text-lime-400">
                                Rp {{ b.payout.toLocaleString() }}
                            </span>
                            <button
                                type="button"
                                class="cursor-pointer text-xs font-semibold text-mist-400 hover:text-mist-200"
                                @click="openEditModal(b)">
                                <fa-icon icon="pen-to-square" /> Edit
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="space-y-4 rounded-xl border border-mist-800 bg-mist-900 p-5">
                <div class="flex items-center justify-between border-b border-mist-800 pb-3">
                    <h2 class="text-xs font-bold uppercase text-mist-200">Today's Departures</h2>
                    <span
                        class="rounded bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold text-blue-400">
                        {{ todaysDepartures.length }}
                    </span>
                </div>

                <div
                    v-if="todaysDepartures.length === 0"
                    class="py-8 text-center text-xs text-mist-500">
                    No guests currently staying at {{ activeConfig.name }}.
                </div>
                <div
                    v-else
                    class="space-y-3">
                    <div
                        v-for="b in todaysDepartures"
                        :key="b.id"
                        class="rounded-lg border border-mist-800 bg-mist-950 p-4 space-y-2">
                        <div class="flex items-center justify-between">
                            <span class="font-bold text-sm text-mist-100">{{ b.guestName }}</span>
                            <span class="font-mono text-xs text-mist-400">
                                {{ b.listing }}
                            </span>
                        </div>

                        <div class="text-xs text-mist-400 space-y-1">
                            <p>
                                No:
                                <span class="text-mist-200">
                                    {{ b.bookingId }}
                                </span>
                            </p>

                            <p class="pb-2">
                                Stay:
                                <span class="text-mist-200">
                                    {{ b.checkIn }} &rarr; {{ b.checkOut }} &bull;
                                    {{ b.nights }} night(s)
                                </span>
                            </p>
                        </div>

                        <div
                            class="flex items-center justify-between border-t border-mist-800/80 pt-2 text-xs">
                            <span class="font-mono text-lime-400">
                                Rp {{ b.payout.toLocaleString() }}
                            </span>
                            <button
                                type="button"
                                class="cursor-pointer text-xs font-semibold text-mist-400 hover:text-mist-200"
                                @click="openEditModal(b)">
                                <fa-icon icon="pen-to-square" /> Edit
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Upcoming Reservations Table Section -->
            <div class="space-y-4 rounded-xl border border-mist-800 bg-mist-900 p-5 lg:col-span-3">
                <div class="flex items-center justify-between border-b border-mist-800 pb-3">
                    <h2 class="text-xs font-bold uppercase text-mist-200">Upcoming Reservations</h2>
                    <span class="text-xs text-mist-400">
                        {{ upcomingReservations.length }} Future Stay(s)
                    </span>
                </div>

                <div class="overflow-x-auto">
                    <table class="w-full text-left text-sm">
                        <thead
                            class="border-b border-mist-800 bg-mist-950/50 text-mist-400 uppercase">
                            <tr>
                                <th class="px-3 py-2">Booking ID</th>
                                <th class="px-3 py-2">Guest Name</th>
                                <th class="px-3 py-2">Dates</th>
                                <th class="px-3 py-2">Nights</th>
                                <th class="px-3 py-2">Channel</th>
                                <th class="px-3 py-2">Payout</th>
                                <th class="px-3 py-2 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-mist-800 text-mist-300">
                            <tr v-if="isLoading">
                                <td
                                    colspan="7"
                                    class="py-6 text-center text-mist-500">
                                    Loading reservations...
                                </td>
                            </tr>
                            <tr v-else-if="upcomingReservations.length === 0">
                                <td
                                    colspan="7"
                                    class="py-6 text-center text-mist-500">
                                    No upcoming reservations scheduled.
                                </td>
                            </tr>
                            <tr
                                v-for="b in upcomingReservations"
                                :key="b.id"
                                class="hover:bg-mist-800/40 transition">
                                <td class="px-3 py-2.5 font-mono font-medium text-mist-200">
                                    {{ b.bookingId }}
                                </td>
                                <td class="px-3 py-2.5 font-medium text-mist-100">
                                    {{ b.guestName }}
                                </td>
                                <td class="px-3 py-2.5 text-mist-400">
                                    {{ b.checkIn }} &rarr; {{ b.checkOut }}
                                </td>
                                <td class="px-3 py-2.5">{{ b.nights }}</td>
                                <td class="px-3 py-2.5">{{ b.listing }}</td>
                                <td class="px-3 py-2.5 font-mono text-lime-400">
                                    Rp {{ b.payout.toLocaleString() }}
                                </td>
                                <td class="px-3 py-2.5 text-right">
                                    <button
                                        type="button"
                                        class="cursor-pointer text-mist-400 hover:text-mist-200"
                                        @click="openEditModal(b)">
                                        <fa-icon icon="pen-to-square" /> Edit
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Booking Edit Modal -->
        <AddBookingModal
            v-if="isModalOpen"
            :booking-to-edit="bookingToEdit"
            @close="isModalOpen = false"
            @save="handleSaveBooking" />
    </div>
</template>
