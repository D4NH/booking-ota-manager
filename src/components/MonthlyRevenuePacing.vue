<script setup lang="ts">
import { computed } from 'vue';
import { formatIDR } from '@/utils/money';
import { getCurrentDate } from '@/utils/date';

const {
    currentRevenue,
    monthlyTarget = 15000000,
    today = getCurrentDate(),
} = defineProps<{
    currentRevenue: number; // e.g. 9031506
    monthlyTarget?: number; // e.g. 15000000 (Target for September)
    today?: string; // e.g. '2026-09-10'
}>();

// Date & Days calculations
const dateObj = computed(() => new Date(today));
const dayNumber = computed(() => dateObj.value.getDate()); // e.g. 10
const totalDaysInMonth = computed(() => {
    const y = dateObj.value.getFullYear();
    const m = dateObj.value.getMonth() + 1;
    return new Date(y, m, 0).getDate(); // e.g. 30 for Sept
});
const daysRemaining = computed(() => Math.max(0, totalDaysInMonth.value - dayNumber.value));
// Percentages
const targetPercentage = computed(() => {
    if (monthlyTarget === 0) return 0;
    return Math.min(100, Math.round((currentRevenue / monthlyTarget) * 100));
});
// % of month that has passed (e.g. Day 10 of 30 = 33.3%)
const monthTimeElapsed = computed(() =>
    Math.round((dayNumber.value / totalDaysInMonth.value) * 100)
);
// Pacing Health: Are we ahead or behind the time curve?
const isAheadOfPace = computed(() => targetPercentage.value >= monthTimeElapsed.value);
const pacingDiff = computed(() => targetPercentage.value - monthTimeElapsed.value);
// Financial Gaps
const remainingRevenue = computed(() => Math.max(0, monthlyTarget - currentRevenue));
const dailyRunRateNeeded = computed(() => {
    if (daysRemaining.value === 0) return remainingRevenue.value;
    return Math.round(remainingRevenue.value / daysRemaining.value);
});
</script>

<template>
    <div
        class="flex flex-col justify-between rounded-md border border-mist-800 bg-mist-900 p-5 shadow-md">
        <div class="flex items-start justify-between">
            <div>
                <h3 class="text-base font-bold text-mist-100">Monthly Revenue Pacing</h3>
                <p class="text-xs text-mist-400">Target vs. Actual Progress</p>
            </div>

            <!-- Health Badge -->
            <span
                :class="[
                    'rounded-full px-2.5 py-0.5 text-[11px] font-bold border',
                    isAheadOfPace
                        ? 'border-lime-500/30 bg-lime-500/10 text-lime-400'
                        : 'border-amber-500/30 bg-amber-500/10 text-amber-300',
                ]">
                {{
                    isAheadOfPace
                        ? `Ahead of Pace (+${pacingDiff}%)`
                        : `Behind Pace (${pacingDiff}%)`
                }}
            </span>
        </div>

        <!-- Metric Highlight -->
        <div class="my-3 flex items-baseline justify-between">
            <div>
                <span class="text-xl font-black font-mono text-mist-100">
                    {{ formatIDR(currentRevenue) }}
                </span>
                <span class="text-xs text-mist-400 ml-1.5">
                    / {{ formatIDR(monthlyTarget) }} goal
                </span>
            </div>
            <span class="text-lg font-bold font-mono text-lime-400"> {{ targetPercentage }}% </span>
        </div>

        <!-- Progress Bar with "Today" Time Marker -->
        <div class="space-y-1.5">
            <div class="relative h-3 w-full rounded-full bg-mist-950 overflow-hidden">
                <!-- Actual Revenue Fill -->
                <div
                    class="h-full rounded-full bg-lime-500 transition-all duration-500 ease-out"
                    :style="{ width: `${targetPercentage}%` }" />

                <!-- Month Time Elapsed Marker (Puck) -->
                <div
                    class="absolute top-0 bottom-0 w-1 bg-white/70 shadow-sm z-10"
                    :style="{ left: `${monthTimeElapsed}%` }"
                    :title="`Day ${dayNumber} of ${totalDaysInMonth} (${monthTimeElapsed}% of month passed)`" />
            </div>

            <!-- Labels under bar -->
            <div class="flex justify-between text-[10px] font-medium text-mist-500">
                <span>0</span>
                <span
                    :style="{ marginLeft: `${monthTimeElapsed - 15}%` }"
                    class="text-mist-300">
                    Day {{ dayNumber }} (Time: {{ monthTimeElapsed }}%)
                </span>
                <span>Target: {{ formatIDR(monthlyTarget) }}</span>
            </div>
        </div>

        <!-- Operational Breakdown Row -->
        <div class="mt-4 grid grid-cols-2 gap-2 border-t border-mist-800/70 pt-3 text-xs">
            <div class="rounded-md bg-mist-950/60 p-2.5">
                <span class="block text-[10px] uppercase font-semibold text-mist-500">
                    Gap to Target
                </span>
                <span class="font-mono text-sm font-bold text-mist-200">
                    {{ formatIDR(remainingRevenue) }}
                </span>
            </div>

            <div class="rounded-md bg-mist-950/60 p-2.5">
                <span class="block text-[10px] uppercase font-semibold text-mist-500">
                    Req. Rate ({{ daysRemaining }}d left)
                </span>
                <span class="font-mono text-sm font-bold text-lime-400">
                    {{ formatIDR(dailyRunRateNeeded) }}
                    <span class="text-[10px] font-normal text-mist-400">/ day</span>
                </span>
            </div>
        </div>
    </div>
</template>
