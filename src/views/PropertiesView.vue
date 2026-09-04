<script setup lang="ts">
import { ref, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useRoute, useRouter } from 'vue-router';
import { useBookingStore } from '@/stores/useBookingStore';
import { useBookingSync } from '@/composables/useBookingSync';
import { useDailyOperations } from '@/composables/useDailyOperations';
import { useMonthlyMetrics } from '@/composables/useMonthlyMetrics';
import { usePropertyStore } from '@/stores/usePropertyStore';
import { PROPERTY_LIST } from '@/config/properties';
import type { Property, PropertyId } from '@/types/property';
import { getCurrentDate, getCurrentMonth, getDaysInMonth } from '@/utils/date';
import { formatIDR } from '@/utils/money';

import PropertyModal from '@/components/PropertyModal.vue';
import ChannelBreakdown from '@/components/charts/ChannelBreakdown.vue';
import TotalRevenue from '@/components/charts/TotalRevenue.vue';

const route = useRoute();
const router = useRouter();

const bookingStore = useBookingStore();
const { bookings } = storeToRefs(bookingStore);
const propertyStore = usePropertyStore();
const { properties, sortedProperties } = storeToRefs(propertyStore);

const { syncStatus } = useBookingSync();
const { todaysArrivals, currentStays } = useDailyOperations(bookings);

const isPropertyModalOpen = ref(false);
const selectedProperty = ref<Property | null>(null);

const activeTab = computed(() =>
    (route.params.id as string) ? route.name === 'property-detail' && route.params.id : 'all'
);
const propertyName = computed(() =>
    activeTab.value === 'all'
        ? 'Property Management'
        : properties.value.find((prop) => prop.id === activeTab.value)?.name
);
const propertyBookings = computed(() =>
    activeTab.value === 'all'
        ? bookings.value
        : bookings.value.filter(
              (b) => b.propertyId === activeTab.value && b.status !== 'Unavailable'
          )
);
const propertyMetrics = computed(() => {
    const today = getCurrentDate();
    const currentHour = new Date().getHours();
    const currentMonth = getCurrentMonth();
    const daysInCurrentMonth = getDaysInMonth(currentMonth);

    return sortedProperties.value.map((property) => {
        const bookings = propertyBookings.value.filter(
            (booking) => booking.propertyId === property.id && booking.status !== 'Unavailable'
        );
        const bookingsCount = bookings.filter((booking) =>
            booking.checkIn.startsWith(currentMonth)
        ).length;
        const bookingsPayout = bookings
            .filter((booking) => booking.checkIn.startsWith(currentMonth))
            .reduce((acc, b) => acc + (b.payout || 0), 0);
        const bookedNights = bookings
            .filter((booking) => booking.checkIn.startsWith(currentMonth))
            .reduce((acc, b) => acc + (b.nights || 0), 0);
        const occupancyPercentage = Math.min(
            100,
            Math.round((bookedNights / daysInCurrentMonth) * 100)
        );
        const todaysArrival = bookings.filter((booking) => booking.checkIn === today).length;

        const todaysDeparture = bookings.filter((booking) =>
            currentHour >= 15 ? false : booking.checkOut === today
        ).length;

        return {
            property,
            bookings: bookingsCount,
            payout: bookingsPayout,
            occupancyPercentage,
            todaysArrival,
            todaysDeparture,
        };
    });
});
const occupiedPropertyIds = computed(() => {
    const ids = new Set<string>();

    for (let i = 0; i < currentStays.value.length; i++) {
        const stay = currentStays.value[i];
        if (stay?.propertyId) ids.add(stay.propertyId);
    }

    for (let i = 0; i < todaysArrivals.value.length; i++) {
        const arrival = todaysArrivals.value[i];
        if (arrival?.propertyId) ids.add(arrival.propertyId);
    }

    return ids;
});

const {
    checkoutPayout,
    occupiedNights,
    totalCapacityNights,
    occupancyPercentage,
    totalBookingsCount,
    revenueGrowthPercent,
} = useMonthlyMetrics(propertyBookings, properties);

const handleTabChange = (tabId: string) =>
    tabId === 'all'
        ? router.push({ name: 'properties' })
        : router.push({ name: 'property-detail', params: { id: tabId } });
const handleEditProperty = (id: PropertyId) => {
    const found = properties.value.find((p) => p.id === id);
    selectedProperty.value = found ? { ...found } : null;
    isPropertyModalOpen.value = true;
};
const handleSaveProperty = async (propertyData: Property) => {
    await propertyStore.saveProperty(propertyData);
    isPropertyModalOpen.value = false;
};
const propertyImage = (id: string) =>
    id === 'bantul' ? 'https://placehold.co/300x400?text=Bantul' : `/images/${id}.jpg`;
const isPropertyOccupied = (id: string): boolean => occupiedPropertyIds.value.has(id);
</script>

<template>
    <div class="mx-auto max-w-7xl space-y-4">
        <div
            v-if="syncStatus"
            class="rounded-lg border border-lime-500/30 bg-lime-500/10 p-3 text-xs text-lime-300">
            {{ syncStatus }}
        </div>

        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <h1 class="text-xl font-bold text-mist-100">
                    {{ propertyName }}
                </h1>
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
                        activeTab === 'all'
                            ? 'bg-mist-800 text-lime-400 shadow-sm'
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
                        activeTab === prop.id
                            ? 'bg-mist-800 text-lime-400 shadow-sm'
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
            <div class="grid grid-cols-1 lg:grid-cols-5 gap-4">
                <div
                    class="lg:col-span-1 rounded-xl border border-mist-800 bg-mist-900 p-5 shadow-lg space-y-4">
                    <div>
                        <h3 class="text-base font-bold text-mist-100">Performance Summary</h3>
                        <p class="text-xs text-mist-400">Current month occupancy & yield</p>
                    </div>

                    <!-- Metrics Grid -->
                    <div class="rounded-lg bg-mist-800/40 p-3 text-center">
                        <span class="block text-[11px] text-mist-400">Occupancy</span>
                        <span class="text-lg font-extrabold font-mono text-lime-400"> 20 % </span>
                    </div>

                    <div class="rounded-lg bg-mist-800/40 p-3 text-center">
                        <span class="block text-[11px] text-mist-400">Avg Daily Rate</span>
                        <span class="text-sm font-bold font-mono text-mist-100">450000</span>
                    </div>

                    <div class="rounded-lg bg-mist-800/40 p-3 text-center">
                        <span class="block text-[11px] text-mist-400">Avg Stay</span>
                        <span class="text-sm font-bold font-mono text-mist-100"> 2.5 days </span>
                    </div>

                    <div
                        class="flex items-center justify-between border-t border-mist-800/60 pt-3 text-xs">
                        <span class="text-mist-400">Check-ins Today</span>
                        <span class="font-bold text-mist-200">2 Guests</span>
                    </div>
                </div>
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
                <div
                    v-for="metric in propertyMetrics"
                    :key="metric.property.id"
                    class="space-y-4">
                    <!-- Metrics -->
                    <div class="rounded-lg border border-mist-800 bg-mist-900 p-4">
                        <div class="flex justify-around w-full space-x-4">
                            <div class="flex flex-col items-center space-y-2">
                                <span class="text-xs text-mist-400">Occupancy</span>
                                <span class="text-lg font-bold text-lime-400">
                                    {{ metric.occupancyPercentage }} %
                                </span>
                            </div>
                            <div class="flex flex-col items-center space-y-2">
                                <span class="text-xs text-mist-400">Revenue</span>
                                <span class="text-lg font-mono font-bold text-mist-100">
                                    {{ formatIDR(metric.payout) }}
                                </span>
                            </div>
                            <div class="flex flex-col items-center space-y-2">
                                <span class="text-xs text-mist-400">Bookings</span>
                                <span class="text-lg font-bold text-mist-100">
                                    {{ metric.bookings }}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <!-- Properties -->
            <div class="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <RouterLink
                    v-for="property in sortedProperties"
                    :key="property.id"
                    :to="{
                        name: 'property-detail',
                        params: { id: property.id },
                    }"
                    class="rounded-lg border border-mist-800 bg-mist-900 p-4 space-y-4">
                    <img
                        loading="lazy"
                        :src="propertyImage(property.id)"
                        :alt="`Picture of ${property.name}`"
                        class="w-full h-50 object-cover rounded-xl mb-4" />

                    <div class="flex justify-between items-start">
                        <div class="flex flex-col">
                            <div class="flex gap-2">
                                <h2 class="text-lg font-bold capitalize">{{ property.id }}</h2>
                                <button
                                    type="button"
                                    class="cursor-pointer text-mist-400 hover:text-mist-100 text-sm"
                                    @click.prevent="handleEditProperty(property.id)">
                                    <fa-icon icon="pen-to-square" />
                                </button>
                            </div>
                            <p class="mt-1 mr-4 text-xs line-clamp-2 text-mist-500">
                                <fa-icon icon="map-marker-alt" /> {{ property.address }}
                            </p>
                        </div>
                        <div
                            class="rounded px-2 py-0.5 text-xs mt-1"
                            :class="[
                                isPropertyOccupied(property.id)
                                    ? 'bg-amber-500/20 text-amber-400'
                                    : 'bg-lime-500/20 text-lime-400',
                            ]">
                            {{ isPropertyOccupied(property.id) ? 'Occupied ' : 'Available' }}
                        </div>
                    </div>
                    <ul class="flex space-x-4 text-sm text-mist-400">
                        <li class="whitespace-nowrap">
                            <fa-icon icon="bed" /> {{ property.bedrooms }} Bedroom
                        </li>
                        <li class="whitespace-nowrap">
                            <fa-icon icon="shower" /> {{ property.bathrooms }} Bathroom
                        </li>
                        <li class="whitespace-nowrap">
                            <fa-icon icon="ruler-combined" /> {{ property.plotSize }} m&sup3;
                        </li>
                    </ul>
                    <div>
                        <span>{{ formatIDR(property.price) }}</span>
                        <span class="text-xs"> / night</span>
                    </div>
                </RouterLink>
            </div>
        </div>

        <!-- Monthly Summary Cards -->
        <div
            v-else
            class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div class="rounded-lg border border-mist-800 bg-mist-900 p-4">
                <p class="text-xs uppercase font-bold text-mist-400">Monthly Revenue</p>
                <p class="mt-1 font-mono text-lg font-bold text-white">
                    {{ formatIDR(checkoutPayout) }}
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
            <div class="rounded-lg border border-mist-800 bg-mist-900 p-4">
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
            <div class="rounded-lg border border-mist-800 bg-mist-900 p-4">
                <p class="text-xs uppercase font-bold text-mist-400">Total Month Bookings</p>
                <p class="text-lg font-bold text-mist-100 mt-1">
                    {{ totalBookingsCount }}
                </p>
                <p class="text-xs text-mist-500 mt-1">Active bookings</p>
            </div>
        </div>

        <RouterView />

        <PropertyModal
            :is-open="isPropertyModalOpen"
            :property-to-edit="selectedProperty"
            @close="isPropertyModalOpen = false"
            @save="handleSaveProperty" />
    </div>
</template>
