<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useDailyOperations } from '@/composables/useDailyOperations';
import { useMonthlyMetrics } from '@/composables/useMonthlyMetrics';
import { useBookingStore } from '@/stores/useBookingStore';
import { useModalStore } from '@/stores/useModalStore';
import { usePropertyStore } from '@/stores/usePropertyStore';
import type { Booking } from '@/types/booking';
import { formatIDR } from '@/utils/money';
import { getCurrentMonth, formatDate } from '@/utils/date';

import PropertyCard from '@/components/PropertyCard.vue';
import MonthOverMonth from '@/components/charts/MonthOverMonth.vue';
import RecentBookings from '@/components/RecentBookings.vue';

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

const handleEditBooking = (booking: Booking) => {
    modalStore.openBookingModal({ booking });
};
</script>

<template>
    <!-- To make page fit viewport: flex flex-col h-full min-h-0 gap-4 -->
    <!-- To make scrollable: h-full min-h-0 overflow-y-auto space-y-4 -->
    <div class="h-full min-h-0 overflow-y-auto">
        <div class="shrink-0 my-4">
            <h1 class="text-xl font-bold text-mist-100">Dashboard</h1>
            <div class="mt-1 text-xs text-mist-400">
                Live operational activity for
                <span class="font-bold">
                    {{ formatDate(getCurrentMonth(), { monthHeader: true }) }}
                </span>
            </div>
        </div>
        <!-- Monthly Summary Cards -->
        <div class="shrink-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md space-y-1">
                <h3 class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                    Monthly Revenue
                </h3>
                <p class="font-mono text-lg font-bold text-mist-100">
                    {{ formatIDR(totalPayout) }}
                </p>
                <p class="flex items-center gap-1 text-xs">
                    <span
                        class="font-medium"
                        :class="revenueGrowthPercent >= 0 ? 'text-lime-400' : 'text-rose-400'">
                        {{ revenueGrowthPercent >= 0 ? '+' : '' }}{{ revenueGrowthPercent }}%
                    </span>
                    <span class="text-mist-500">vs last month</span>
                </p>
            </div>
            <div class="rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md space-y-1">
                <h3 class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                    Occupancy Rate
                </h3>
                <p class="font-mono text-lg font-bold text-mist-100">{{ occupancyPercentage }}%</p>
                <!-- <div class="w-full bg-mist-800 h-1.5 rounded-md overflow-hidden my-2">
                    <div
                        class="bg-lime-500 h-full transition-all duration-300"
                        :style="{ width: `${occupancyPercentage}%` }"></div>
                </div> -->
                <p class="text-xs text-mist-500">
                    {{ occupiedNights }} / {{ totalCapacityNights }} nights booked
                </p>
            </div>
            <div class="rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md space-y-1">
                <h3 class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                    Total Month Bookings
                </h3>
                <p class="font-mono text-lg font-bold text-mist-100">
                    {{ totalBookingsCount }}
                </p>
                <p class="text-xs text-mist-500">Active bookings</p>
            </div>
            <div class="rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md space-y-1">
                <h3 class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                    Today's Turnover
                </h3>
                <p class="text-lg font-bold text-mist-100">
                    <span class="text-lime-400 mr-3">
                        ↓ <span class="font-mono">{{ todaysTurnover.in }}</span> In
                    </span>
                    <span class="text-amber-400">
                        ↑ <span class="font-mono">{{ todaysTurnover.out }}</span> Out
                    </span>
                </p>
                <p class="text-xs text-mist-500">Scheduled for today</p>
            </div>
        </div>
        <!-- Recent Bookings -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="flex flex-col shrink-0">
                <div class="mt-8 mb-4">
                    <h2 class="text-sm font-bold uppercase tracking-wider text-mist-100">
                        Recent Bookings
                    </h2>
                    <p class="mt-1 text-xs text-mist-500">
                        Latest reservations across all channels
                    </p>
                </div>
                <RecentBookings
                    :bookings="bookings"
                    @select-booking="handleEditBooking" />
            </div>

            <!-- Revenue Performance -->
            <MonthOverMonth :bookings="bookings" />
        </div>
        <!-- Properties -->
        <div class="flex flex-col shrink-0">
            <div class="mt-8 mb-4">
                <h2 class="text-sm font-bold uppercase tracking-wider text-mist-100">Properties</h2>
                <p class="mt-1 text-xs text-mist-500">
                    Real-time availability and unit operational status
                </p>
            </div>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                <PropertyCard
                    v-for="property in sortedProperties"
                    :key="property.id"
                    :property="property"
                    :bookings="bookings"
                    :use-daily-ops="true" />
            </div>
        </div>
    </div>
</template>
