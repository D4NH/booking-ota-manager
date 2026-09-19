<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
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
import PropertySelector from '@/components/PropertySelector.vue';
import MonthlyEarnings from '@/components/charts/MonthlyEarnings.vue';
import AnnualRevenue from '@/components/charts/AnnualRevenue.vue';

const router = useRouter();
const modalStore = useModalStore();
const propertyStore = usePropertyStore();
const bookingStore = useBookingStore();

const { bookings } = storeToRefs(bookingStore);
const { sortedProperties } = storeToRefs(propertyStore);

const { getWeeklyComparison, getMonthlyComparison } = useRevenueComparison();
const { monthlyPropertyData } = useMonthlyMetrics(bookings);
const { totalYearRevenue } = usePropertyDetails(() => 'all');

const isPropertiesExpanded = ref(false);

const visibleProperties = computed(() =>
    isPropertiesExpanded.value ? sortedProperties.value : sortedProperties.value.slice(0, 2)
);

const handleNavigate = (target: PropertyId | 'all'): void => {
    if (target === 'all') return;
    router.push({ name: 'property-detail', params: { id: target } });
};
const handleAddProperty = () => modalStore.openPropertyModal();
</script>

<template>
    <div class="h-full overflow-y-auto space-y-4 p-4">
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
        <div class="flex flex-col shrink-0">
            <div class="flex items-center justify-between">
                <CardTitle>
                    <template #title>Properties</template>
                    <template #subtitle> Operational status and unit specifications </template>
                </CardTitle>

                <div class="flex items-center gap-2">
                    <button
                        v-if="sortedProperties.length > 2"
                        type="button"
                        class="flex items-center gap-1.5 rounded-md border border-mist-800 bg-mist-950/50 pl-3 pr-1.5 py-2 text-xs text-mist-300 hover:text-mist-100 transition shadow-sm cursor-pointer"
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
                        class="cursor-pointer rounded-md bg-lime-500 hover:bg-lime-400 px-4 py-2 text-xs font-semibold text-mist-950 transition"
                        @click="handleAddProperty">
                        <fa-icon
                            class="text-xs mr-1"
                            icon="plus" />
                        Add Property
                    </button>
                </div>
            </div>

            <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div
                    v-if="sortedProperties.length === 0"
                    class="flex flex-1 flex-col col-span-2 items-center justify-center rounded-md border border-mist-800 shadow-md text-xs text-mist-400 p-8">
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
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <MonthlyEarnings
                :weekly-data="getWeeklyComparison(bookings, 'all')"
                :monthly-data="getMonthlyComparison(bookings, 'all')" />

            <ChannelDistribution :bookings="bookings" />
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AnnualRevenue
                :data="monthlyPropertyData"
                :total-revenue="totalYearRevenue" />

            <PropertyPerformance
                :bookings="bookings"
                :properties="sortedProperties" />
        </div>
    </div>
</template>
