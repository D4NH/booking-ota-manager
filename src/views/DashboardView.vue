<script setup lang="ts">
import { ref, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useDailyOperations } from '@/composables/useDailyOperations';
import { useMonthlyMetrics } from '@/composables/useMonthlyMetrics';
import { useBookingStore } from '@/stores/useBookingStore';
import { useModalStore } from '@/stores/useModalStore';
import { usePropertyStore } from '@/stores/usePropertyStore';
import type { Booking } from '@/types/booking';
import { formatIDR } from '@/utils/money';
import { getCurrentMonth, formatDate } from '@/utils/date';

import CardTitle from '@/components/CardTitle.vue';
import PageTitle from '@/components/PageTitle.vue';
import PropertyCard from '@/features/properties/PropertyCard.vue';
import RevenuePerformance from '@/features/dashboard/RevenuePerformance.vue';
import UpcomingBookings from '@/features/bookings/UpcomingBookings.vue';

const bookingStore = useBookingStore();
const { bookings } = storeToRefs(bookingStore);
const modalStore = useModalStore();
const propertyStore = usePropertyStore();
const { sortedProperties } = storeToRefs(propertyStore);

const { todaysTurnover } = useDailyOperations(bookings);
const {
    totalPayout,
    occupiedNights,
    totalCapacityNights,
    occupancyPercentage,
    totalBookingsCount,
    revenueGrowthPercent,
} = useMonthlyMetrics(bookings);

const isPropertiesExpanded = ref(false);

const visibleProperties = computed(() =>
    isPropertiesExpanded.value ? sortedProperties.value : sortedProperties.value.slice(0, 2)
);

function handleEditBooking(booking: Booking): void {
    modalStore.openBookingModal({ booking });
}
</script>

<template>
    <div class="h-full space-y-4 overflow-y-auto p-4">
        <PageTitle>
            <template #title> Dashboard </template>
            <template #subtitle>
                Live operational activity for
                <span class="font-semibold">
                    {{ formatDate(getCurrentMonth(), { monthHeader: true }) }}
                </span>
            </template>
        </PageTitle>

        <!-- Monthly Summary -->
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div class="space-y-1 rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md">
                <h3 class="text-xs font-semibold tracking-wider text-mist-400 uppercase">
                    Monthly Revenue
                </h3>
                <p class="font-mono text-lg font-semibold text-mist-100">
                    {{ formatIDR(totalPayout) }}
                </p>
                <p class="flex items-center gap-1 text-xs">
                    <span
                        class="font-medium"
                        :class="revenueGrowthPercent >= 0 ? 'text-lime-400' : 'text-rose-400'">
                        <fa-icon
                            :icon="
                                revenueGrowthPercent >= 0 ? 'arrow-trend-up' : 'arrow-trend-down'
                            " />
                        {{ Math.abs(revenueGrowthPercent) }}%
                    </span>
                    <span class="text-mist-500">vs last month</span>
                </p>
            </div>
            <div class="space-y-1 rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md">
                <h3 class="text-xs font-semibold tracking-wider text-mist-400 uppercase">
                    Occupancy Rate
                </h3>
                <p class="font-mono text-lg font-semibold text-mist-100">
                    {{ occupancyPercentage }}%
                </p>
                <!-- <div class="w-full bg-mist-800 h-1.5 rounded-md overflow-hidden my-2">
                    <div
                        class="bg-lime-500 h-full transition-all duration-300"
                        :style="{ width: `${occupancyPercentage}%` }"></div>
                </div> -->
                <p class="text-xs text-mist-500">
                    {{ occupiedNights }} / {{ totalCapacityNights }} nights booked
                </p>
            </div>
            <div class="space-y-1 rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md">
                <h3 class="text-xs font-semibold tracking-wider text-mist-400 uppercase">
                    Monthly Bookings
                </h3>
                <p class="font-mono text-lg font-semibold text-mist-100">
                    {{ totalBookingsCount }}
                </p>
                <p class="text-xs text-mist-500">Active bookings</p>
            </div>
            <div class="space-y-1 rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md">
                <h3 class="text-xs font-semibold tracking-wider text-mist-400 uppercase">
                    Today's Turnover
                </h3>
                <p class="flex gap-3 text-lg font-semibold text-mist-100">
                    <span class="flex items-center gap-1 text-lime-400">
                        <fa-icon
                            class="text-sm"
                            icon="arrow-down" />
                        <span class="font-mono">{{ todaysTurnover.in }}</span> In
                    </span>
                    <span class="flex items-center gap-1 text-amber-400">
                        <fa-icon
                            class="text-sm"
                            icon="arrow-up" />
                        <span class="font-mono">{{ todaysTurnover.out }}</span> Out
                    </span>
                </p>
                <p class="text-xs text-mist-500">Scheduled for today</p>
            </div>
        </div>

        <!-- Recent Bookings & Revenue Performance-->
        <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <UpcomingBookings
                :bookings="bookings"
                @edit-booking="handleEditBooking" />

            <RevenuePerformance :bookings="bookings" />
        </div>

        <!-- Properties -->
        <div class="flex flex-col">
            <div class="flex items-center justify-between">
                <CardTitle>
                    <template #title>Properties</template>
                    <template #subtitle> Operational status and unit specifications </template>
                </CardTitle>
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
    </div>
</template>
