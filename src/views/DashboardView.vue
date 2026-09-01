<script setup lang="ts">
import { ref, computed } from 'vue';
import { storeToRefs } from 'pinia';
import BookingModal from '@/components/BookingModal.vue';
import { useBookingSync } from '@/composables/useBookingSync';
import { useDateKeys } from '@/composables/useDateKeys';
import { useDailyOperations } from '@/composables/useDailyOperations';
import { PROPERTY_LIST, getPropertyTheme } from '@/config/properties';
import { useBookingStore } from '@/stores/useBookingStore';
import { usePropertyStore } from '@/stores/usePropertyStore';
import type { Booking } from '@/types/booking';
import { formatIDR } from '@/utils/money';
import { formatDate, toISODateString } from '@/utils/date';

const bookingStore = useBookingStore();
const { bookings } = storeToRefs(bookingStore);
const propertyStore = usePropertyStore();
const { sortedProperties } = storeToRefs(propertyStore);

const { syncStatus, saveBooking } = useBookingSync();
const { todaysArrivals, todaysDepartures, currentStays } = useDailyOperations(bookings);
const { todayStr, currentMonthKey, lastMonthKey } = useDateKeys();

const isBookingModalOpen = ref<boolean>(false);
const bookingToEdit = ref<Booking | null>(null);

const propertyBookings = computed(() => bookings.value);
const pendingPayments = computed(() => {
    const isPaymentDueOneDayBeforeCheckIn = (checkIn: string, today: string): boolean => {
        const checkInDate = new Date(checkIn);
        checkInDate.setDate(checkInDate.getDate() - 1);

        const alertDateStr = toISODateString(checkInDate);
        return alertDateStr === today;
    };

    const whatsappPayments = propertyBookings.value.filter((b) =>
        b.listing !== 'Whatsapp' || b.status !== 'Waiting for payment'
            ? false
            : isPaymentDueOneDayBeforeCheckIn(b.checkIn, todayStr.value)
    );

    const bookingPayouts = propertyBookings.value.filter((b) => b.status === 'Waiting for payout');

    return {
        whatsappPayments,
        bookingPayouts,
    };
});

const monthlySummary = computed(() => {
    const targetMonth = currentMonthKey.value;
    const bookings = propertyBookings.value;

    let monthlyPayout = 0;
    let totalNightsBooked = 0;
    let totalBookings = 0;

    for (const b of bookings) {
        if (b && b.status !== 'Unavailable' && b.checkIn.startsWith(targetMonth)) {
            monthlyPayout += b.payout || 0;
            totalNightsBooked += b.nights || 0;
            totalBookings++;
        }
    }

    const [yearStr = '2026', monthStr = '1'] = targetMonth.split('-');
    const daysInMonth = new Date(Number(yearStr), Number(monthStr), 0).getDate();
    const totalCapacityNights = daysInMonth * PROPERTY_LIST.length;

    const occupancyRate =
        totalCapacityNights > 0
            ? Math.min(100, Math.round((totalNightsBooked / totalCapacityNights) * 100))
            : 0;

    return {
        totalPayout: monthlyPayout,
        totalNightsBooked,
        occupancyRate,
        bookingCount: totalBookings,
    };
});
const upcomingCheckIns = computed(() =>
    propertyBookings.value.filter((b) => b.checkIn === todayStr.value)
);
const upcomingCheckOuts = computed(() =>
    propertyBookings.value.filter((b) => b.checkOut === todayStr.value)
);
const currentMonthRevenue = computed<number>(() =>
    propertyBookings.value
        .filter((b) => b.checkIn.startsWith(currentMonthKey.value))
        .reduce((acc, b) => acc + (b.payout || 0), 0)
);
const lastMonthRevenue = computed<number>(() =>
    propertyBookings.value
        .filter((b) => b.checkIn.startsWith(lastMonthKey.value))
        .reduce((acc, b) => acc + (b.payout || 0), 0)
);
const revenueGrowthPercent = computed<number>(() => {
    return lastMonthRevenue.value === 0
        ? 0
        : Math.round(
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
const propertyImage = (id: string) =>
    id === 'bantul' ? 'https://placehold.co/300x400?text=Bantul' : `/images/${id}.jpg`;
</script>

<template>
    <div class="mx-auto max-w-7xl space-y-4">
        <div>
            <h1 class="text-xl font-bold text-mist-100">Dashboard</h1>
            <p class="text-xs text-mist-400">Live operational activity for {{ todayStr }}</p>
        </div>

        <!-- Monthly Summary Cards -->
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div class="rounded-lg border border-mist-800 bg-mist-900 p-4">
                <p class="text-xs uppercase font-bold text-mist-400">Monthly Revenue</p>
                <p class="mt-1 font-mono text-lg font-bold text-white">
                    {{ formatIDR(monthlySummary.totalPayout) }}
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
            <div class="rounded-lg border border-mist-800 bg-mist-900 p-4">
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
            <div class="rounded-lg border border-mist-800 bg-mist-900 p-4">
                <p class="text-xs uppercase font-bold text-mist-400">Total Month Bookings</p>
                <p class="text-lg font-bold text-mist-100 mt-1">
                    {{ monthlySummary.bookingCount }}
                </p>
                <p class="text-xs text-mist-500 mt-1">Active bookings</p>
            </div>
            <div class="rounded-lg border border-mist-800 bg-mist-900 p-4">
                <p class="text-xs uppercase font-bold text-mist-400">Today's Turnover</p>
                <div class="text-lg font-bold text-mist-200 mt-1">
                    <span class="text-lime-400 mr-3">↓ {{ upcomingCheckIns.length }} In</span>
                    <span class="text-amber-400">↑ {{ upcomingCheckOuts.length }} Out</span>
                </div>
                <p class="text-xs text-mist-500 mt-1">Scheduled for today</p>
            </div>
        </div>

        <!-- Status Alert -->
        <div
            v-if="syncStatus"
            class="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
            {{ syncStatus }}
        </div>

        <!-- Daily Operations -->
        <div class="mt-12">
            <h1 class="text-xl font-bold text-mist-100">Daily Operations</h1>
            <p class="text-xs text-mist-400">Active Stays</p>
        </div>
        <div class="grid grid-cols-3 grid-rows-1 gap-4">
            <!-- Arriving Today -->
            <div class="col-span-1 row-span-1 col-start-1 row-start-1">
                <div
                    class="h-full flex flex-col space-y-3 rounded-lg border border-mist-800 bg-mist-900 p-4">
                    <div
                        class="flex items-center justify-between border-b border-mist-800 pb-4 mb-4">
                        <h2 class="text-xs font-bold uppercase text-mist-300">Arriving Today</h2>
                        <span
                            class="rounded bg-mist-500/20 px-2 py-0.5 text-[10px] font-bold text-mist-400">
                            {{ todaysArrivals.length }}
                        </span>
                    </div>
                    <div
                        v-if="todaysArrivals.length === 0"
                        class="flex flex-1 items-center justify-center text-center text-xs text-mist-500">
                        <span>No arrivals scheduled for today.</span>
                    </div>
                    <div
                        v-else
                        class="space-y-4">
                        <div
                            v-for="b in todaysArrivals"
                            :key="b.id"
                            class="rounded-lg border border-mist-800 bg-mist-950 p-4 space-y-2">
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
                                <RouterLink
                                    :to="{
                                        name: 'property-detail',
                                        params: { id: b.propertyId },
                                    }"
                                    class="capitalize rounded px-2 py-0.5 text-xs font-medium"
                                    :class="[
                                        getPropertyTheme(b.propertyId).bg,
                                        getPropertyTheme(b.propertyId).text,
                                    ]">
                                    {{ b.propertyId }}
                                </RouterLink>
                            </div>
                            <div class="flex justify-between text-xs text-mist-400">
                                <span>
                                    {{ formatDate(b.checkIn, { shortMonth: true }) }}
                                    &rarr;
                                    {{ formatDate(b.checkOut, { shortMonth: true }) }}
                                </span>
                                <span>{{ b.nights }} night(s)</span>
                            </div>
                            <div class="flex justify-between text-xs text-mist-400">
                                <span>{{ b.listing }}</span>
                                <span class="font-mono text-lime-400">
                                    {{ formatIDR(b.payout) }}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <!-- Current Stays -->
            <div class="col-span-1 row-span-1 col-start-2 row-start-1">
                <div
                    class="h-full flex flex-col space-y-3 rounded-lg border border-mist-800 bg-mist-900 p-4">
                    <div
                        class="flex items-center justify-between border-b border-mist-800 pb-4 mb-4">
                        <div>
                            <h2 class="text-xs font-bold uppercase text-mist-300">
                                Currently Staying
                            </h2>
                        </div>
                        <span
                            class="rounded bg-mist-500/20 px-2 py-0.5 text-[10px] font-bold text-mist-400">
                            {{ currentStays.length }}
                        </span>
                    </div>
                    <div
                        v-if="currentStays.length === 0"
                        class="flex flex-1 items-center justify-center text-center text-xs text-mist-500">
                        <span>No guests currently in-house.</span>
                    </div>
                    <div
                        v-else
                        class="space-y-4">
                        <div
                            v-for="b in currentStays"
                            :key="b.id"
                            class="rounded-lg border border-mist-800 bg-mist-950 p-4 space-y-2">
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
                                <RouterLink
                                    :to="{
                                        name: 'property-detail',
                                        params: { id: b.propertyId },
                                    }"
                                    class="capitalize rounded px-2 py-0.5 text-xs font-medium"
                                    :class="[
                                        getPropertyTheme(b.propertyId).bg,
                                        getPropertyTheme(b.propertyId).text,
                                    ]">
                                    {{ b.propertyId }}
                                </RouterLink>
                            </div>
                            <div class="flex justify-between text-xs text-mist-400">
                                <span>
                                    {{ formatDate(b.checkIn, { shortMonth: true }) }}
                                    &rarr;
                                    {{ formatDate(b.checkOut, { shortMonth: true }) }}
                                </span>
                                <span>{{ b.nights }} night(s)</span>
                            </div>
                            <div class="flex justify-between text-xs text-mist-400">
                                <span>{{ b.listing }}</span>
                                <span class="font-mono text-lime-400">
                                    {{ formatIDR(b.payout) }}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <!-- Today's Departures -->
            <div class="col-span-1 row-span-1 col-start-3 row-start-1">
                <div
                    class="h-full flex flex-col space-y-3 rounded-lg border border-mist-800 bg-mist-900 p-4">
                    <div
                        class="flex items-center justify-between border-b border-mist-800 pb-4 mb-4">
                        <h2 class="text-xs font-bold uppercase text-mist-300">
                            Today's Departures
                        </h2>
                        <span
                            class="rounded bg-mist-500/20 px-2 py-0.5 text-[10px] font-bold text-mist-400">
                            {{ todaysDepartures.length }}
                        </span>
                    </div>
                    <div
                        v-if="todaysDepartures.length === 0"
                        class="flex flex-1 items-center justify-center text-center text-xs text-mist-500">
                        <span>No departures scheduled for today.</span>
                    </div>
                    <div
                        v-else
                        class="space-y-4">
                        <div
                            v-for="b in todaysDepartures"
                            :key="b.id"
                            class="rounded-lg border border-mist-800 bg-mist-950 p-4 space-y-2">
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
                                <RouterLink
                                    :to="{
                                        name: 'property-detail',
                                        params: { id: b.propertyId },
                                    }"
                                    class="capitalize rounded px-2 py-0.5 text-xs font-medium"
                                    :class="[
                                        getPropertyTheme(b.propertyId).bg,
                                        getPropertyTheme(b.propertyId).text,
                                    ]">
                                    {{ b.propertyId }}
                                </RouterLink>
                            </div>
                            <div class="flex justify-between text-xs text-mist-400">
                                <span>
                                    {{ formatDate(b.checkIn, { shortMonth: true }) }}
                                    &rarr;
                                    {{ formatDate(b.checkOut, { shortMonth: true }) }}
                                </span>
                                <span>{{ b.nights }} night(s)</span>
                            </div>
                            <div class="flex justify-between text-xs text-mist-400">
                                <span>{{ b.listing }}</span>
                                <span class="font-mono text-lime-400">
                                    {{ formatIDR(b.payout) }}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="grid grid-cols-3 grid-rows-1 gap-4">
            <!-- Notifications -->
            <div class="col-span-1 row-span-1 col-start-1 row-start-1">
                <div
                    class="h-full flex flex-col space-y-3 rounded-lg border border-mist-800 bg-mist-900 p-4">
                    <div
                        v-if="
                            pendingPayments.whatsappPayments.length === 0 &&
                            pendingPayments.bookingPayouts.length === 0
                        "
                        class="h-full flex flex-col">
                        <h2
                            class="text-xs font-bold uppercase text-mist-300 border-b border-mist-800 pb-4 mb-4">
                            Notifications
                        </h2>
                        <div
                            class="flex flex-1 items-center justify-center text-center text-xs text-mist-500">
                            <span>No Notifications</span>
                        </div>
                    </div>
                    <div
                        v-else
                        class="space-y-4">
                        <div
                            v-if="pendingPayments.whatsappPayments.length !== 0"
                            class="flex items-center justify-between border-b border-mist-800 pb-4 mb-4">
                            <h2 class="text-xs font-bold uppercase text-mist-300">
                                Pending Whatsapp Payments
                            </h2>
                            <span
                                class="rounded bg-mist-500/20 px-2 py-0.5 text-[10px] font-bold text-mist-400">
                                {{ pendingPayments.whatsappPayments.length }}
                            </span>
                        </div>
                        <div
                            v-if="pendingPayments.whatsappPayments.length !== 0"
                            class="divide-y divide-mist-800">
                            <div
                                v-for="b in pendingPayments.whatsappPayments"
                                :key="b.id"
                                class="py-4 first:pt-0">
                                <div class="space-y-2">
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
                                        <RouterLink
                                            :to="{
                                                name: 'property-detail',
                                                params: { id: b.propertyId },
                                            }"
                                            class="capitalize rounded px-2 py-0.5 text-xs font-medium"
                                            :class="[
                                                getPropertyTheme(b.propertyId).bg,
                                                getPropertyTheme(b.propertyId).text,
                                            ]">
                                            {{ b.propertyId }}
                                        </RouterLink>
                                    </div>
                                    <div class="flex justify-between text-xs text-mist-400">
                                        <span>
                                            {{ formatDate(b.checkIn, { shortMonth: true }) }}
                                            &rarr;
                                            {{ formatDate(b.checkOut, { shortMonth: true }) }}
                                            &bull;
                                            {{ b.nights }}
                                            night(s)
                                        </span>
                                        <span class="font-mono text-lime-400">
                                            {{ formatIDR(b.payout) }}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <!-- Payouts -->
                        <div
                            v-if="pendingPayments.bookingPayouts.length !== 0"
                            class="flex items-center justify-between border-b border-mist-800 pb-4 mb-4">
                            <h2 class="text-xs font-bold uppercase text-mist-300">
                                Pending Booking Payouts
                            </h2>
                            <span
                                class="rounded bg-mist-500/20 px-2 py-0.5 text-[10px] font-bold text-mist-400">
                                {{ pendingPayments.bookingPayouts.length }}
                            </span>
                        </div>
                        <div class="divide-y divide-mist-800">
                            <div
                                v-for="b in pendingPayments.bookingPayouts"
                                :key="b.id"
                                class="py-4 first:pt-0">
                                <div class="space-y-2">
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
                                        <RouterLink
                                            :to="{
                                                name: 'property-detail',
                                                params: { id: b.propertyId },
                                            }"
                                            class="capitalize rounded px-2 py-0.5 text-xs font-medium"
                                            :class="[
                                                getPropertyTheme(b.propertyId).bg,
                                                getPropertyTheme(b.propertyId).text,
                                            ]">
                                            {{ b.propertyId }}
                                        </RouterLink>
                                    </div>
                                    <div class="flex justify-between text-xs text-mist-400">
                                        <span>
                                            {{ formatDate(b.checkIn, { shortMonth: true }) }}
                                            &rarr;
                                            {{ formatDate(b.checkOut, { shortMonth: true }) }}
                                            &bull;
                                            {{ b.nights }}
                                            night(s)
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
            </div>
            <!-- Properties -->
            <div class="col-span-2 row-span-1 col-start-2 row-start-1">
                <div
                    class="overflow-x-auto rounded-lg border border-mist-800 bg-mist-900 shadow-lg">
                    <table class="w-full text-left text-sm text-mist-300 table-fixed">
                        <thead
                            class="border-b border-mist-800 bg-mist-950/60 text-[11px] uppercase text-mist-500">
                            <tr>
                                <th class="w-25 px-4 py-2.5">Property</th>
                                <th class="pr-4 py-2.5"></th>
                                <th class="w-35 px-4 py-2.5 text-center">Status</th>
                                <th class="w-35 px-4 py-2.5">Price</th>
                                <th class="w-20 px-4 py-2.5 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-mist-800/60">
                            <template
                                v-for="property in sortedProperties"
                                :key="property.id">
                                <tr class="hover:bg-mist-800/30">
                                    <td class="px-4 py-3">
                                        <RouterLink
                                            :to="{
                                                name: 'property-detail',
                                                params: { id: property.id },
                                            }">
                                            <img
                                                loading="lazy"
                                                :src="propertyImage(property.id)"
                                                :alt="`Picture of ${property.name}`"
                                                class="h-20 w-20 object-cover rounded-xl" />
                                        </RouterLink>
                                    </td>
                                    <td class="pr-4 py-3 font-medium text-mist-100">
                                        <h2 class="font-bold">{{ property.name }}</h2>
                                        <p class="mt-1 text-xs text-mist-500 truncate">
                                            <fa-icon icon="map-marker-alt" />
                                            {{ property.address }}
                                        </p>
                                    </td>
                                    <td class="px-4 py-3 font-medium text-mist-100 text-center">
                                        {{
                                            upcomingCheckIns.filter(
                                                (b) => b.propertyId === property.id
                                            ).length
                                                ? 'Blocked'
                                                : 'Available'
                                        }}
                                    </td>
                                    <td class="px-4 py-3 font-medium text-mist-100 font-mono">
                                        {{ formatIDR(property.price) }}
                                    </td>
                                    <td class="px-4 py-3 font-medium text-mist-100 text-center">
                                        <button
                                            type="button"
                                            class="cursor-pointer text-mist-400 hover:text-mist-100"
                                            @click="handleEditProperty(property.id)">
                                            <fa-icon icon="pen-to-square" />
                                        </button>
                                    </td>
                                </tr>
                            </template>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <BookingModal
            v-if="isBookingModalOpen"
            :booking-to-edit="bookingToEdit"
            @close="isBookingModalOpen = false"
            @save="handleSaveBooking" />
    </div>
</template>
