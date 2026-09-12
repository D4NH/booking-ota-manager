<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { MonthlyStats, YearlyStats } from '@/composables/useOccupancy';
import { getCurrentYear, getCurrentMonth, formatDate } from '@/utils/date';

const props = defineProps<{
    stats: {
        monthlyStats: MonthlyStats;
        yearlyStats: YearlyStats;
    };
}>();

const monthlyProgress = ref(0);
const yearlyProgress = ref(0);

const monthlyStats = computed(() => props.stats.monthlyStats);
const yearlyStats = computed(() => props.stats.yearlyStats);

onMounted(() => {
    setTimeout(() => {
        monthlyProgress.value = Math.min(100, monthlyStats.value.percentage);
        yearlyProgress.value = Math.min(100, yearlyStats.value.percentage);
    }, 50);
});
</script>

<template>
    <div
        class="flex flex-col justify-between rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md space-y-4">
        <div>
            <h3 class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                Occupancy Rate
            </h3>
            <p class="mt-1 text-xs text-mist-500">Full Year Trajectory</p>
        </div>

        <!-- Month -->
        <div>
            <div class="flex items-baseline justify-between space-y-2">
                <div class="flex flex-col gap-1">
                    <span class="text-xl font-black font-mono text-mist-100 tracking-tight">
                        {{ monthlyStats.percentage }}%
                    </span>
                    <span class="font-mono text-xs text-mist-400">
                        <strong class="text-mist-300">{{ monthlyStats.bookedNights }}</strong> /
                        {{ monthlyStats.totalAvailableNights }} nights
                    </span>
                </div>
                <div class="flex flex-col items-end gap-0.5">
                    <span class="text-xs font-medium text-mist-300">This month</span>
                    <span class="text-[11px] text-mist-500 whitespace-nowrap">
                        {{ formatDate(getCurrentMonth(), { monthOnly: true }) }}
                    </span>
                </div>
            </div>
            <!-- Progress Bar -->
            <div class="space-y-2">
                <div class="relative h-2.5 w-full rounded-md bg-mist-950/80 overflow-hidden">
                    <div
                        class="h-full rounded-md bg-lime-500 transition-[width] duration-500 ease-out"
                        :style="{ width: `${monthlyProgress}%` }" />
                </div>
                <div class="flex justify-between text-[10px] text-mist-500">
                    <span>0%</span>
                    <span>100%</span>
                </div>
            </div>
        </div>

        <!-- Year -->
        <div>
            <div class="flex items-baseline justify-between space-y-2">
                <div class="flex flex-col gap-1">
                    <span class="text-xl font-black font-mono text-mist-100 tracking-tight">
                        {{ yearlyStats.percentage }}%
                    </span>
                    <span class="font-mono text-xs text-mist-400">
                        <strong class="text-mist-300">{{ yearlyStats.bookedNights }}</strong> /
                        {{ yearlyStats.totalAvailableNights }} nights
                    </span>
                </div>
                <div class="flex flex-col items-end gap-0.5">
                    <span class="text-xs font-medium text-mist-300">This year</span>
                    <span class="text-[11px] text-mist-500 whitespace-nowrap">
                        {{ getCurrentYear() }}
                    </span>
                </div>
            </div>
            <!-- Progress Bar -->
            <div class="space-y-2">
                <div class="relative h-2.5 w-full rounded-md bg-mist-950/80 overflow-hidden">
                    <div
                        class="h-full rounded-md bg-lime-500 transition-[width] duration-500 ease-out"
                        :style="{ width: `${yearlyProgress}%` }" />
                </div>
                <div class="flex justify-between text-[10px] text-mist-500">
                    <span>0%</span>
                    <span>100%</span>
                </div>
            </div>
        </div>

        <div class="rounded-md border-mist-800/80 bg-mist-950/50 p-2">
            <div class="grid grid-cols-2 divide-x divide-mist-800/80 text-center">
                <div class="px-1">
                    <span class="block text-[10px] uppercase font-semibold text-mist-500">
                        Active Properties
                    </span>
                    <span class="font-mono text-xs font-bold text-lime-400">
                        {{ yearlyStats.activePropertiesCount }}
                    </span>
                </div>
                <div class="px-1">
                    <span class="block text-[10px] uppercase font-semibold text-mist-500">
                        Vacant Nights
                    </span>
                    <span class="font-mono text-xs font-bold text-mist-100">
                        {{ yearlyStats.vacantNights }}
                    </span>
                </div>
            </div>
        </div>
    </div>
</template>
