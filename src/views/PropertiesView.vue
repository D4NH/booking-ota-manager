<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useRevenueComparison } from '@/composables/useRevenueData';
import { useBookingStore } from '@/stores/useBookingStore';
import { useModalStore } from '@/stores/useModalStore';
import { usePropertyStore } from '@/stores/usePropertyStore';
import type { PropertyId } from '@/types/property';

import ChannelDistribution from '@/components/charts/ChannelDistribution.vue';
import PortfolioMetrics from '@/components/PortfolioMetrics.vue';
import PropertyCard from '@/components/PropertyCard.vue';
import UnitPerformance from '@/components/UnitPerformance.vue';
import MonthlyEarnings from '@/components/charts/MonthlyEarnings.vue';

const route = useRoute();
const router = useRouter();
const bookingStore = useBookingStore();
const { bookings } = storeToRefs(bookingStore);
const modalStore = useModalStore();
const propertyStore = usePropertyStore();
const { sortedProperties } = storeToRefs(propertyStore);

const { getWeeklyComparison, getMonthlyComparison } = useRevenueComparison();

const isPropertiesExpanded = ref(false);

const visibleProperties = computed(() => {
    const list = Array.isArray(sortedProperties) ? sortedProperties : sortedProperties.value;

    if (isPropertiesExpanded.value) {
        return list;
    }
    return list.slice(0, 2);
});
const selectedProperty = computed<PropertyId | 'all'>(() => {
    const id = route.params.id;
    return typeof id === 'string' && id ? (id as PropertyId) : 'all';
});

const navigateToDetail = (propertyId: PropertyId | 'all') =>
    propertyId === 'all'
        ? router.push({ name: 'properties' })
        : router.push({ name: 'property-detail', params: { id: propertyId } });

const handleAddProperty = () => {
    modalStore.openPropertyModal();
};
</script>

<template>
    <div class="flex flex-col h-full min-h-0 overflow-y-auto">
        <!-- Header Bar -->
        <div class="flex shrink-0 items-center justify-between my-4">
            <div>
                <h1 class="text-xl font-bold text-mist-100">Property Management</h1>
                <p class="text-xs text-mist-400">
                    Portfolio health, listing settings and unit comparisons
                </p>
            </div>
            <div class="flex items-center">
                <button
                    type="button"
                    class="mr-4 cursor-pointer rounded-md bg-lime-500 hover:bg-lime-400 px-4 py-2 text-xs font-semibold text-mist-950"
                    @click="handleAddProperty">
                    <fa-icon
                        class="text-xs"
                        icon="plus" />
                    Add Property
                </button>
                <!-- Property Filter Tabs -->
                <div
                    class="flex items-center gap-1 rounded-md border border-mist-800 bg-mist-900 p-1">
                    <button
                        type="button"
                        class="cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
                        :class="[
                            selectedProperty === 'all'
                                ? 'bg-mist-800 text-lime-400 shadow-md'
                                : 'text-mist-400 hover:text-mist-200',
                        ]"
                        @click="navigateToDetail('all')">
                        All
                    </button>
                    <button
                        v-for="prop in sortedProperties"
                        :key="prop.id"
                        type="button"
                        class="capitalize rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
                        :class="[
                            selectedProperty === prop.id
                                ? 'bg-mist-800 text-lime-400 shadow-md'
                                : 'text-mist-400 hover:text-mist-200',
                        ]"
                        @click="navigateToDetail(prop.id)">
                        {{ prop.id }}
                    </button>
                </div>
            </div>
        </div>
        <PortfolioMetrics
            :bookings="bookings"
            :properties="sortedProperties" />

        <!-- Properties -->
        <div class="flex flex-col shrink-0">
            <!-- Header with Toggle Button -->
            <div class="mt-8 mb-4 flex items-center justify-between">
                <div>
                    <h2 class="text-sm font-bold uppercase tracking-wider text-mist-100">
                        Properties
                    </h2>
                    <p class="mt-0.5 text-xs text-mist-500">
                        Real-time availability and unit operational status
                    </p>
                </div>

                <!-- Toggle Button (only displays if there are more than 2 properties) -->
                <button
                    v-if="sortedProperties.length > 2"
                    type="button"
                    class="flex items-center gap-1.5 rounded-lg border border-mist-800 bg-mist-900 px-3 py-1.5 text-xs font-semibold text-mist-300 hover:border-mist-700 hover:text-mist-100 transition shadow-sm cursor-pointer"
                    @click="isPropertiesExpanded = !isPropertiesExpanded">
                    <span>{{
                        isPropertiesExpanded ? 'Show Less' : `Show All (${sortedProperties.length})`
                    }}</span>
                    <fa-icon
                        icon="chevron-down"
                        class="text-[10px] transition-transform duration-200"
                        :class="{ 'rotate-180': isPropertiesExpanded }" />
                </button>
            </div>

            <!-- Properties Grid (Loops over visibleProperties) -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                <PropertyCard
                    v-for="property in visibleProperties"
                    :key="property.id"
                    :property="property"
                    :bookings="bookings"
                    :use-daily-ops="true" />
            </div>
        </div>

        <!-- Analytics -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <MonthlyEarnings
                :weekly-data="getWeeklyComparison(bookings, 'all')"
                :monthly-data="getMonthlyComparison(bookings, 'all')" />

            <ChannelDistribution :bookings="bookings" />
        </div>

        <div class="grid grid-cols-1 gap-4 mb-4">
            <UnitPerformance
                class="mb-4"
                :bookings="bookings"
                :properties="sortedProperties" />
        </div>
    </div>
</template>
