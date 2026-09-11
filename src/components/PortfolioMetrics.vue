<script setup lang="ts">
import { computed } from 'vue';
import { formatIDR } from '@/utils/money';
import { getBookedPropertiesCount } from '@/composables/useOccupancy';
import type { Booking } from '@/types/booking';

const props = withDefaults(
    defineProps<{
        bookings: Booking[];
        totalProperties?: number;
        year?: number;
    }>(),
    {
        totalProperties: 3,
        year: 2026,
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
const activePropertiesCount = computed(() => getBookedPropertiesCount(props.bookings, props.year));
const annualOccupancy = computed(() => {
    const totalCapacity = 365 * (activePropertiesCount.value || 1);
    return Math.round((totalNights.value / totalCapacity) * 100);
});
</script>

<template>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- 1. Portfolio Revenue -->
        <div class="rounded-xl border border-mist-800 bg-mist-900 p-4 shadow-md">
            <span class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                Portfolio Revenue
            </span>
            <div class="mt-1 font-mono text-lg font-bold text-mist-100">
                {{ formatIDR(totalRevenue) }}
            </div>
            <span class="text-xs text-mist-500 mt-0.5 block">Full Year {{ year }}</span>
        </div>

        <!-- 2. Operational Capacity -->
        <div class="rounded-xl border border-mist-800 bg-mist-900 p-4 shadow-md">
            <span class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                Active Listings
            </span>
            <div class="mt-1 font-mono text-lg font-bold text-mist-100">
                <span class="text-lime-400">{{ activePropertiesCount }}</span>
                <span class="text-mist-500 text-lg"> / {{ totalProperties }} Units</span>
            </div>
            <span class="text-xs text-mist-500 mt-0.5 block">Generating revenue</span>
        </div>

        <!-- 3. Portfolio ADR -->
        <div class="rounded-xl border border-mist-800 bg-mist-900 p-4 shadow-md">
            <span class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                Average Daily Rate
            </span>
            <div class="mt-1 font-mono text-lg font-bold text-mist-100">
                {{ formatIDR(portfolioADR) }}
            </div>
            <span class="text-xs text-mist-500 mt-0.5 block">
                Across {{ totalNights }} booked nights
            </span>
        </div>

        <!-- 4. Annual Occupancy -->
        <div class="rounded-xl border border-mist-800 bg-mist-900 p-4 shadow-md">
            <span class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                Annual Occupancy
            </span>
            <div class="mt-1 font-mono text-lg font-bold text-lime-400">{{ annualOccupancy }}%</div>
            <span class="text-xs text-mist-500 mt-0.5 block">
                {{ totalNights }} / {{ 365 * activePropertiesCount }} room nights
            </span>
        </div>
    </div>
</template>
