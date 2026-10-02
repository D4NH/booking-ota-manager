<script setup lang="ts">
import { computed } from 'vue';
import { useDailyOperations } from '@/composables/useDailyOperations';
import { useMonthlyMetrics } from '@/composables/useMonthlyMetrics';
import { getStatusStyle } from '@/config/status';
import type { Booking } from '@/types/booking';
import type { Property } from '@/types/property';
import { formatDate, getCurrentDate } from '@/utils/date';
import { formatIDR } from '@/utils/money';

import OccupiedTag from '@/components/OccupiedTag.vue';

const {
    bookings,
    property,
    useDailyOps = false,
} = defineProps<{
    bookings: Booking[];
    property: Property;
    useDailyOps?: boolean;
}>();

const { occupancyPercentage, totalPayout, totalBookingsCount } = useMonthlyMetrics(() => bookings, {
    propertyId: () => property.id,
});
const { staySections, isOccupied } = useDailyOperations(() => bookings, {
    propertyId: () => property.id,
});

const nextUpcoming = computed(
    () =>
        bookings
            .filter((b) => b.checkIn > getCurrentDate() && b.status !== 'Unavailable')
            .sort((a, b) => a.checkIn.localeCompare(b.checkIn))[0]
);

function handleImageError(e: Event): void {
    (e.target as HTMLImageElement).src = '/images/placeholder.jpg';
}
</script>

<template>
    <RouterLink
        :to="{
            name: 'property-detail',
            params: { id: property.id },
        }"
        class="group relative flex cursor-pointer overflow-hidden rounded-md border border-mist-800 bg-mist-900 shadow-md transition-all duration-200 hover:border-lime-700 hover:shadow-xl">
        <div class="flex min-w-0 flex-1 flex-col justify-between space-y-4 p-4">
            <!-- Property Name & Location -->
            <!-- <span
                class="h-2 w-2 rounded-full shrink-0"
                :class="getPropertyStyle(property.id, true)" /> -->
            <div class="space-y-1">
                <h3 class="truncate text-sm font-medium text-mist-100">
                    {{ property.name }}
                </h3>
                <p
                    class="flex items-center gap-1 truncate text-xs leading-relaxed text-mist-500"
                    :title="property.address">
                    <fa-icon
                        icon="location-dot"
                        class="shrink-0 text-[10px] text-mist-500" />
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
                            class="mb-1.5 flex items-center gap-1.5 text-xs font-semibold"
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
                            <div class="flex justify-between space-y-1">
                                <div class="flex flex-col items-start space-y-1">
                                    <span class="truncate text-sm font-semibold text-mist-100">
                                        {{ b.guestName }}
                                    </span>
                                    <span class="text-xs text-mist-400">
                                        {{
                                            formatDate(b.checkIn, {
                                                shortWeekday: true,
                                                shortMonth: true,
                                            })
                                        }}
                                        &rarr;
                                        {{
                                            formatDate(b.checkOut, {
                                                shortWeekday: true,
                                                shortMonth: true,
                                            })
                                        }}
                                        &bull; {{ b.nights }} night(s)
                                    </span>
                                    <span class="text-xs font-medium text-mist-500">
                                        via {{ b.listing }}
                                    </span>
                                </div>
                                <div class="flex flex-col items-end space-y-1">
                                    <span
                                        class="font-mono text-xs font-semibold text-nowrap text-mist-100">
                                        {{ formatIDR(b.payout) }}
                                    </span>
                                    <span
                                        class="mt-0.5 text-xs"
                                        :class="getStatusStyle(b.status)">
                                        {{ b.status }}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div
                    v-else-if="!property.available"
                    class="my-6 text-center text-xs text-mist-500">
                    <fa-icon
                        icon="person-digging"
                        class="text-xl text-mist-700" />
                    <span class="ml-2 font-medium text-mist-400">Under Construction</span>
                </div>
                <div
                    v-else
                    class="my-6 text-center text-xs text-mist-500">
                    <fa-icon
                        icon="house-circle-check"
                        class="text-xl text-mist-700" />
                    <span class="ml-2 font-medium text-mist-400">No active in-house guest</span>
                    <p
                        v-if="nextUpcoming"
                        class="mt-1 text-xs">
                        Next:
                        {{
                            formatDate(nextUpcoming.checkIn, {
                                shortWeekday: true,
                                shortMonth: true,
                            })
                        }}
                        - {{ nextUpcoming.guestName }}
                    </p>
                    <p
                        v-else
                        class="mt-1 text-xs">
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
                        <span class="block text-[10px] font-semibold text-mist-500 uppercase">
                            Occupancy
                        </span>
                        <span class="font-mono text-xs font-semibold text-lime-400">
                            {{ occupancyPercentage }}%
                        </span>
                    </div>
                    <div class="px-1">
                        <span class="block text-[10px] font-semibold text-mist-500 uppercase">
                            Revenue
                        </span>
                        <span class="font-mono text-xs font-semibold text-mist-100">
                            {{ formatIDR(totalPayout) }}
                        </span>
                    </div>
                    <div class="px-1">
                        <span class="block text-[10px] font-semibold text-mist-500 uppercase">
                            Bookings
                        </span>
                        <span class="font-mono text-xs font-semibold text-mist-200">
                            {{ totalBookingsCount }}
                        </span>
                    </div>
                </div>
                <div
                    v-else
                    class="my-6 text-center text-xs text-mist-500">
                    <fa-icon
                        icon="person-digging"
                        class="text-xl text-mist-700" />
                    <span class="ml-2 font-medium text-mist-400">Under Construction</span>
                </div>
            </div>

            <!-- House Specs & Price Footer -->
            <div class="mt-2 border-t border-mist-800 pt-2">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3 text-xs font-medium text-mist-400">
                        <span class="flex items-center gap-1.5">
                            <fa-icon
                                icon="bed"
                                class="text-xs text-mist-500" />
                            {{ property.bedrooms }} Beds
                        </span>
                        <span class="text-mist-700">&bull;</span>
                        <span class="flex items-center gap-1.5">
                            <fa-icon
                                icon="shower"
                                class="text-xs text-mist-500" />
                            {{ property.bathrooms }} Baths
                        </span>
                        <span class="text-mist-700">&bull;</span>
                        <span class="flex items-center gap-1.5">
                            <fa-icon
                                icon="ruler-combined"
                                class="text-xs text-mist-500" />
                            {{ property.plotSize }} m²
                        </span>
                    </div>
                    <div>
                        <span class="font-mono text-sm font-semibold text-mist-300">
                            {{ formatIDR(property.price) }}
                        </span>
                        <span class="text-xs text-mist-500"> / night</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Photo -->
        <div class="relative w-50 shrink-0 self-stretch overflow-hidden bg-mist-950">
            <img
                :src="`/images/${property.id}.jpg`"
                :alt="property.name"
                class="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
                @error="handleImageError" />
        </div>

        <OccupiedTag
            v-if="property.available"
            class="pointer-events-none absolute top-4 right-4"
            :is-occupied="isOccupied" />
    </RouterLink>
</template>
