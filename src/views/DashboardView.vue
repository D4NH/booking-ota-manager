<script setup lang="ts">
import { ref, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useGoogleSheets } from '@/composables/useGoogleSheets';
import { useBookingStore } from '@/stores/useBookingStore';
import { usePropertyStore } from '@/stores/usePropertyStore';
import { PROPERTY_LIST, PROPERTY_THEMES, type PropertyId } from '@/config/properties';
import type { Booking } from '@/db';
import { getTodayStr } from '@/utils/date';

import AddBookingModal from '@/components/AddBookingModal.vue';

const bookingStore = useBookingStore();
const { bookings } = storeToRefs(bookingStore);
const { appendSheetRow, updateSheetRowByBookingId } = useGoogleSheets();
const propertyStore = usePropertyStore();
const { sortedProperties } = storeToRefs(propertyStore);

const selectedPropertyFilter = ref<string>('all');
const isModalOpen = ref<boolean>(false);
// const isPropertyModalOpen = ref<boolean>(false);
const bookingToEdit = ref<Booking | null>(null);
const syncStatus = ref<string>('');

const todayStr = computed<string>(() => getTodayStr());
const currentMonthStr = computed(() => todayStr.value.slice(0, 7));
const propertyBookings = computed(() => {
    if (selectedPropertyFilter.value === 'all') return bookings.value;
    return bookings.value.filter((b) => b.propertyId === selectedPropertyFilter.value);
});
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
const pendingPaymentAlerts = computed(() =>
    propertyBookings.value.filter((b) => {
        // 1. Must be WhatsApp channel with 'Waiting for payment' status
        if (b.listing !== 'Whatsapp' || b.status !== 'Waiting for payment') {
            return false;
        }

        if (!b.checkIn) return false;

        // 2. Calculate target alert date (Check-in minus 1 day)
        const checkInDate = new Date(b.checkIn);
        checkInDate.setDate(checkInDate.getDate() - 1);

        const alertYear = checkInDate.getFullYear();
        const alertMonth = String(checkInDate.getMonth() + 1).padStart(2, '0');
        const alertDay = String(checkInDate.getDate()).padStart(2, '0');
        const alertDateStr = `${alertYear}-${alertMonth}-${alertDay}`;

        // 3. Match only if the alert date is today
        return alertDateStr === todayStr.value;
    })
);
const monthlySummary = computed(() => {
    const monthBookings = propertyBookings.value.filter(
        (b) => b.checkIn.startsWith(currentMonthStr.value) && b.status !== 'Unavailable'
    );
    const totalPayout = monthBookings.reduce((sum, b) => sum + b.payout, 0);
    const totalNightsBooked = monthBookings.reduce((sum, b) => sum + b.nights, 0);
    const parts = currentMonthStr.value.split('-');
    const year = parseInt(parts[0] || '2026', 10);
    const month = parseInt(parts[1] || '1', 10);
    const daysInMonth = new Date(year, month, 0).getDate();
    const activePropertyCount = selectedPropertyFilter.value === 'all' ? PROPERTY_LIST.length : 1;
    const totalAvailableRoomNights = daysInMonth * activePropertyCount;
    const occupancyRate =
        totalAvailableRoomNights > 0
            ? Math.min(100, Math.round((totalNightsBooked / totalAvailableRoomNights) * 100))
            : 0;

    return {
        totalPayout,
        totalNightsBooked,
        occupancyRate,
        bookingCount: monthBookings.length,
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
const monthlyOccupancy = computed(() => {
    const [yearStr, monthStr] = currentMonthKey.value.split('-');
    const daysInMonth = new Date(Number(yearStr), Number(monthStr), 0).getDate();
    const totalCapacityNights = daysInMonth * PROPERTY_LIST.length;

    const bookedNightsThisMonth = bookingStore.bookings
        .filter((b) => b.checkIn.startsWith(currentMonthKey.value))
        .reduce((acc, b) => acc + (b.nights || 0), 0);

    const percentage = Math.min(
        100,
        Math.round((bookedNightsThisMonth / (totalCapacityNights || 1)) * 100)
    );

    return {
        bookedNights: bookedNightsThisMonth,
        capacityNights: totalCapacityNights,
        percentage,
    };
});
const upcomingCheckIns = computed(() =>
    bookingStore.bookings.filter((b) => {
        return b.checkIn === todayStr.value;
    })
);
const upcomingCheckOuts = computed(() =>
    bookingStore.bookings.filter((b) => {
        return b.checkOut === todayStr.value;
    })
);

const openEditModal = (booking: Booking): void => {
    bookingToEdit.value = booking;
    isModalOpen.value = true;
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

        isModalOpen.value = false;
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
const propertyImage = (id: string) => {
    if (id === 'bantul') return 'https://placehold.co/300x400?text=Bantul';
    return `/images/${id}.jpg`;
};
const getPropertyTheme = (id: PropertyId | string) => {
    return PROPERTY_THEMES[id as PropertyId] || PROPERTY_THEMES.piyungan;
};
</script>

<template>
    <div class="mx-auto max-w-7xl space-y-6">
        <div class="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <h1 class="text-xl font-bold tracking-tight text-mist-100">Dashboard</h1>
                <p class="text-xs text-mist-400">Live operational activity for {{ todayStr }}</p>
            </div>
        </div>

        <!-- Status -->
        <div
            v-if="syncStatus"
            class="rounded-lg border border-lime-500/30 bg-lime-500/10 p-3 text-xs text-lime-300">
            {{ syncStatus }}
        </div>

        <!-- Pending Payments -->
        <div
            v-if="pendingPaymentAlerts.length > 0"
            class="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div class="space-y-3 rounded-xl border border-mist-800 bg-mist-900 p-4">
                <div class="flex items-center justify-between border-b border-mist-800 pb-4 mb-4">
                    <h2 class="text-xs font-bold uppercase text-mist-300">
                        Pending WhatsApp Payments
                    </h2>
                    <span
                        class="rounded bg-mist-500/20 px-2 py-0.5 text-[10px] font-bold text-mist-400">
                        {{ pendingPaymentAlerts.length }}
                    </span>
                </div>
                <div class="space-y-2">
                    <div
                        v-for="b in pendingPaymentAlerts"
                        :key="b.id"
                        class="rounded-lg border border-mist-800 bg-mist-950 p-4 space-y-1">
                        <div class="flex items-center justify-between">
                            <span class="font-semibold text-sm text-mist-200 pb-2">
                                {{ b.guestName }}
                            </span>
                            <RouterLink
                                :to="b.propertyId"
                                class="capitalize rounded px-1.5 py-0.5 text-xs font-bold"
                                :class="[
                                    getPropertyTheme(b.propertyId).bg,
                                    getPropertyTheme(b.propertyId).text,
                                ]">
                                {{ b.propertyId }}
                            </RouterLink>
                        </div>
                        <div class="flex justify-between text-[12px] text-mist-400">
                            <span>{{ b.checkIn }} &rarr; {{ b.checkOut }} </span>
                            <span>{{ b.nights }} night(s)</span>
                        </div>
                        <div class="flex justify-between text-[12px] text-mist-400">
                            <span>{{ b.listing }}</span>
                            <span class="font-mono">{{ b.bookingId }}</span>
                        </div>
                        <div class="flex justify-between border-t border-mist-700 mt-4 pt-4">
                            <button
                                type="button"
                                class="cursor-pointer rounded bg-amber-500/20 px-2 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-500/30"
                                @click="openEditModal(b)">
                                Review
                            </button>
                            <span class="font-mono text-lime-400 text-sm">
                                Rp {{ b.payout.toLocaleString() }}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Monthly Summary Cards -->
        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div class="rounded-xl border border-mist-800 bg-mist-900 p-4">
                <p class="text-xs uppercase font-bold text-mist-400">Monthly Revenue</p>
                <p class="mt-1 font-mono text-lg font-bold text-white">
                    Rp {{ monthlySummary.totalPayout.toLocaleString() }}
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
                    {{ monthlySummary.occupancyRate }}%
                </p>
                <div class="w-full bg-mist-800 h-1.5 rounded-full overflow-hidden my-2">
                    <div
                        class="bg-lime-500 h-full transition-all duration-300"
                        :style="{ width: `${monthlyOccupancy.percentage}%` }"></div>
                </div>
                <p class="text-xs text-mist-500 mt-1">
                    {{ monthlyOccupancy.bookedNights }} /
                    {{ monthlyOccupancy.capacityNights }} nights booked
                </p>
            </div>
            <div class="rounded-xl border border-mist-800 bg-mist-900 p-4">
                <p class="text-xs uppercase font-bold text-mist-400">Total Month Bookings</p>
                <p class="text-lg font-bold text-mist-100 mt-1">
                    {{ monthlySummary.bookingCount }}
                </p>
                <p class="text-xs text-mist-500 mt-1">Active bookings</p>
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

        <!-- Daily Operations -->
        <div class="flex items-center justify-between mt-12">
            <div>
                <h1 class="text-xl font-bold tracking-tight text-mist-100">Daily Operations</h1>
                <p class="text-xs text-mist-400">Active Stays</p>
            </div>
        </div>
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <!-- Arriving Today -->
            <div class="space-y-3 rounded-xl border border-mist-800 bg-mist-900 p-4">
                <div class="flex items-center justify-between border-b border-mist-800 pb-4 mb-4">
                    <h2 class="text-xs font-bold uppercase text-mist-300">Arriving Today</h2>
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
                <div
                    v-else
                    class="space-y-4">
                    <div
                        v-for="b in todaysArrivals"
                        :key="b.id"
                        class="rounded-lg border border-mist-800 bg-mist-950 p-4 space-y-2">
                        <div class="flex items-center justify-between">
                            <span class="font-semibold text-sm text-mist-200">
                                {{ b.guestName }}
                            </span>
                            <RouterLink
                                :to="{ name: 'property', params: { id: b.propertyId } }"
                                class="capitalize rounded px-2 py-0.5 text-xs font-medium"
                                :class="[
                                    getPropertyTheme(b.propertyId).bg,
                                    getPropertyTheme(b.propertyId).text,
                                ]">
                                {{ b.propertyId }}
                            </RouterLink>
                        </div>
                        <div class="flex justify-between text-xs text-mist-400">
                            <span>{{ b.checkIn }} &rarr; {{ b.checkOut }} </span>
                            <span>{{ b.nights }} night(s)</span>
                        </div>
                        <div class="flex justify-between text-xs text-mist-400">
                            <span>{{ b.listing }}</span>
                            <span class="font-mono text-lime-400">
                                Rp {{ b.payout.toLocaleString() }}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
            <!-- Current In-House Guests -->
            <div class="space-y-3 rounded-xl border border-mist-800 bg-mist-900 p-4">
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
                <div
                    v-else
                    class="space-y-4">
                    <div
                        v-for="b in currentStays"
                        :key="b.id"
                        class="rounded-lg border border-mist-800 bg-mist-950 p-4 space-y-2">
                        <div class="flex items-center justify-between">
                            <span class="font-semibold text-sm text-mist-200">
                                {{ b.guestName }}
                            </span>
                            <RouterLink
                                :to="{ name: 'property', params: { id: b.propertyId } }"
                                class="capitalize rounded px-2 py-0.5 text-xs font-medium"
                                :class="[
                                    getPropertyTheme(b.propertyId).bg,
                                    getPropertyTheme(b.propertyId).text,
                                ]">
                                {{ b.propertyId }}
                            </RouterLink>
                        </div>
                        <div class="flex justify-between text-xs text-mist-400">
                            <span>{{ b.checkIn }} &rarr; {{ b.checkOut }} </span>
                            <span>{{ b.nights }} night(s)</span>
                        </div>
                        <div class="flex justify-between text-xs text-mist-400">
                            <span>{{ b.listing }}</span>
                            <span class="font-mono text-lime-400">
                                Rp {{ b.payout.toLocaleString() }}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
            <!-- Today's Departures -->
            <div class="space-y-3 rounded-xl border border-mist-800 bg-mist-900 p-4">
                <div class="flex items-center justify-between border-b border-mist-800 pb-4 mb-4">
                    <h2 class="text-xs font-bold uppercase text-mist-300">Today's Departures</h2>
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
                <div
                    v-else
                    class="space-y-4">
                    <div
                        v-for="b in todaysDepartures"
                        :key="b.id"
                        class="rounded-lg border border-mist-800 bg-mist-950 p-4 space-y-2">
                        <div class="flex items-center justify-between">
                            <span class="font-semibold text-sm text-mist-200">
                                {{ b.guestName }}
                            </span>
                            <RouterLink
                                :to="{ name: 'property', params: { id: b.propertyId } }"
                                class="capitalize rounded px-2 py-0.5 text-xs font-medium"
                                :class="[
                                    getPropertyTheme(b.propertyId).bg,
                                    getPropertyTheme(b.propertyId).text,
                                ]">
                                {{ b.propertyId }}
                            </RouterLink>
                        </div>
                        <div class="flex justify-between text-xs text-mist-400">
                            <span>{{ b.checkIn }} &rarr; {{ b.checkOut }} </span>
                            <span>{{ b.nights }} night(s)</span>
                        </div>
                        <div class="flex justify-between text-xs text-mist-400">
                            <span>{{ b.listing }}</span>
                            <span class="font-mono text-lime-400">
                                Rp {{ b.payout.toLocaleString() }}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Properties -->
        <div class="flex items-center justify-between mt-12">
            <div>
                <h1 class="text-xl font-bold tracking-tight text-mist-100">Properties</h1>
                <p class="text-xs text-mist-400">Managed Homestays & Villas</p>
            </div>
            <!-- <button
                class="rounded-lg bg-lime-500 px-4 py-2 text-sm font-semibold text-mist-950 hover:bg-lime-400 transition"
                @click="isPropertyModalOpen = true">
                <fa-icon icon="plus" /> Add Property
            </button> -->
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            <RouterLink
                v-for="property in sortedProperties"
                :key="property.id"
                class="relative block h-full overflow-hidden rounded-lg"
                :to="{ name: 'property', params: { id: property.id } }">
                <img
                    loading="lazy"
                    :src="propertyImage(property.id)"
                    :alt="`Picture of ${property.name}`"
                    class="h-[225px] w-full object-cover mask-[linear-gradient(to_bottom,black_25%,transparent_100%)]" />

                <div class="absolute bottom-12 inset-x-0 px-3 py-2">
                    <div>
                        <h2 class="font-bold">{{ property.name }}</h2>
                        <p class="text-xs capitalize">{{ property.id }}</p>
                    </div>
                </div>

                <div class="absolute bottom-0 inset-x-0 px-3 py-2 bg-white/30 backdrop-blur-sm">
                    <p class="text-xs line-clamp-2">
                        <fa-icon icon="map-marker-alt" />
                        {{ property.address }}
                    </p>
                </div>
            </RouterLink>
        </div>

        <AddBookingModal
            v-if="isModalOpen"
            :booking-to-edit="bookingToEdit"
            @close="isModalOpen = false"
            @save="handleSaveBooking" />
    </div>
</template>
