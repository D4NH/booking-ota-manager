<script setup lang="ts">
import { toRef } from 'vue';
import { useMonthlyMetrics } from '@/composables/useMonthlyMetrics';
import type { Booking } from '@/types/booking';
import type { Property } from '@/types/property';
import { formatChartCurrency, formatIDR } from '@/utils/money';

import OccupiedTag from '@/components/OccupiedTag.vue';

const props = defineProps<{
    bookings: Booking[];
    property: Property;
    properties: Property[];
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
</script>

<template>
    <div
        class="group relative flex overflow-hidden rounded-md border border-mist-800 bg-mist-900 transition-all duration-200 hover:border-mist-700 hover:shadow-lg mb-4">
        <div class="flex flex-1 flex-col justify-between p-4 min-w-0">
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
            <div class="rounded-md border-mist-800/80 bg-mist-950/50 p-2">
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

            <div class="pt-3 border-t border-mist-800/60 space-y-2">
                <div class="flex items-center gap-3 text-xs text-mist-400 font-medium">
                    <span class="flex items-center gap-1">
                        <fa-icon
                            icon="bed"
                            class="text-[11px] text-mist-500" />
                        {{ property.bedrooms }} Bed
                    </span>
                    <span class="text-mist-700">&bull;</span>
                    <span class="flex items-center gap-1">
                        <fa-icon
                            icon="shower"
                            class="text-[11px] text-mist-500" />
                        {{ property.bathrooms }} Bath
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
