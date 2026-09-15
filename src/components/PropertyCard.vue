<script setup lang="ts">
import { computed } from 'vue';
import { useDailyOperations } from '@/composables/useDailyOperations';
import { useMonthlyMetrics } from '@/composables/useMonthlyMetrics';
import type { Booking } from '@/types/booking';
import type { Property } from '@/types/property';
import { formatDate, getCurrentDate } from '@/utils/date';
import { formatIDR } from '@/utils/money';

import OccupiedTag from '@/components/OccupiedTag.vue';

const props = defineProps<{
    bookings: Booking[];
    property: Property;
    useDailyOps?: boolean;
}>();

const { occupancyPercentage, totalPayout, totalBookingsCount } = useMonthlyMetrics(
    () => props.bookings,
    {
        propertyId: () => props.property.id,
    }
);
const { staySections, isOccupied } = useDailyOperations(() => props.bookings, {
    propertyId: () => props.property.id,
});

const nextUpcoming = computed(
    () =>
        props.bookings
            .filter((b) => b.checkIn > getCurrentDate())
            .sort((a, b) => a.checkIn.localeCompare(b.checkIn))[0]
);

const handleImageError = (e: Event) => {
    (e.target as HTMLImageElement).src = '/images/placeholder.jpg';
};
</script>

<template>
    <RouterLink
        :to="{
            name: 'property-detail',
            params: { id: property.id },
        }"
        class="group relative flex overflow-hidden rounded-md border border-mist-800 bg-mist-900 transition-all duration-200 hover:border-lime-700 hover:shadow-xl shadow-md cursor-pointer">
        <div class="flex flex-1 flex-col justify-between p-4 min-w-0 space-y-4">
            <!-- Property Name & Location -->
            <div>
                <h3 class="text-base font-bold text-mist-100 truncate">
                    {{ property.name }}
                </h3>
                <p
                    class="text-xs text-mist-400 mt-1 truncate flex items-center gap-1"
                    :title="property.address">
                    <fa-icon
                        icon="location-dot"
                        class="text-[10px] text-mist-500 shrink-0" />
                    <span class="truncate">{{ property.address }}</span>
                </p>
            </div>

            <!-- Daily Operations -->
            <div
                v-if="useDailyOps"
                class="mt-2">
                <div
                    v-if="staySections.length"
                    class="space-y-4">
                    <div
                        v-for="section in staySections"
                        :key="section.label">
                        <span
                            class="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold"
                            :class="[
                                section.label === 'Arriving Today'
                                    ? 'text-lime-400'
                                    : 'text-amber-400',
                            ]">
                            {{ section.label }}
                        </span>
                        <div
                            v-for="b in section.items"
                            :key="b.id || b.bookingId">
                            <div class="flex flex-col space-y-1">
                                <div class="flex items-center justify-between">
                                    <span class="text-sm font-bold text-mist-100 truncate">
                                        {{ b.guestName }}
                                    </span>
                                    <span
                                        class="text-xs font-bold font-mono text-mist-100 whitespace-nowrap">
                                        {{ formatIDR(b.payout) }}
                                    </span>
                                </div>
                                <span class="text-[11px] text-mist-400">
                                    {{ formatDate(b.checkIn, { shortMonth: true }) }}
                                    &rarr;
                                    {{ formatDate(b.checkOut, { shortMonth: true }) }} &bull;
                                    {{ b.nights }} night(s)
                                </span>
                                <span class="text-[11px] text-mist-500 font-medium">
                                    via {{ b.listing }}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                <div
                    v-else-if="!property.available"
                    class="text-center text-xs text-mist-500 my-6">
                    <fa-icon
                        icon="person-digging"
                        class="text-xl text-mist-700" />
                    <span class="ml-2 font-medium text-mist-400">Under Construction</span>
                </div>
                <div
                    v-else
                    class="text-center text-xs text-mist-500 my-6">
                    <fa-icon
                        icon="house-circle-check"
                        class="text-xl text-mist-700" />
                    <span class="ml-2 font-medium text-mist-400">No active in-house guest</span>
                    <p
                        v-if="nextUpcoming"
                        class="text-[11px] mt-1">
                        Next: {{ formatDate(nextUpcoming.checkIn) }} - {{ nextUpcoming.guestName }}
                    </p>
                    <p
                        v-else
                        class="text-[11px] mt-1">
                        Unit is vacant and ready for check-in
                    </p>
                </div>
            </div>
            <div
                v-else
                class="mt-2 mb-4">
                <div
                    v-if="property.available"
                    class="grid grid-cols-3 divide-x divide-mist-800/80 text-center">
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
                            {{ formatIDR(totalPayout) }}
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
                <div
                    v-else
                    class="text-center text-xs text-mist-500 my-6">
                    <fa-icon
                        icon="person-digging"
                        class="text-xl text-mist-700" />
                    <span class="ml-2 font-medium text-mist-400">Under Construction</span>
                </div>
            </div>

            <!-- House Specs & Price Footer -->
            <div class="pt-2 mt-2 border-t border-mist-800/60">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3 text-xs text-mist-400 font-medium">
                        <span class="flex items-center gap-1.5">
                            <fa-icon
                                icon="bed"
                                class="text-[11px] text-mist-500" />
                            {{ property.bedrooms }} Beds
                        </span>
                        <span class="text-mist-700">&bull;</span>
                        <span class="flex items-center gap-1.5">
                            <fa-icon
                                icon="shower"
                                class="text-[11px] text-mist-500" />
                            {{ property.bathrooms }} Baths
                        </span>
                        <span class="text-mist-700">&bull;</span>
                        <span class="flex items-center gap-1.5">
                            <fa-icon
                                icon="ruler-combined"
                                class="text-[11px] text-mist-500" />
                            {{ property.plotSize }} m²
                        </span>
                    </div>
                    <div>
                        <span class="text-sm font-bold font-mono text-mist-100">
                            {{ formatIDR(property.price) }}
                        </span>
                        <span class="text-[11px] text-mist-500"> / night</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Photo -->
        <div class="relative shrink-0 self-stretch w-50 overflow-hidden bg-mist-950">
            <img
                :src="`/images/${property.id}.jpg`"
                :alt="property.name"
                class="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
                @error="handleImageError" />
        </div>

        <OccupiedTag
            v-if="property.available"
            class="absolute top-4 right-4 pointer-events-none"
            :is-occupied="isOccupied" />
    </RouterLink>
</template>
