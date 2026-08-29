<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useRoute } from 'vue-router';
import { useGoogleSheets } from '@/composables/useGoogleSheets';
import { useBookingStore } from '@/stores/useBookingStore';
import { PROPERTY_CONFIGS, PROPERTY_LIST } from '@/config/properties';
import type { Booking } from '@/types/booking';
import type { PropertyId } from '@/types/properties';
import { getTodayStr } from '@/utils/date';
import { formatIDR } from '@/utils/money';

import AddBookingModal from '@/components/AddBookingModal.vue';

const route = useRoute();
const bookingStore = useBookingStore();
const { bookings } = storeToRefs(bookingStore);
const { appendSheetRow, updateSheetRowByBookingId, deleteSheetRowByBookingId } = useGoogleSheets();

const isBookingModalOpen = ref<boolean>(false);
const bookingToEdit = ref<Booking | null>(null);
const syncStatus = ref<string>('');
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
const activeConfig = computed(() => PROPERTY_CONFIGS[currentPropertyId.value]);
const todayStr = computed<string>(() => getTodayStr());
const currentMonthStr = computed(() => todayStr.value.slice(0, 7));
const propertyBookings = computed(() =>
    bookings.value.filter((b) => b.propertyId === currentPropertyId.value)
);
const todaysArrivals = computed(() => {
    const now = new Date();
    const currentHour = now.getHours();

    return propertyBookings.value.filter((b) => {
        if (currentHour >= 15) return false;
        return b.checkIn === todayStr.value && b.status !== 'Unavailable';
    });
});
const currentStays = computed(() => {
    const now = new Date();
    const currentHour = now.getHours();
    const today = todayStr.value;

    return propertyBookings.value.filter((b) => {
        if (b.status === 'Unavailable' || b.status === 'Waiting for payout') return false;

        // Check-in Today: Only visible after 15:00
        if (b.checkIn === today) return currentHour >= 15;

        // Check-out Today: Only visible before 12:00
        if (b.checkOut === today) return currentHour < 12;

        // Mid-stay: Guest stays past check-in date and before check-out date
        return b.checkIn < today && b.checkOut > today;
    });
});
const todaysDepartures = computed(() => {
    const now = new Date();
    const currentHour = now.getHours();

    return propertyBookings.value.filter((b) => {
        if (currentHour > 13) return false;
        return b.checkOut === todayStr.value && b.status !== 'Unavailable';
    });
});
const monthlyStats = computed(() => {
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
    const percentage = Math.min(100, Math.round((totalNightsBooked / daysInMonth) * 100));

    return {
        monthlyPayout,
        totalNightsBooked,
        occupancyRate,
        totalBookings: currentMonthBookings.length,
        capacityNights: daysInMonth,
        percentage,
    };
});
const currentMonthKey = computed<string>(() => todayStr.value.substring(0, 7));
const currentMonthRevenue = computed<number>(() =>
    bookingStore.bookings
        .filter((b) => b.checkIn.startsWith(currentMonthKey.value))
        .reduce((acc, b) => acc + (b.payout || 0), 0)
);
const lastMonthKey = computed<string>(() => {
    const [yearStr, monthStr] = currentMonthKey.value.split('-');

    // Fallback to 0 or current date numbers if undefined
    const y = Number(yearStr) || new Date().getFullYear();
    const m = Number(monthStr) || new Date().getMonth() + 1;

    // TypeScript now guarantees y and m are strictly 'number'
    const d = new Date(y, m - 2, 1);
    const lastY = d.getFullYear();
    const lastM = String(d.getMonth() + 1).padStart(2, '0');
    return `${lastY}-${lastM}`;
});
const lastMonthRevenue = computed<number>(() =>
    bookingStore.bookings
        .filter((b) => b.checkIn.startsWith(lastMonthKey.value))
        .reduce((acc, b) => acc + (b.payout || 0), 0)
);
const revenueGrowthPercent = computed<number>(() => {
    if (lastMonthRevenue.value === 0) return 0;
    return Math.round(
        ((currentMonthRevenue.value - lastMonthRevenue.value) / lastMonthRevenue.value) * 100
    );
});
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
const upcomingCheckIns = computed(() =>
    bookingStore.bookings.filter(
        (b) => b.propertyId === selectedProperty.value && b.checkIn === todayStr.value
    )
);
const upcomingCheckOuts = computed(() =>
    bookingStore.bookings.filter(
        (b) => b.propertyId === selectedProperty.value && b.checkOut === todayStr.value
    )
);

const isCurrentBooking = (checkIn: string, checkOut: string, status: string): boolean =>
    todayStr.value >= checkIn && todayStr.value <= checkOut && status !== 'Waiting for payout';
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
            syncStatus.value = 'Syncing edit to Google Sheets...';
            await bookingStore.updateBookingWithRemoteSync(
                { ...bookingToEdit.value, ...payload },
                { updateSheetRowByBookingId }
            );
            syncStatus.value = 'Booking updated in Google Sheets & local database.';
        } else {
            syncStatus.value = 'Syncing new booking to Google Sheets...';
            await bookingStore.addBookingWithRemoteSync(payload, { appendSheetRow });
            syncStatus.value = 'Booking saved to Google Sheets & local database.';
        }

        isBookingModalOpen.value = false;
    } catch (err: unknown) {
        console.error('Save aborted due to sync failure:', err);
        const errorMessage =
            err instanceof Error
                ? err.message
                : 'Google Sheets sync failed. Local database was not modified.';
        syncStatus.value = `Save failed: ${errorMessage}`;
    } finally {
        setTimeout(() => {
            syncStatus.value = '';
        }, 5000);
    }
};
const handleDeleteBooking = async (booking: Booking): Promise<void> => {
    const confirmed = window.confirm(
        `Are you sure you want to delete booking ${booking.bookingId} (${booking.guestName})?\n\nThis will remove it from Google Sheets first.`
    );

    if (!confirmed) return;

    try {
        syncStatus.value = `Deleting reservation ${booking.bookingId} from Google Sheets...`;
        await bookingStore.deleteBookingWithRemoteSync(booking, { deleteSheetRowByBookingId });
        syncStatus.value = `Booking ${booking.bookingId} deleted from Google Sheets & local database.`;
    } catch (err: unknown) {
        console.error('Delete aborted due to sync failure:', err);
        const errorMessage =
            err instanceof Error
                ? err.message
                : 'Google Sheets sync failed. Local record was not deleted.';
        syncStatus.value = `Delete failed: ${errorMessage}`;
    } finally {
        setTimeout(() => {
            syncStatus.value = '';
        }, 5000);
    }
};

watch(
    () => route.params.id,
    (newId) => {
        selectedProperty.value = (newId as PropertyId) || 'all';
    }
);

// const handleDeleteProperty = async (id: string, name: string): Promise<void> => {
//     if (window.confirm(`Delete property ${name}?`)) {
//         await propertyStore.deleteProperty(id);
//     }
// };
</script>

<template>
    <div class="mx-auto max-w-7xl space-y-6">
        <!-- Property Header -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div class="flex items-center">
                <div>
                    <h1 class="text-xl font-bold tracking-tight text-mist-100">
                        {{ activeConfig.name }}
                    </h1>
                    <p class="text-xs text-mist-400">Property Overview & Management</p>
                </div>
            </div>

            <!-- Property Switcher Tabs -->
            <div class="flex items-center gap-1 rounded-lg border border-mist-800 bg-mist-900 p-1">
                <RouterLink
                    v-for="prop in PROPERTY_LIST"
                    :key="prop.id"
                    :to="{ name: 'property', params: { id: prop.id } }"
                    :class="[
                        'rounded-md px-3 py-1.5 text-xs font-semibold transition',
                        currentPropertyId === prop.id
                            ? 'bg-mist-800 text-mist-100'
                            : 'text-mist-400 hover:text-mist-200',
                    ]">
                    {{ prop.name.replace('Mai House Jogja - ', '') }}
                </RouterLink>
            </div>
        </div>

        <!-- Monthly Summary Cards -->
        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div class="rounded-xl border border-mist-800 bg-mist-900 p-4">
                <p class="text-[10px] uppercase font-bold text-mist-400">Monthly Revenue</p>
                <p class="mt-1 font-mono text-lg font-bold text-white">
                    {{ formatIDR(monthlyStats.monthlyPayout) }}
                </p>
                <div class="flex items-center gap-1 text-xs mt-1">
                    <span
                        :class="revenueGrowthPercent >= 0 ? 'text-lime-400' : 'text-rose-400'"
                        class="font-medium">
                        {{ revenueGrowthPercent >= 0 ? '+' : '' }}{{ revenueGrowthPercent }}%
                    </span>
                    <span class="text-mist-500">vs last month</span>
                </div>
            </div>
            <div class="rounded-xl border border-mist-800 bg-mist-900 p-4">
                <p class="text-xs uppercase font-bold text-mist-400">Occupancy Rate</p>
                <p class="text-lg font-bold text-mist-100 mt-1">
                    {{ monthlyStats.occupancyRate }}%
                </p>
                <div class="w-full bg-mist-800 h-1.5 rounded-full overflow-hidden my-2">
                    <div
                        class="bg-lime-500 h-full transition-all duration-300"
                        :style="{ width: `${monthlyStats.percentage}%` }"></div>
                </div>
                <p class="text-xs text-mist-500 mt-1">
                    {{ monthlyStats.totalNightsBooked }} / {{ monthlyStats.capacityNights }} nights
                    booked
                </p>
            </div>
            <div class="rounded-xl border border-mist-800 bg-mist-900 p-4">
                <p class="text-[10px] uppercase font-bold text-mist-400">Total bookings</p>
                <p class="mt-1 text-xl font-bold text-mist-100">
                    {{ monthlyStats.totalBookings }}
                </p>
                <p class="mt-1 text-[10px] text-mist-500">Active bookings</p>
            </div>
            <div class="rounded-xl border border-mist-800 bg-mist-900 p-4">
                <p class="text-xs uppercase font-bold text-mist-400">Today's Turnover</p>
                <div class="text-lg font-bold text-mist-200 mt-1">
                    <span class="text-lime-400 mr-3">↓ {{ upcomingCheckIns.length }} In</span>
                    <span class="text-amber-400">↑ {{ upcomingCheckOuts.length }} Out</span>
                </div>
                <p class="text-xs text-mist-500 mt-1">Scheduled for today</p>
            </div>
        </div>

        <!-- Main Operational View -->
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div class="space-y-4 rounded-xl border border-mist-800 bg-mist-900 p-4">
                <div class="flex items-center justify-between border-b border-mist-800 pb-4 mb-4">
                    <h2 class="text-xs font-bold uppercase text-mist-200">Arriving Today</h2>
                    <span
                        class="rounded bg-mist-500/20 px-2 py-0.5 text-[10px] font-bold text-mist-400">
                        {{ todaysArrivals.length }}
                    </span>
                </div>
                <div
                    v-if="todaysArrivals.length === 0"
                    class="py-12 text-center text-xs text-mist-500">
                    No arrivals scheduled for today.
                </div>
                <div v-else>
                    <div
                        v-for="b in todaysArrivals"
                        :key="b.id"
                        class="rounded-lg border border-mist-800 bg-mist-950 p-3 space-y-2">
                        <div class="flex items-center">
                            <span class="font-semibold text-sm text-mist-200">
                                {{ b.guestName }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between text-[12px] text-mist-400">
                            <span>{{ b.checkIn }} &rarr; {{ b.checkOut }} </span>
                            <span>{{ b.nights }} night(s)</span>
                        </div>
                        <div class="flex items-center justify-between text-[12px] text-mist-400">
                            <span>{{ b.listing }}</span>
                            <span class="font-mono text-lime-400">
                                {{ formatIDR(b.payout) }}
                            </span>
                        </div>
                        <div
                            class="flex items-center justify-end border-t border-mist-800 mt-3 pt-2">
                            <button
                                type="button"
                                class="cursor-pointer text-xs font-semibold text-mist-400 hover:text-lime-500"
                                @click="openEditModal(b)">
                                <fa-icon icon="pen-to-square" /> Edit
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="space-y-4 rounded-xl border border-mist-800 bg-mist-900 p-4">
                <div class="flex items-center justify-between border-b border-mist-800 pb-4 mb-4">
                    <div>
                        <h2 class="text-xs font-bold uppercase text-mist-300">Currently Staying</h2>
                    </div>
                    <span
                        class="rounded bg-mist-500/20 px-2 py-0.5 text-[10px] font-bold text-mist-400">
                        {{ currentStays.length }}
                    </span>
                </div>
                <div
                    v-if="currentStays.length === 0"
                    class="py-12 text-center text-xs text-mist-500">
                    No guests currently in-house.
                </div>
                <div v-else>
                    <div
                        v-for="b in currentStays"
                        :key="b.id"
                        class="rounded-lg border border-mist-800 bg-mist-950 p-4 space-y-2">
                        <div class="flex items-center">
                            <span class="font-semibold text-sm text-mist-200">
                                {{ b.guestName }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between text-[12px] text-mist-400">
                            <span>{{ b.checkIn }} &rarr; {{ b.checkOut }} </span>
                            <span>{{ b.nights }} night(s)</span>
                        </div>
                        <div class="flex items-center justify-between text-[12px] text-mist-400">
                            <span>{{ b.listing }}</span>
                            <span class="font-mono text-lime-400">
                                {{ formatIDR(b.payout) }}
                            </span>
                        </div>
                        <div
                            class="flex items-center justify-end border-t border-mist-800 mt-3 pt-2">
                            <button
                                type="button"
                                class="cursor-pointer text-xs font-semibold text-mist-400 hover:text-lime-500"
                                @click="openEditModal(b)">
                                <fa-icon icon="pen-to-square" /> Edit
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="space-y-4 rounded-xl border border-mist-800 bg-mist-900 p-4">
                <div class="flex items-center justify-between border-b border-mist-800 pb-4 mb-4">
                    <h2 class="text-xs font-bold uppercase text-mist-200">Today's Departures</h2>
                    <span
                        class="rounded bg-mist-500/20 px-2 py-0.5 text-[10px] font-bold text-mist-400">
                        {{ todaysDepartures.length }}
                    </span>
                </div>
                <div
                    v-if="todaysDepartures.length === 0"
                    class="py-12 text-center text-xs text-mist-500">
                    No departures scheduled for today.
                </div>
                <div v-else>
                    <div
                        v-for="b in todaysDepartures"
                        :key="b.id"
                        class="rounded-lg border border-mist-800 bg-mist-950 p-4 space-y-2">
                        <div class="flex items-center">
                            <span class="font-semibold text-sm text-mist-200">
                                {{ b.guestName }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between text-[12px] text-mist-400">
                            <span>{{ b.checkIn }} &rarr; {{ b.checkOut }} </span>
                            <span>{{ b.nights }} night(s)</span>
                        </div>
                        <div class="flex items-center justify-between text-[12px] text-mist-400">
                            <span>{{ b.listing }}</span>
                            <span class="font-mono text-lime-400">
                                {{ formatIDR(b.payout) }}
                            </span>
                        </div>
                        <div
                            class="flex items-center justify-end border-t border-mist-800 mt-3 pt-2">
                            <button
                                type="button"
                                class="cursor-pointer text-xs font-semibold text-mist-400 hover:text-lime-500"
                                @click="openEditModal(b)">
                                <fa-icon icon="pen-to-square" /> Edit
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div
            v-if="syncStatus"
            class="rounded-lg border border-lime-500/30 bg-lime-500/10 p-3 text-xs text-lime-300">
            {{ syncStatus }}
        </div>

        <!-- Upcoming Bookings -->
        <div
            class="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between border-b border-mist-800 pb-5 mt-12">
            <div>
                <h1 class="text-xl font-bold tracking-tight text-mist-100">Upcoming bookings</h1>
                <p class="text-xs text-mist-400">Check all bookings [here]</p>
            </div>

            <button
                type="button"
                class="rounded-lg bg-lime-500 px-4 py-2 text-xs font-semibold text-mist-950 hover:bg-lime-400"
                @click="openAddModal">
                <fa-icon icon="plus" /> Add Booking
            </button>
        </div>
        <div
            v-if="groupedBookings.length === 0"
            class="rounded-xl border border-dashed border-mist-800 p-12 text-center">
            <p class="text-sm text-mist-400">No reservations matching current filters</p>
        </div>
        <div
            v-else
            class="overflow-x-auto rounded-xl border border-mist-800 bg-mist-900 shadow-lg">
            <table class="w-full text-left text-sm text-mist-300 table-fixed">
                <thead
                    class="border-b border-mist-800 bg-mist-950/60 text-[11px] uppercase tracking-wider text-mist-500">
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
                                        @click="openEditModal(b)">
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

        <AddBookingModal
            v-if="isBookingModalOpen"
            :booking-to-edit="bookingToEdit"
            :current-property="currentPropertyId"
            @close="isBookingModalOpen = false"
            @save="handleSaveBooking" />
    </div>
</template>
