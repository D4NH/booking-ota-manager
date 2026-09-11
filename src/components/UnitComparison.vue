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
    <div class="flex flex-col justify-between rounded-md">
        <!-- Header -->
        <div class="mt-8 mb-4">
            <h2 class="text-sm font-bold uppercase tracking-wider text-mist-100">
                Unit Performance Comparison
            </h2>
            <p class="mt-0.5 text-xs text-mist-400">Revenue contribution & occupancy by villa</p>
        </div>

        <!-- Leaderboard Rows -->
        <div class="border rounded-md border-mist-800">
            <div class="divide-y divide-mist-800">
                <div
                    v-for="stat in propertyStats"
                    :key="stat.property.id"
                    class="hover:bg-mist-800/40 transition p-4">
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
                            <span class="text-xs text-mist-400">
                                {{ stat.propertyStats.bookingsCount }} stays &bull;
                                {{ stat.nights }} nights
                            </span>
                        </div>
                        <div class="text-right">
                            <span class="font-mono text-sm font-bold text-mist-100">
                                {{ formatIDR(stat.revenue) }}
                            </span>
                            <span class="text-xs text-mist-500 block">
                                {{ stat.propertyStats.revenueShare }}% of portfolio
                            </span>
                        </div>
                    </div>
                    <!-- Progress Bar -->
                    <div class="mt-2.5 space-y-1">
                        <div class="h-2 w-full rounded-full bg-mist-950 overflow-hidden">
                            <div
                                class="h-full rounded-full transition-all duration-500"
                                :class="stat.revenue > 0 ? 'bg-lime-400' : 'bg-mist-700'"
                                :style="{
                                    width: `${Math.max(2, stat.propertyStats.revenueShare)}%`,
                                }" />
                        </div>
                        <div class="flex justify-between text-[11px] text-mist-500 pt-0.5">
                            <span>
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
                            <span>Base rate: {{ formatIDR(stat.property.price) }}/night</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
