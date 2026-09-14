<!-- src/components/properties/UnitComparisonLeaderboard.vue -->
<script setup lang="ts">
import { computed } from 'vue';
import { getPropertyTheme } from '@/config/properties';
import { formatIDR } from '@/utils/money';
import type { Booking } from '@/types/booking';
import type { Property } from '@/types/property';

const props = defineProps<{
    bookings: Booking[];
    properties: Property[];
    year?: number;
}>();

const propertyStats = computed(() => {
    const totalPortfolioRevenue = props.bookings
        .filter((b) => b.status !== 'Unavailable')
        .reduce((sum, b) => sum + b.payout, 0);

    return props.properties.map((property) => {
        const propBookings = props.bookings.filter(
            (b) => b.propertyId === property.id && b.status !== 'Unavailable'
        );

        const revenue = propBookings.reduce((sum, b) => sum + b.payout, 0);
        const nights = propBookings
            .filter((b) => b.status !== 'Unavailable')
            .reduce((sum, b) => sum + b.nights, 0);

        const occupancy = Math.round((nights / 365) * 100);
        const revenueShare =
            totalPortfolioRevenue > 0
                ? Number(((revenue / totalPortfolioRevenue) * 100).toFixed(1))
                : 0;

        return {
            property,
            revenue,
            nights,
            propertyStats: {
                occupancy,
                revenueShare,
                bookingsCount: propBookings.length,
            },
        };
    });
});
</script>

<template>
    <div class="flex flex-col">
        <!-- Header -->
        <div class="mt-4 mb-4">
            <h2 class="text-sm font-bold uppercase tracking-wider text-mist-100">
                Unit Performance
            </h2>
            <p class="mt-1 text-xs text-mist-400">Revenue contribution & occupancy by villa</p>
        </div>

        <!-- Leaderboard Rows -->
        <div
            class="divide-y divide-mist-800 h-full flex flex-col items-stretch rounded-md border border-mist-800 bg-mist-900 shadow-md">
            <div
                v-for="stat in propertyStats"
                :key="stat.property.id"
                class="flex grow flex-col justify-center p-4 hover:bg-mist-800/40">
                <!-- Unit Name & Total Revenue -->
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <span
                            class="capitalize rounded px-2 py-0.5 text-xs font-bold"
                            :class="[
                                getPropertyTheme(stat.property.id).bg,
                                getPropertyTheme(stat.property.id).text,
                            ]">
                            {{ stat.property.id }}
                        </span>
                        &bull;
                        <span class="text-xs text-mist-400">
                            Base rate: {{ formatIDR(stat.property.price) }} / night
                        </span>
                    </div>
                    <div class="text-right">
                        <span class="font-mono text-sm font-bold text-mist-100">
                            {{ formatIDR(stat.revenue) }}
                        </span>
                    </div>
                </div>
                <!-- Progress Bar -->
                <div class="mt-2.5 space-y-2">
                    <div class="h-2 w-full rounded-full bg-mist-950 overflow-hidden">
                        <div
                            class="h-full rounded-full transition-all duration-500"
                            :class="stat.revenue > 0 ? 'bg-lime-400' : 'bg-mist-700'"
                            :style="{
                                width: `${Math.max(2, stat.propertyStats.revenueShare)}%`,
                            }" />
                    </div>
                    <div class="flex justify-between text-[11px] text-mist-500 pt-0.5">
                        <div>
                            <span class="text-xs text-mist-400">
                                Occupancy:
                                <strong
                                    :class="
                                        stat.propertyStats.occupancy > 0
                                            ? 'text-lime-400'
                                            : 'text-mist-400'
                                    ">
                                    {{ stat.propertyStats.occupancy }}%
                                </strong>
                            </span>
                            &bull;
                            <span class="text-xs text-mist-400">
                                {{ stat.propertyStats.bookingsCount }} stays /
                                {{ stat.nights }} nights
                            </span>
                        </div>
                        <span class="text-xs text-mist-500 block">
                            {{ stat.propertyStats.revenueShare }}% of portfolio
                        </span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
