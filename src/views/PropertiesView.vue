<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useRoute, useRouter } from 'vue-router';
import { useDailyOperations } from '@/composables/useDailyOperations';
import { useMonthlyMetrics } from '@/composables/useMonthlyMetrics';
import {
    useOccupancy,
    calculateYearlyOccupancy,
    getBookedPropertiesCount,
} from '@/composables/useOccupancy';
import { PROPERTY_LIST, getPropertyTheme } from '@/config/properties';
import { useBookingStore } from '@/stores/useBookingStore';
import { useModalStore } from '@/stores/useModalStore';
import { usePropertyStore } from '@/stores/usePropertyStore';
import type { Booking } from '@/types/booking';
import type { PropertyId } from '@/types/property';
import { formatDate } from '@/utils/date';
import { formatIDR } from '@/utils/money';

import PropertyCard from '@/components/PropertyCard.vue';
import ChannelBreakdown from '@/components/charts/ChannelBreakdown.vue';
import OccupancyRate from '@/components/charts/OccupancyRate.vue';
import SalesStatistics from '@/components/charts/SalesStatistics.vue';

const route = useRoute();
const router = useRouter();

const bookingStore = useBookingStore();
const modalStore = useModalStore();
const propertyStore = usePropertyStore();
const { bookings } = storeToRefs(bookingStore);
const { sortedProperties } = storeToRefs(propertyStore);
const { calculateMonthlyOccupancy } = useOccupancy();

const activePropertiesCount = computed(() => getBookedPropertiesCount(bookings.value));
const selectedPropertyId = computed<string>(() => {
    const id = route.params.id;

    return typeof id === 'string' && id ? id : 'all';
});
// Separate computed for property NAME
const activePropertyName = computed<string>(() => {
    if (selectedPropertyId.value === 'all') {
        return 'Property Management';
    }

    const property = sortedProperties.value.find((prop) => prop.id === selectedPropertyId.value);
    return property?.name ?? '';
});

const totalRevenue = computed(() => bookings.value.reduce((acc, b) => acc + (b.payout || 0), 0));
const occupancyStats = computed(() => {
    const currentDate = new Date();
    const monthlyStats = calculateMonthlyOccupancy(
        bookings.value,
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
        'all',
        activePropertiesCount.value
    );
    const yearlyStats = calculateYearlyOccupancy(bookings.value, currentDate.getFullYear());

    return { monthlyStats, yearlyStats };
});
const { todaysArrivals, todaysDepartures, currentStays, todaysTurnover } = useDailyOperations(
    bookings,
    { propertyId: selectedPropertyId }
);
const {
    totalPayout,
    occupiedNights,
    totalCapacityNights,
    occupancyPercentage,
    totalBookingsCount,
    revenueGrowthPercent,
    monthlyPropertyData,
} = useMonthlyMetrics(bookings, sortedProperties, { propertyId: selectedPropertyId });

const handleTabChange = (tabId: string) =>
    tabId === 'all'
        ? router.push({ name: 'properties' })
        : router.push({ name: 'property-detail', params: { id: tabId } });
const handleEditBooking = (booking: Booking) => modalStore.openBookingModal({ booking });
const handleEditProperty = (propertyId: PropertyId) => {
    const property = sortedProperties.value.find((p) => p.id === propertyId);
    modalStore.openPropertyModal({ property });
};
</script>

<template>
    <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mt-4">
            <div>
                <h1 class="text-xl font-bold text-mist-100">{{ activePropertyName }}</h1>
                <p class="mt-1 text-xs text-mist-400">
                    Select a property to view detailed analytics or manage listing settings
                </p>
            </div>
            <!-- Switcher Tabs -->
            <div class="flex items-center gap-1 rounded-md border border-mist-800 bg-mist-900 p-1">
                <button
                    type="button"
                    class="cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
                    :class="[
                        selectedPropertyId === 'all'
                            ? 'bg-mist-800 text-lime-400 shadow-md'
                            : 'text-mist-400 hover:text-mist-200',
                    ]"
                    @click="handleTabChange('all')">
                    All
                </button>
                <button
                    v-for="prop in PROPERTY_LIST"
                    :key="prop.id"
                    type="button"
                    class="capitalize rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
                    :class="[
                        selectedPropertyId === prop.id
                            ? 'bg-mist-800 text-lime-400 shadow-md'
                            : 'text-mist-400 hover:text-mist-200',
                    ]"
                    @click="handleTabChange(prop.id)">
                    {{ prop.id }}
                </button>
            </div>
            <!-- <button
                    type="button"
                    class="ml-5 cursor-pointer rounded-md bg-lime-400 px-4 py-2 text-xs font-bold text-mist-950 transition-colors hover:bg-lime-300"
                    @click="handleAddProperty">
                    + Add Property
                </button> -->
        </div>

        <div
            v-if="route.meta.isOverview"
            class="flex flex-col gap-4">
            <!-- Charts -->
            <div class="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <SalesStatistics
                    class="lg:col-span-2"
                    :data="monthlyPropertyData"
                    :total-revenue="totalRevenue" />
                <ChannelBreakdown :bookings="bookings" />
                <OccupancyRate :stats="occupancyStats" />
            </div>

            <div class="mt-4">
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
                            <h3
                                class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                                Arriving Today
                            </h3>
                            <span
                                class="rounded-md bg-mist-500/20 px-2 py-0.5 text-[10px] font-bold text-mist-400">
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
                                        class="capitalize rounded-md px-2 py-0.5 text-xs font-medium"
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
                        class="h-full flex flex-col space-y-3 rounded-md border border-mist-800 bg-mist-900 p-4">
                        <div
                            class="flex items-center justify-between border-b border-mist-800 pb-4 mb-4">
                            <h3
                                class="text-xs font-semibold uppercase tracking-wider text-mist-400">
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
                                    <RouterLink
                                        :to="{
                                            name: 'property-detail',
                                            params: { id: b.propertyId },
                                        }"
                                        class="capitalize rounded-md px-2 py-0.5 text-xs font-medium"
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
                        class="h-full flex flex-col space-y-3 rounded-md border border-mist-800 bg-mist-900 p-4">
                        <div
                            class="flex items-center justify-between border-b border-mist-800 pb-4 mb-4">
                            <h3
                                class="text-xs font-semibold uppercase tracking-wider text-mist-400">
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
                                    <RouterLink
                                        :to="{
                                            name: 'property-detail',
                                            params: { id: b.propertyId },
                                        }"
                                        class="capitalize rounded-md px-2 py-0.5 text-xs font-medium"
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

            <div class="mt-4">
                <h1 class="text-xl font-bold text-mist-100">Properties</h1>
                <p class="text-xs text-mist-400">
                    Real-time availability and unit operational status
                </p>
            </div>
            <!-- Properties -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <PropertyCard
                    v-for="property in sortedProperties"
                    :key="property.id"
                    :property="property"
                    :properties="sortedProperties"
                    :bookings="bookings"
                    @edit="handleEditProperty(property.id)" />
            </div>
        </div>

        <!-- Monthly Summary Cards -->
        <div
            v-else
            class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div class="rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md">
                <h3 class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                    Monthly Revenue
                </h3>
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
            <div class="rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md">
                <h3 class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                    Occupancy Rate
                </h3>
                <p class="text-lg font-bold text-mist-100 mt-1">{{ occupancyPercentage }}%</p>
                <div class="w-full bg-mist-800 h-1.5 rounded-md overflow-hidden my-2">
                    <div
                        class="bg-lime-500 h-full transition-[width] duration-300"
                        :style="{ width: `${occupancyPercentage}%` }"></div>
                </div>
                <p class="text-xs text-mist-500 mt-1">
                    {{ occupiedNights }} / {{ totalCapacityNights }} nights booked
                </p>
            </div>
            <div class="rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md">
                <h3 class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                    Total Month Bookings
                </h3>
                <p class="text-lg font-bold text-mist-100 mt-1">
                    {{ totalBookingsCount }}
                </p>
                <p class="text-xs text-mist-500 mt-1">Active bookings</p>
            </div>
            <div class="rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md">
                <p class="text-xs uppercase font-bold text-mist-400">Today's Turnover</p>
                <div class="text-lg font-bold text-mist-200 mt-1">
                    <span class="text-lime-400 mr-3">↓ {{ todaysTurnover.in }} In</span>
                    <span class="text-amber-400">↑ {{ todaysTurnover.out }} Out</span>
                </div>
                <p class="text-xs text-mist-500 mt-1">Scheduled for today</p>
            </div>
        </div>

        <RouterView />
    </div>
</template>
