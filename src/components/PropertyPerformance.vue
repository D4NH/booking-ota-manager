<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { getPropertyStyle } from '@/config/properties';
import { formatIDR } from '@/utils/money';
import type { Booking } from '@/types/booking';
import type { Property, PropertyId } from '@/types/property';

import CardTitle from '@/components/CardTitle.vue';

interface Props {
    bookings: Booking[];
    properties: Property[];
}

const { bookings, properties } = defineProps<Props>();

const yearOptions = computed<number[]>(() => {
    const years = new Set<number>();

    for (const b of bookings) {
        if (b.checkIn && b.checkIn.length >= 4) {
            const year = Number(b.checkIn.slice(0, 4));
            if (!Number.isNaN(year)) years.add(year);
        }
    }

    if (years.size === 0) {
        years.add(new Date().getFullYear());
    }

    return Array.from(years).sort((a, b) => b - a);
});

const selectedYear = ref<number>(yearOptions.value[0] ?? new Date().getFullYear());

const propertyStats = computed(() => {
    const targetYearStr = String(selectedYear.value);
    const isLeapYear =
        (selectedYear.value % 4 === 0 && selectedYear.value % 100 !== 0) ||
        selectedYear.value % 400 === 0;
    const daysInYear = isLeapYear ? 366 : 365;

    let totalPortfolioRevenue = 0;
    const propAggregates = new Map<
        PropertyId,
        { revenue: number; nights: number; count: number }
    >();

    for (const p of properties) {
        propAggregates.set(p.id, { revenue: 0, nights: 0, count: 0 });
    }

    for (const b of bookings) {
        if (b.status === 'Unavailable' || b.status === 'No show') continue;
        if (!b.checkIn || b.checkIn.slice(0, 4) !== targetYearStr) continue;

        totalPortfolioRevenue += b.payout || 0;

        const current = propAggregates.get(b.propertyId);
        if (current) {
            current.revenue += b.payout || 0;
            current.nights += b.nights || 0;
            current.count += 1;
        }
    }

    return properties.map((property) => {
        const stat = propAggregates.get(property.id) ?? { revenue: 0, nights: 0, count: 0 };
        const occupancy = Math.min(100, Math.round((stat.nights / daysInYear) * 100));
        const revenueShare =
            totalPortfolioRevenue > 0
                ? Number(((stat.revenue / totalPortfolioRevenue) * 100).toFixed(1))
                : 0;

        return {
            property,
            revenue: stat.revenue,
            nights: stat.nights,
            propertyStats: {
                occupancy,
                revenueShare,
                bookingsCount: stat.count,
            },
        };
    });
});

watch(yearOptions, (available) => {
    if (!available.includes(selectedYear.value) && available.length > 0) {
        selectedYear.value = available[0]!;
    }
});
</script>

<template>
    <div class="flex flex-col">
        <div class="flex justify-between items-center">
            <CardTitle>
                <template #title>Property Performance</template>
                <template #subtitle>Revenue contribution & occupancy rate per unit</template>
            </CardTitle>
            <div class="relative w-18">
                <select
                    v-model.number="selectedYear"
                    class="w-full appearance-none rounded-md border border-mist-800 bg-mist-950/50 px-3 py-2 text-xs text-mist-400 focus:border-lime-500 focus:outline-none transition-colors cursor-pointer">
                    <option
                        v-for="year in yearOptions"
                        :key="year"
                        :value="year"
                        class="bg-mist-900">
                        {{ year }}
                    </option>
                </select>
                <div
                    class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-mist-400">
                    <fa-icon
                        class="text-xs"
                        icon="angle-down" />
                </div>
            </div>
        </div>

        <div
            class="divide-y divide-mist-800 h-full flex flex-col items-stretch rounded-md border border-mist-800 bg-mist-900 shadow-md">
            <div
                v-if="propertyStats.length === 0"
                class="flex flex-1 flex-col items-center justify-center text-xs text-mist-400 p-4">
                <fa-icon
                    icon="house"
                    class="text-xl" />
                <p class="mt-2">No properties found</p>
            </div>
            <div
                v-for="stat in propertyStats"
                :key="stat.property.id"
                class="flex grow flex-col justify-center p-4 hover:bg-mist-800/40">
                <!-- Unit Name & Total Revenue -->
                <div class="flex items-center justify-between">
                    <div class="flex items-center justify-between gap-2">
                        <span
                            class="capitalize rounded px-2 py-0.5 text-xs font-medium"
                            :class="getPropertyStyle(stat.property.id)">
                            {{ stat.property.id }}
                        </span>
                        <span class="text-xs text-mist-400">
                            {{ formatIDR(stat.property.price) }} / night
                        </span>
                    </div>
                    <span class="font-mono text-sm font-semibold text-mist-300 block">
                        {{ formatIDR(stat.revenue) }}
                    </span>
                </div>
                <!-- Progress Bar -->
                <div class="mt-2.5 space-y-2">
                    <div class="h-1.5 w-full rounded-full bg-mist-950/50 overflow-hidden">
                        <div
                            class="h-full rounded-full transition-all duration-500"
                            :class="stat.revenue > 0 ? 'bg-lime-400' : 'bg-mist-700'"
                            :style="{
                                width: `${Math.max(2, stat.propertyStats.revenueShare)}%`,
                            }" />
                    </div>
                    <div class="flex justify-between text-[11px] text-mist-500 pt-0.5">
                        <div class="flex gap-2">
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
                            <span class="text-xs text-mist-400">&bull;</span>
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
