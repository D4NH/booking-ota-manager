<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useBookingStore } from '@/stores/useBookingStore';
import { useModalStore } from '@/stores/useModalStore';
import { usePropertyStore } from '@/stores/usePropertyStore';
import type { PropertyId, Property } from '@/types/property';

import ChannelDistribution from '@/components/charts/ChannelDistribution.vue';
import PortfolioMetrics from '@/components/PortfolioMetrics.vue';
import PropertyCard from '@/components/PropertyCard.vue';
// import PropertiesMap from '@/components/PropertiesMap.vue';
import UnitComparison from '@/components/UnitComparison.vue';

const route = useRoute();
const router = useRouter();
const bookingStore = useBookingStore();
const { bookings } = storeToRefs(bookingStore);
const modalStore = useModalStore();
const propertyStore = usePropertyStore();
const { sortedProperties } = storeToRefs(propertyStore);

const selectedProperty = computed<string>(() => {
    const id = route.params.id;
    return typeof id === 'string' && id ? id : 'all';
});

const navigateToDetail = (propertyId: PropertyId | 'all') =>
    propertyId === 'all'
        ? router.push({ name: 'properties' })
        : router.push({ name: 'property-detail', params: { id: propertyId } });

const handleEditProperty = (prop: Property) => {
    modalStore.openPropertyModal({ property: prop });
};
</script>

<template>
    <div class="flex flex-col h-full min-h-0 overflow-y-auto">
        <!-- Header Bar -->
        <div class="flex shrink-0 items-center justify-between my-4">
            <div>
                <h1 class="text-xl font-bold text-mist-100">Property Management</h1>
                <p class="text-xs text-mist-400">
                    Portfolio health, listing settings, and unit comparisons
                </p>
            </div>
            <!-- Property Filter Tabs -->
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
        </div>

        <!-- Portfolio Metric Pills -->
        <PortfolioMetrics
            :bookings="bookings"
            :total-properties="sortedProperties.length" />

        <!-- Properties -->
        <div class="flex items-center justify-between">
            <div class="mt-8 mb-4">
                <h2 class="text-sm font-bold uppercase tracking-wider text-mist-100">Properties</h2>
                <p class="mt-0.5 text-xs text-mist-500">Click to view the full unit details</p>
            </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <PropertyCard
                v-for="property in sortedProperties"
                :key="property.id"
                :property="property"
                :properties="sortedProperties"
                :bookings="bookings"
                @edit="handleEditProperty" />
        </div>

        <!-- Analytics -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <UnitComparison
                :bookings="bookings"
                :properties="sortedProperties" />

            <ChannelDistribution :bookings="bookings" />

            <!-- <PropertiesMap
                    :properties="sortedProperties"
                    class="col-span-2" /> -->
        </div>
    </div>
</template>
