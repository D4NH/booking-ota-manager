<script setup lang="ts">
import { computed } from 'vue';
import { formatIDR } from '@/utils/money';
import { getBookedPropertiesCount } from '@/composables/useOccupancy';
import type { Booking } from '@/types/booking';
import type { Property } from '@/types/property';

const props = withDefaults(
    defineProps<{
        bookings: Booking[];
        properties: Property[];
        year?: number;
    }>(),
    {
        year: new Date().getFullYear(),
    }
);

const totalRevenue = computed(() =>
    props.bookings
        .filter((b) => b.status !== 'Unavailable' && b.checkIn.startsWith(`${props.year}`))
        .reduce((sum, b) => sum + b.payout, 0)
);
const totalNights = computed(() =>
    props.bookings
        .filter((b) => b.status !== 'Unavailable' && b.checkIn.startsWith(`${props.year}`))
        .reduce((sum, b) => sum + b.nights, 0)
);
const portfolioADR = computed(() => {
    if (totalNights.value === 0) return 0;
    return Math.round(totalRevenue.value / totalNights.value);
});
const propertiesCount = computed(() => props.properties.length);
const activePropertiesCount = computed(() => getBookedPropertiesCount(props.bookings, props.year));
const annualOccupancy = computed(() => {
    const totalCapacity = 365 * (activePropertiesCount.value || 1);
    return Math.round((totalNights.value / totalCapacity) * 100);
});
</script>

<template>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md space-y-1">
            <h3 class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                Portfolio Revenue
            </h3>
            <p class="font-mono text-lg font-bold text-white">
                {{ formatIDR(totalRevenue) }}
            </p>
            <p class="flex items-center gap-1 text-xs text-mist-500">
                Total earnings in {{ year }}
            </p>
        </div>
        <div class="rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md space-y-1">
            <h3 class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                Active Listings
            </h3>
            <p class="font-mono text-lg font-bold text-mist-100">
                <span class="text-lime-400">{{ activePropertiesCount }}</span>
                <span class="text-mist-500 text-lg"> / {{ propertiesCount }} Units</span>
            </p>
            <p class="text-xs text-mist-500">Generating revenue</p>
        </div>
        <div class="rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md space-y-1">
            <h3 class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                Average Daily Rate
            </h3>
            <p class="font-mono text-lg font-bold text-white">
                {{ formatIDR(portfolioADR) }}
            </p>
            <p class="text-xs text-mist-500">Across {{ totalNights }} booked nights</p>
        </div>
        <div class="rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md space-y-1">
            <h3 class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                Annual Occupancy
            </h3>
            <p class="font-mono text-lg font-bold text-lime-400">{{ annualOccupancy }}%</p>
            <p class="text-xs text-mist-500">
                {{ totalNights }} / {{ 365 * activePropertiesCount }} room nights
            </p>
        </div>
    </div>
</template>
