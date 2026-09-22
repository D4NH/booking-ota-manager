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

const handleEditBooking = (booking: Booking) => modalStore.openBookingModal({ booking });
</script>

<template>
    <div class="h-full overflow-y-auto space-y-4 p-4">
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
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md space-y-1">
                <h3 class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                    Monthly Revenue
                </h3>
                <p class="font-mono text-lg font-semibold text-mist-100">
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
            <div class="rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md space-y-1">
                <h3 class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                    Total Month Bookings
                </h3>
                <p class="font-mono text-lg font-semibold text-mist-100">
                    {{ totalBookingsCount }}
                </p>
                <p class="text-xs text-mist-500">Active bookings</p>
            </div>
            <div class="rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md space-y-1">
                <h3 class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                    Today's Turnover
                </h3>
                <p class="text-lg font-semibold text-mist-100">
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

        <!-- Recent Bookings & Revenue Performance-->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <UpcomingBookings
                :bookings="bookings"
                @edit-booking="handleEditBooking" />

            <RevenuePerformance :bookings="bookings" />
        </div>

        <!-- Properties -->
        <div class="flex flex-col">
            <CardTitle>
                <template #title>Properties</template>
                <template #subtitle> Real-time availability and unit operational status </template>
            </CardTitle>
            <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div
                    v-if="sortedProperties.length === 0"
                    class="col-span-2 flex flex-1 flex-col items-center justify-center rounded-md border border-mist-800 shadow-md text-xs text-mist-400 p-4">
                    <fa-icon
                        icon="house"
                        class="text-xl" />
                    <p class="mt-2">No properties found</p>
                </div>
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
