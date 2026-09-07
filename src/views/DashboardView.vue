<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useDateKeys } from '@/composables/useDateKeys';
import { useMonthlyMetrics } from '@/composables/useMonthlyMetrics';
import { useDailyOperations } from '@/composables/useDailyOperations';
import { getPropertyTheme } from '@/config/properties';
import { useBookingStore } from '@/stores/useBookingStore';
import { useModalStore } from '@/stores/useModalStore';
import { usePropertyStore } from '@/stores/usePropertyStore';
import type { Booking } from '@/types/booking';
import type { PropertyId } from '@/types/property';
import { formatDate } from '@/utils/date';
import { formatIDR } from '@/utils/money';

import OccupiedTag from '@/components/OccupiedTag.vue';

const bookingStore = useBookingStore();
const { bookings } = storeToRefs(bookingStore);
const modalStore = useModalStore();
const propertyStore = usePropertyStore();
const { properties, sortedProperties } = storeToRefs(propertyStore);

const { todaysArrivals, todaysDepartures, currentStays, todaysTurnover } =
    useDailyOperations(bookings);
const { currentDay } = useDateKeys();
const {
    totalPayout,
    occupiedNights,
    totalCapacityNights,
    occupancyPercentage,
    totalBookingsCount,
    revenueGrowthPercent,
} = useMonthlyMetrics(bookings, properties);

const handleEditBooking = (booking: Booking) => {
    modalStore.openBookingModal({ booking });
};
const handleEditProperty = (propertyId: PropertyId) => {
    const property = properties.value.find((p) => p.id === propertyId);
    modalStore.openPropertyModal({ property });
};
const propertyImage = (id: string) =>
    id === 'bantul' ? 'https://placehold.co/300x400?text=Bantul' : `/images/${id}.jpg`;
</script>

<template>
    <div class="space-y-4">
        <div>
            <h1 class="text-xl font-bold text-mist-100">Dashboard</h1>
            <p class="text-xs text-mist-400">Live operational activity for {{ currentDay }}</p>
        </div>

        <!-- Monthly Summary Cards -->
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div class="rounded-lg border border-mist-800 bg-mist-900 p-4 shadow-md">
                <p class="text-xs uppercase font-bold text-mist-400">Monthly Revenue</p>
                <p class="mt-1 font-mono text-lg font-bold text-white">
                    {{ formatIDR(totalPayout) }}
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
            <div class="rounded-lg border border-mist-800 bg-mist-900 p-4 shadow-md">
                <p class="text-xs uppercase font-bold text-mist-400">Occupancy Rate</p>
                <p class="text-lg font-bold text-mist-100 mt-1">{{ occupancyPercentage }}%</p>
                <div class="w-full bg-mist-800 h-1.5 rounded-full overflow-hidden my-2">
                    <div
                        class="bg-lime-500 h-full transition-all duration-300"
                        :style="{ width: `${occupancyPercentage}%` }"></div>
                </div>
                <p class="text-xs text-mist-500 mt-1">
                    {{ occupiedNights }} / {{ totalCapacityNights }} nights booked
                </p>
            </div>
            <div class="rounded-lg border border-mist-800 bg-mist-900 p-4 shadow-md">
                <p class="text-xs uppercase font-bold text-mist-400">Total Month Bookings</p>
                <p class="text-lg font-bold text-mist-100 mt-1">
                    {{ totalBookingsCount }}
                </p>
                <p class="text-xs text-mist-500 mt-1">Active bookings</p>
            </div>
            <div class="rounded-lg border border-mist-800 bg-mist-900 p-4 shadow-md">
                <p class="text-xs uppercase font-bold text-mist-400">Today's Turnover</p>
                <div class="text-lg font-bold text-mist-200 mt-1">
                    <span class="text-lime-400 mr-3">↓ {{ todaysTurnover.in }} In</span>
                    <span class="text-amber-400">↑ {{ todaysTurnover.out }} Out</span>
                </div>
                <p class="text-xs text-mist-500 mt-1">Scheduled for today</p>
            </div>
        </div>

        <!-- Daily Operations -->
        <div class="mt-8">
            <h1 class="text-xl font-bold text-mist-100">Daily Operations</h1>
            <p class="text-xs text-mist-400">Active Stays</p>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <!-- Arriving Today -->
            <div class="shadow-md">
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
                        class="flex flex-1 items-center justify-center text-center text-xs text-mist-500 min-h-10">
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
                                    {{ formatDate(b.checkOut, { shortMonth: true }) }} &bull;
                                    {{ b.nights }} night(s)
                                </span>
                                <span>{{ b.listing }}</span>
                            </div>
                            <div class="flex justify-end text-xs text-mist-400">
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
                    class="h-full flex flex-col space-y-3 rounded-lg border border-mist-800 bg-mist-900 p-4">
                    <div
                        class="flex items-center justify-between border-b border-mist-800 pb-4 mb-4">
                        <h2 class="text-xs font-bold uppercase text-mist-300">Currently Staying</h2>
                        <span
                            class="rounded bg-mist-500/20 px-2 py-0.5 text-[10px] font-bold text-mist-400">
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
                                    {{ formatDate(b.checkOut, { shortMonth: true }) }} &bull;
                                    {{ b.nights }} night(s)
                                </span>
                                <span>{{ b.listing }}</span>
                            </div>
                            <div class="flex justify-end text-xs text-mist-400">
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
                                    {{ formatDate(b.checkOut, { shortMonth: true }) }} &bull;
                                    {{ b.nights }} night(s)
                                </span>
                                <span>{{ b.listing }}</span>
                            </div>
                            <div class="flex justify-end text-xs text-mist-400">
                                <span class="font-mono text-lime-400">
                                    {{ formatIDR(b.payout) }}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Properties -->
        <div class="grid grid-cols-1 gap-4 shadow-md">
            <div class="overflow-x-auto rounded-lg border border-mist-800 bg-mist-900">
                <table class="w-full text-left text-sm text-mist-300 table-fixed">
                    <thead
                        class="border-b border-mist-800 bg-mist-950/60 text-xs uppercase text-mist-500">
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
                                    <OccupiedTag
                                        :bookings="bookings"
                                        :property="property" />
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
</template>
