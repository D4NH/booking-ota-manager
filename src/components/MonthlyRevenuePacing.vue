<script setup lang="ts">
import { computed } from 'vue';
import type { Property } from '@/types/property';
import { formatIDR } from '@/utils/money';
import { getCurrentDate, getDaysInMonth, parseISODate } from '@/utils/date';

import CardTitle from '@/components/CardTitle.vue';

interface Props {
    currentRevenue: number;
    property: Property;
    monthlyTarget?: number;
    today?: string;
}

const {
    currentRevenue,
    property,
    monthlyTarget = 15000000,
    today = getCurrentDate(),
} = defineProps<Props>();

const dateObj = computed(() => parseISODate(today));
const dayNumber = computed(() => dateObj.value.getDate());
const totalDaysInMonth = computed(() => getDaysInMonth(today.slice(0, 7)));
const daysRemaining = computed(() => Math.max(0, totalDaysInMonth.value - dayNumber.value));
// Dynamic Target Resolution (User override -> 70% occupancy target at base rate -> 15M fallback)
const effectiveTarget = computed(() => {
    if (typeof monthlyTarget === 'number' && monthlyTarget > 0) return monthlyTarget;
    if (property?.price) {
        return Math.round(property.price * totalDaysInMonth.value * 0.7);
    }
    return 15_000_000;
});
const targetPercentage = computed(() => {
    if (effectiveTarget.value === 0) return 0;
    return Math.min(100, Math.round((currentRevenue / effectiveTarget.value) * 100));
});
const monthTimeElapsed = computed(() =>
    Math.min(100, Math.round((dayNumber.value / totalDaysInMonth.value) * 100))
);
const isAheadOfPace = computed(() => targetPercentage.value >= monthTimeElapsed.value);
const pacingDiff = computed(() => targetPercentage.value - monthTimeElapsed.value);
// Financial Gap & Run-Rate Projections
const remainingRevenue = computed(() => Math.max(0, effectiveTarget.value - currentRevenue));
const dailyRunRateNeeded = computed(() => {
    if (daysRemaining.value === 0) return remainingRevenue.value;
    return Math.round(remainingRevenue.value / daysRemaining.value);
});
const projectedRevenue = computed(() => {
    if (dayNumber.value === 0) return currentRevenue;
    return Math.round((currentRevenue / dayNumber.value) * totalDaysInMonth.value);
});
</script>

<template>
    <div class="flex flex-col h-full min-h-0">
        <CardTitle>
            <template #title>Monthly Pacing</template>
            <template #subtitle>Target vs. actual trajectory</template>
        </CardTitle>

        <div
            class="flex flex-col flex-1 justify-between rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md space-y-4">
            <!-- Metric Highlight & Pacing Badge -->
            <div class="flex items-baseline justify-between">
                <div>
                    <span class="text-lg font-bold font-mono text-mist-100">
                        {{ formatIDR(currentRevenue) }}
                    </span>
                    <span class="text-xs text-mist-400 ml-1.5">
                        / {{ formatIDR(effectiveTarget) }} goal
                    </span>
                    <div class="mt-1 flex items-center gap-1 text-xs">
                        <span
                            class="font-medium"
                            :class="isAheadOfPace ? 'text-lime-400' : 'text-rose-400'">
                            {{ isAheadOfPace ? '+' : '' }}{{ pacingDiff }}%
                        </span>
                        <span class="text-mist-500">
                            {{ isAheadOfPace ? 'ahead of pace' : 'behind pace' }}
                        </span>
                    </div>
                </div>

                <div class="text-right">
                    <span class="text-lg font-bold font-mono text-lime-400">
                        {{ targetPercentage }}%
                    </span>
                    <span class="block text-xs text-mist-500">
                        Proj: {{ formatIDR(projectedRevenue) }}
                    </span>
                </div>
            </div>

            <!-- Progress Bar with Clamped "Today" Marker -->
            <div class="space-y-1.5 pt-1">
                <div class="relative h-2.5 w-full rounded-full bg-mist-950 overflow-hidden">
                    <!-- Actual Revenue Fill -->
                    <div
                        class="h-full rounded-full bg-lime-500 transition-all duration-500 ease-out"
                        :style="{ width: `${targetPercentage}%` }" />

                    <!-- Current Day Time Marker -->
                    <div
                        class="absolute top-0 bottom-0 w-1 bg-white shadow-sm z-10 -translate-x-1/2"
                        :style="{ left: `${monthTimeElapsed}%` }"
                        :title="`Day ${dayNumber} of ${totalDaysInMonth} (${monthTimeElapsed}% elapsed)`" />
                </div>

                <!-- Scale Labels -->
                <div class="flex justify-between text-xs font-medium text-mist-500">
                    <span>Day 1</span>
                    <span class="text-mist-300">
                        Day {{ dayNumber }} ({{ monthTimeElapsed }}% time elapsed)
                    </span>
                    <span>Day {{ totalDaysInMonth }}</span>
                </div>
            </div>

            <!-- Financial Run-Rate Grid -->
            <div
                class="grid grid-cols-2 gap-2 border-t border-mist-800 pt-3 text-xs divide-x divide-mist-800 text-center">
                <div class="p-2.5 space-y-0.5">
                    <span class="block text-xs font-bold uppercase tracking-wider text-mist-500">
                        Gap to Target
                    </span>
                    <span class="font-mono text-sm font-bold text-mist-200">
                        {{ formatIDR(remainingRevenue) }}
                    </span>
                </div>

                <div class="p-2.5 space-y-0.5">
                    <span class="block text-xs font-bold uppercase tracking-wider text-mist-500">
                        Needed Rate ({{ daysRemaining }}d left)
                    </span>
                    <span class="font-mono text-sm font-bold text-lime-400">
                        {{ formatIDR(dailyRunRateNeeded) }}
                        <span class="text-xs font-normal text-mist-500">/ day</span>
                    </span>
                </div>
            </div>
        </div>
    </div>
</template>
