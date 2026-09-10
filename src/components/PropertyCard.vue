<script setup lang="ts">
import { toRef } from 'vue';
import { useDailyOperations } from '@/composables/useDailyOperations';
import { useMonthlyMetrics } from '@/composables/useMonthlyMetrics';
import type { Booking } from '@/types/booking';
import type { Property } from '@/types/property';
import { formatDate } from '@/utils/date';
import { formatChartCurrency, formatIDR } from '@/utils/money';

import OccupiedTag from '@/components/OccupiedTag.vue';

const props = defineProps<{
    bookings: Booking[];
    property: Property;
    properties: Property[];
    useDailyOps?: boolean;
}>();

const emit = defineEmits<{
    (e: 'edit', property: Property): void;
}>();

const bookingsRef = toRef(props, 'bookings');
const propertiesRef = toRef(props, 'properties');

const { occupancyPercentage, totalPayout, totalBookingsCount } = useMonthlyMetrics(
    bookingsRef,
    propertiesRef,
    {
        propertyId: props.property.id,
    }
);
const { todaysArrivals, currentStays } = useDailyOperations(bookingsRef, {
    propertyId: props.property.id,
});
</script>

<template>
    <div
        class="group relative flex overflow-hidden rounded-md border border-mist-800 bg-mist-900 transition-all duration-200 hover:border-mist-700 hover:shadow-lg mb-4">
        <div class="flex flex-1 flex-col justify-between p-4 min-w-0 space-y-4">
            <div>
                <div class="flex items-center justify-between gap-2">
                    <h3
                        class="text-base font-bold text-mist-100 truncate group-hover:text-lime-400 transition">
                        {{ property.name }}
                    </h3>
                    <OccupiedTag
                        :bookings="bookings"
                        :property="property" />
                </div>
                <p
                    class="text-xs text-mist-400 mt-0.5 truncate"
                    :title="property.address">
                    <fa-icon
                        icon="location-dot"
                        class="text-[10px] text-mist-500 mr-1" />
                    {{ property.address }}
                </p>
            </div>

            <div v-if="useDailyOps">
                <div v-if="todaysArrivals.length || currentStays.length">
                    <span
                        class="flex items-center gap-1.5 text-[11px] font-bold text-lime-400 mb-1.5">
                        Currently Staying
                    </span>
                    <div
                        v-for="b in todaysArrivals"
                        :key="'payout-' + (b.id || b.bookingId)">
                        <div class="flex flex-col justify-between space-y-0.5">
                            <span class="text-sm font-bold text-mist-100">
                                {{ b.guestName }}
                            </span>
                            <span class="text-xs text-mist-400">
                                {{ formatDate(b.checkIn, { shortMonth: true }) }}
                                &rarr;
                                {{ formatDate(b.checkOut, { shortMonth: true }) }} &bull;
                                {{ b.nights }} night(s)
                            </span>
                            <span class="text-xs text-mist-400">
                                {{ b.listing }}
                            </span>
                        </div>
                    </div>
                    <div
                        v-for="b in currentStays"
                        :key="'payout-' + (b.id || b.bookingId)">
                        <div class="flex flex-col justify-between space-y-0.5">
                            <span class="text-sm font-bold text-mist-100">
                                {{ b.guestName }}
                            </span>
                            <span class="text-xs text-mist-400">
                                {{ formatDate(b.checkIn, { shortMonth: true }) }}
                                &rarr;
                                {{ formatDate(b.checkOut, { shortMonth: true }) }} &bull;
                                {{ b.nights }} night(s)
                            </span>
                            <span class="text-xs text-mist-400">
                                {{ b.listing }}
                            </span>
                        </div>
                    </div>
                </div>
                <div v-else>
                    <span class="flex items-center gap-1.5 text-[11px] mb-1.5">
                        No active or upcoming bookings
                    </span>
                </div>
            </div>
            <!-- Metrics -->
            <div
                v-else
                class="rounded-md border-mist-800/80 bg-mist-950/50 p-2">
                <div class="grid grid-cols-3 divide-x divide-mist-800/80 text-center">
                    <div class="px-1">
                        <span class="block text-[10px] uppercase font-semibold text-mist-500">
                            Occupancy
                        </span>
                        <span class="font-mono text-xs font-bold text-lime-400">
                            {{ occupancyPercentage }}%
                        </span>
                    </div>
                    <div class="px-1">
                        <span class="block text-[10px] uppercase font-semibold text-mist-500">
                            Revenue
                        </span>
                        <span class="font-mono text-xs font-bold text-mist-100">
                            {{ formatChartCurrency(totalPayout) }}
                        </span>
                    </div>
                    <div class="px-1">
                        <span class="block text-[10px] uppercase font-semibold text-mist-500">
                            Bookings
                        </span>
                        <span class="font-mono text-xs font-bold text-mist-200">
                            {{ totalBookingsCount }}
                        </span>
                    </div>
                </div>
            </div>
            <!-- House Info -->
            <div class="pt-3 border-t border-mist-800/60 space-y-2">
                <div class="flex items-center gap-3 text-xs text-mist-400 font-medium">
                    <span class="flex items-center gap-1">
                        <fa-icon
                            icon="bed"
                            class="text-[11px] text-mist-500" />
                        {{ property.bedrooms }} Beds
                    </span>
                    <span class="text-mist-700">&bull;</span>
                    <span class="flex items-center gap-1">
                        <fa-icon
                            icon="shower"
                            class="text-[11px] text-mist-500" />
                        {{ property.bathrooms }} Baths
                    </span>
                    <span class="text-mist-700">&bull;</span>
                    <span class="flex items-center gap-1">
                        <fa-icon
                            icon="ruler-combined"
                            class="text-[11px] text-mist-500" />
                        {{ property.plotSize }} m²
                    </span>
                </div>
                <div class="flex items-center justify-between">
                    <div>
                        <span class="text-sm font-bold font-mono text-mist-100">
                            {{ formatIDR(property.price) }}
                        </span>
                        <span class="text-[11px] text-mist-500"> / night</span>
                    </div>
                    <button
                        v-if="!useDailyOps"
                        type="button"
                        class="cursor-pointer text-xs text-mist-400 hover:text-mist-100"
                        @click.prevent="emit('edit', property)">
                        <fa-icon icon="pen-to-square" />
                    </button>
                </div>
            </div>
        </div>
        <RouterLink
            :to="{
                name: 'property-detail',
                params: { id: property.id },
            }"
            class="relative w-44 shrink-0 overflow-hidden bg-mist-950">
            <img
                :src="`/images/${property.id}.jpg`"
                :alt="property.name"
                class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy" />
        </RouterLink>
    </div>
</template>
