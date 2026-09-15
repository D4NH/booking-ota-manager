<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useMonthlyMetrics } from '@/composables/useMonthlyMetrics';
import { usePropertyDetails } from '@/composables/usePropertyDetails';
import { useRevenueComparison } from '@/composables/useRevenueData';
import { useBookingStore } from '@/stores/useBookingStore';
import { useModalStore } from '@/stores/useModalStore';
import { usePropertyStore } from '@/stores/usePropertyStore';
import type { PropertyId } from '@/types/property';

import CardTitle from '@/components/CardTitle.vue';
import PageTitle from '@/components/PageTitle.vue';
import ChannelDistribution from '@/components/charts/ChannelDistribution.vue';
import PortfolioMetrics from '@/components/PortfolioMetrics.vue';
import PropertyCard from '@/components/PropertyCard.vue';
import PropertyPerformance from '@/components/PropertyPerformance.vue';
import MonthlyEarnings from '@/components/charts/MonthlyEarnings.vue';
import AnnualRevenue from '@/components/charts/AnnualRevenue.vue';

const route = useRoute();
const router = useRouter();
const modalStore = useModalStore();
const propertyStore = usePropertyStore();
const bookingStore = useBookingStore();
const { bookings } = storeToRefs(bookingStore);
const { sortedProperties } = storeToRefs(propertyStore);

const { getWeeklyComparison, getMonthlyComparison } = useRevenueComparison();
const { monthlyPropertyData } = useMonthlyMetrics(bookings);

const { totalRevenue } = usePropertyDetails(() => 'all');

const isPropertiesExpanded = ref(false);

const visibleProperties = computed(() => {
    const list = Array.isArray(sortedProperties) ? sortedProperties : sortedProperties.value;
    return isPropertiesExpanded.value ? list : list.slice(0, 2);
});
const selectedProperty = computed<PropertyId | 'all'>(() => {
    const id = route.params.id;
    return typeof id === 'string' && id ? (id as PropertyId) : 'all';
});

const navigateToDetail = (propertyId: PropertyId | 'all') => {
    if (propertyId === 'all') router.push({ name: 'properties' });
    else router.push({ name: 'property-detail', params: { id: propertyId } });
};
const handleAddProperty = () => modalStore.openPropertyModal();
</script>

<template>
    <div class="h-full overflow-y-auto space-y-4 p-4">
        <PageTitle>
            <template #title>Property Management</template>
            <template #subtitle>Portfolio health, listing settings and unit comparisons</template>

            <!-- Property Selector -->
            <div class="flex items-center gap-1 rounded-md border border-mist-800 bg-mist-900 p-1">
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
        </PageTitle>

        <PortfolioMetrics
            :bookings="bookings"
            :properties="sortedProperties" />

        <!-- Properties Cards List -->
        <div class="flex flex-col shrink-0">
            <div class="flex items-center justify-between">
                <CardTitle>
                    <template #title>Properties</template>
                    <template #subtitle
                        >Real-time availability and unit operational status</template
                    >
                </CardTitle>

                <div class="flex gap-4">
                    <button
                        v-if="sortedProperties.length > 2"
                        type="button"
                        class="flex items-center gap-1.5 rounded-md border border-mist-700 bg-mist-900 px-3 py-1.5 text-xs text-mist-300 hover:border-mist-700 hover:text-mist-100 transition shadow-sm cursor-pointer"
                        @click="isPropertiesExpanded = !isPropertiesExpanded">
                        <span>
                            {{
                                isPropertiesExpanded
                                    ? 'Show Less'
                                    : `Show All (${sortedProperties.length})`
                            }}
                        </span>
                        <fa-icon
                            icon="chevron-down"
                            class="text-[10px] transition-transform duration-200"
                            :class="{ 'rotate-180': isPropertiesExpanded }" />
                    </button>
                    <button
                        type="button"
                        class="cursor-pointer rounded-md bg-lime-500 hover:bg-lime-400 px-4 py-2 text-xs font-semibold text-mist-950"
                        @click="handleAddProperty">
                        <fa-icon
                            class="text-xs"
                            icon="plus" />
                        Add Property
                    </button>
                </div>
            </div>

            <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div
                    v-if="sortedProperties.length === 0"
                    class="flex flex-1 flex-col col-span-2 items-center justify-center rounded-md border border-mist-800 shadow-md text-xs text-mist-400 p-4">
                    <fa-icon
                        icon="house"
                        class="text-xl" />
                    <p class="mt-2">No properties found</p>
                </div>
                <PropertyCard
                    v-for="property in visibleProperties"
                    :key="property.id"
                    :property="property"
                    :bookings="bookings"
                    :use-daily-ops="true" />
            </div>
        </div>

        <!-- Analytics Charts -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <MonthlyEarnings
                :weekly-data="getWeeklyComparison(bookings, 'all')"
                :monthly-data="getMonthlyComparison(bookings, 'all')" />
            <ChannelDistribution :bookings="bookings" />
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AnnualRevenue
                :data="monthlyPropertyData"
                :total-revenue="totalRevenue" />
            <PropertyPerformance
                :bookings="bookings"
                :properties="sortedProperties" />
        </div>
    </div>
</template>
