<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useRoute, useRouter } from 'vue-router';
import { useBookingStore } from '@/stores/useBookingStore';
import { useDailyOperations } from '@/composables/useDailyOperations';
import { useMonthlyMetrics } from '@/composables/useMonthlyMetrics';
import { useModalStore } from '@/stores/useModalStore';
import { usePropertyStore } from '@/stores/usePropertyStore';
import { PROPERTY_LIST } from '@/config/properties';
import type { PropertyId } from '@/types/property';
import { formatIDR } from '@/utils/money';

import PropertyStats from '@/components/PropertyStats.vue';
import PropertyCard from '@/components/PropertyCard.vue';
import ChannelBreakdown from '@/components/charts/ChannelBreakdown.vue';
import TotalRevenue from '@/components/charts/TotalRevenue.vue';

const route = useRoute();
const router = useRouter();

const bookingStore = useBookingStore();
const { bookings } = storeToRefs(bookingStore);
const modalStore = useModalStore();
const propertyStore = usePropertyStore();
const { properties, sortedProperties } = storeToRefs(propertyStore);

const selectedPropertyId = computed<string>(() => {
    const id = route.params.id;
    return typeof id === 'string' && id ? id : 'all';
});

const { todaysTurnover } = useDailyOperations(bookings, {
    propertyId: selectedPropertyId,
});
const {
    totalPayout,
    occupiedNights,
    totalCapacityNights,
    occupancyPercentage,
    totalBookingsCount,
    revenueGrowthPercent,
} = useMonthlyMetrics(bookings, properties, { propertyId: selectedPropertyId });

const handleTabChange = (tabId: string) =>
    tabId === 'all'
        ? router.push({ name: 'properties' })
        : router.push({ name: 'property-detail', params: { id: tabId } });
const handleEditProperty = (propertyId: PropertyId) => {
    const property = properties.value.find((p) => p.id === propertyId);
    modalStore.openPropertyModal({ property });
};
</script>

<template>
    <div class="mx-auto max-w-7xl space-y-4">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <h1 class="text-xl font-bold text-mist-100">Property Management</h1>
                <p class="text-xs text-mist-400">
                    Select a property to view detailed analytics or manage listing settings
                </p>
            </div>
            <!-- Switcher Tabs -->
            <div class="flex items-center gap-1 rounded-lg border border-mist-800 bg-mist-900 p-1">
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
                    class="capitalize rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
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
                    class="ml-5 cursor-pointer rounded-lg bg-lime-400 px-4 py-2 text-xs font-bold text-mist-950 transition-colors hover:bg-lime-300"
                    @click="handleAddProperty">
                    + Add Property
                </button> -->
        </div>

        <div v-if="route.meta.isOverview">
            <!-- Charts -->
            <div class="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <TotalRevenue
                    class="lg:col-span-2"
                    :data="bookings" />
                <ChannelBreakdown
                    class="lg:col-span-2"
                    :bookings="bookings" />
            </div>
            <div class="mt-12">
                <h1 class="text-xl font-bold text-mist-100">Properties</h1>
                <p class="text-xs text-mist-400">
                    Real-time availability and unit operational status
                </p>
            </div>
            <!-- Metrics -->
            <div class="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                <PropertyStats
                    v-for="property in sortedProperties"
                    :key="property.id"
                    :bookings="bookings"
                    :property-id="property.id"
                    :properties="sortedProperties" />
            </div>
            <!-- Properties -->
            <div class="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <PropertyCard
                    v-for="property in sortedProperties"
                    :key="property.id"
                    :property="property"
                    :bookings="bookings"
                    @edit-property="handleEditProperty(property.id)" />
            </div>
        </div>

        <!-- Monthly Summary Cards -->
        <div
            v-else
            class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

        <RouterView />
    </div>
</template>
