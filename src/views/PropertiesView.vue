<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { usePropertyDetails } from '@/composables/usePropertyDetails';
import { useRevenueComparison } from '@/composables/useRevenueData';
import { useBookingStore } from '@/stores/useBookingStore';
import { useModalStore } from '@/stores/useModalStore';
import { usePropertyStore } from '@/stores/usePropertyStore';
import type { PropertyId } from '@/types/property';

import CardTitle from '@/components/CardTitle.vue';
import PageTitle from '@/components/PageTitle.vue';
import PropertySelector from '@/components/PropertySelector.vue';
import ChannelDistribution from '@/features/properties/ChannelDistribution.vue';
import PortfolioMetrics from '@/features/properties/PortfolioMetrics.vue';
import PropertyCard from '@/features/properties/PropertyCard.vue';
import PropertyPerformance from '@/features/properties/PropertyPerformance.vue';
import MonthlyEarnings from '@/features/properties/MonthlyEarnings.vue';
import AnnualRevenue from '@/features/properties/AnnualRevenue.vue';

const router = useRouter();
const bookingStore = useBookingStore();
const { bookings } = storeToRefs(bookingStore);
const modalStore = useModalStore();
const propertyStore = usePropertyStore();
const { sortedProperties } = storeToRefs(propertyStore);

const { getWeeklyComparison, getMonthlyComparison } = useRevenueComparison();
const { totalYearRevenue } = usePropertyDetails(() => 'all');

const isPropertiesExpanded = ref(false);

const visibleProperties = computed(() =>
    isPropertiesExpanded.value ? sortedProperties.value : sortedProperties.value.slice(0, 2)
);

function handleNavigate(target: PropertyId | 'all'): void {
    if (target === 'all') return;
    router.push({ name: 'property-detail', params: { id: target } });
}
function handleAddProperty(): void {
    modalStore.openPropertyModal();
}
</script>

<template>
    <div class="h-full space-y-4 overflow-y-auto p-4">
        <PageTitle>
            <template #title>Property Management</template>
            <template #subtitle>
                Portfolio performance, listing settings and unit comparisons
            </template>
            <PropertySelector
                model-value="all"
                @change="handleNavigate" />
        </PageTitle>

        <PortfolioMetrics
            :bookings="bookings"
            :properties="sortedProperties" />

        <!-- Properties -->
        <div class="flex shrink-0 flex-col">
            <div class="flex items-center justify-between">
                <CardTitle>
                    <template #title>Properties</template>
                    <template #subtitle> Operational status and unit specifications </template>
                </CardTitle>

                <div class="flex items-center gap-2">
                    <button
                        v-if="sortedProperties.length > 2"
                        type="button"
                        class="flex cursor-pointer items-center gap-1.5 rounded-md border border-mist-800 bg-mist-950/50 py-2 pr-1.5 pl-3 text-xs text-mist-300 shadow-sm transition-colors hover:border-mist-700 hover:text-mist-100"
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
                        class="cursor-pointer rounded-md bg-lime-500 px-4 py-2 text-xs font-semibold text-mist-950 transition-colors hover:bg-lime-400"
                        @click="handleAddProperty">
                        <fa-icon
                            class="mr-1 text-xs"
                            icon="plus" />
                        Add Property
                    </button>
                </div>
            </div>

            <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div
                    v-if="sortedProperties.length === 0"
                    class="col-span-2 flex flex-1 flex-col items-center justify-center rounded-md border border-mist-800 p-8 text-xs text-mist-400 shadow-md">
                    <fa-icon
                        icon="house"
                        class="text-xl" />
                    <p class="mt-2">No properties registered</p>
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
        <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <MonthlyEarnings
                :weekly-data="getWeeklyComparison(bookings, 'all')"
                :monthly-data="getMonthlyComparison(bookings, 'all')" />

            <ChannelDistribution :bookings="bookings" />
        </div>

        <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <AnnualRevenue
                :bookings="bookings"
                :total-revenue="totalYearRevenue" />

            <PropertyPerformance
                :bookings="bookings"
                :properties="sortedProperties" />
        </div>
    </div>
</template>
