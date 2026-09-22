<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { formatIDR } from '@/utils/money';

import CardTitle from '@/components/ui/CardTitle.vue';

const financeStore = useFinanceStore();
const { sbnMonthlyNetYield, sbnTotalPrincipal, estimatedGoldMarketValue, totalGoldGrams } =
    storeToRefs(financeStore);

// Portfolio Allocation Percentages
const totalInvestments = computed(() => sbnTotalPrincipal.value + estimatedGoldMarketValue.value);

const sbnSharePct = computed(() => {
    if (totalInvestments.value === 0) return 0;
    return Math.round((sbnTotalPrincipal.value / totalInvestments.value) * 100);
});

const goldSharePct = computed(() => {
    if (totalInvestments.value === 0) return 0;
    return 100 - sbnSharePct.value;
});

// SVG Donut Calculations (radius = 40, circumference = 2 * PI * 40 ≈ 251.32)
const circumference = 251.32;
const sbnStrokeDasharray = computed(() => {
    const sbnOffset = (sbnSharePct.value / 100) * circumference;
    return `${sbnOffset} ${circumference - sbnOffset}`;
});

// 12-Month Projected Cash Flow Simulation for SBN
const monthsLabels = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
];
const cashFlowBars = computed(() => {
    const netCoupon = sbnMonthlyNetYield.value;
    return monthsLabels.map((month, idx) => ({
        month,
        amount: netCoupon,
        heightPct: netCoupon > 0 ? 80 : 0, // Uniform fixed coupon height
        active: idx === 8, // September current cycle active
    }));
});
</script>

<template>
    <div>
        <div class="flex items-center justify-between">
            <CardTitle>
                <template #title>Investment Growth & Asset Allocation</template>
                <template #subtitle>
                    Fixed income coupon projections and capital diversification metrics
                </template>
            </CardTitle>
            <div class="text-right">
                <span class="text-xs text-mist-400 block"> Total Invested Capital </span>
                <span class="text-sm font-black font-mono text-lime-400">
                    {{ formatIDR(totalInvestments) }}
                </span>
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <!-- Asset Diversification Donut -->
            <div
                class="bg-mist-800 border border-mist-800 p-4 rounded-md flex flex-col justify-between">
                <span class="text-xs font-semibold uppercase tracking-wider text-mist-400 mb-2">
                    Portfolio Diversification
                </span>

                <div class="flex items-center justify-center gap-4 my-2">
                    <div class="relative w-28 h-28 flex items-center justify-center">
                        <svg
                            class="w-full h-full transform -rotate-90"
                            viewBox="0 0 100 100">
                            <!-- Background Track -->
                            <circle
                                cx="50"
                                cy="50"
                                r="40"
                                stroke="#1C2731"
                                stroke-width="12"
                                fill="transparent" />
                            <!-- Gold Slice -->
                            <circle
                                cx="50"
                                cy="50"
                                r="40"
                                stroke="#F59E0B"
                                stroke-width="12"
                                fill="transparent"
                                :stroke-dasharray="`${circumference} 0`"
                                stroke-linecap="butt" />
                            <!-- SBN Slice -->
                            <circle
                                cx="50"
                                cy="50"
                                r="40"
                                stroke="#10B981"
                                stroke-width="12"
                                fill="transparent"
                                :stroke-dasharray="sbnStrokeDasharray"
                                stroke-dashoffset="0"
                                stroke-linecap="butt" />
                        </svg>
                        <div
                            class="absolute inset-0 flex flex-col items-center justify-center font-mono">
                            <span class="text-xs font-bold text-mist-100">2 Assets</span>
                            <span class="text-[9px] text-mist-400">Targeted</span>
                        </div>
                    </div>

                    <!-- Donut Legend -->
                    <div class="space-y-2 text-xs font-mono">
                        <div class="flex items-center gap-2">
                            <span class="w-2.5 h-2.5 rounded-full bg-mist-500"></span>
                            <div class="flex gap-2">
                                <span class="text-mist-300">SBN SR022</span>
                                <strong class="text-mist-400">{{ sbnSharePct }}%</strong>
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                            <div class="flex gap-2">
                                <span class="text-mist-300"> Gold ({{ totalGoldGrams }}g)</span>
                                <strong class="text-amber-400">{{ goldSharePct }}%</strong>
                            </div>
                        </div>
                    </div>
                </div>

                <p class="text-[11px] text-mist-400 text-center mt-2">
                    Defensive balance between fixed yield and inflationary hedge
                </p>
            </div>

            <!-- SBN 12-Month Projected Cash Flow Bar Chart -->
            <div
                class="lg:col-span-2 bg-mist-800 border border-mist-800 p-4 rounded-md flex flex-col justify-between">
                <div class="flex justify-between items-center mb-2">
                    <span class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                        SBN SR022 Annual Passive Cash Flow
                    </span>
                    <span class="text-xs font-mono font-bold text-mist-200">
                        {{ formatIDR(sbnMonthlyNetYield * 12) }} / year
                    </span>
                </div>

                <!-- Bar Visualization -->
                <div
                    class="h-32 flex items-end justify-between gap-1.5 pt-4 pb-1 border-b border-mist-700/60 font-mono text-[10px]">
                    <div
                        v-for="bar in cashFlowBars"
                        :key="bar.month"
                        class="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer">
                        <!-- Tooltip on Hover -->
                        <div
                            class="opacity-0 group-hover:opacity-100 transition-opacity text-[9px] bg-mist-950/50 text-mist-300 px-1 py-0.5 rounded border border-mist-700 mb-1 pointer-events-none whitespace-nowrap">
                            {{ formatIDR(bar.amount) }}
                        </div>
                        <div
                            class="w-full rounded-t transition-all duration-300"
                            :class="
                                bar.active
                                    ? 'bg-lime-400 shadow-lg shadow-lime-500/20'
                                    : 'bg-mist-500/60 group-hover:bg-mist-400'
                            "
                            :style="{ height: `${bar.heightPct}%` }"></div>
                        <span
                            class="mt-2 text-mist-400 group-hover:text-mist-200"
                            :class="{ 'font-bold text-lime-400': bar.active }">
                            {{ bar.month }}
                        </span>
                    </div>
                </div>

                <div class="flex items-center justify-between pt-2 text-[11px] text-mist-400">
                    <span>Disbursed directly on the 10th of every month</span>
                    <span class="font-mono text-mist-400 font-bold">
                        100% Tax Final (10%) Settled
                    </span>
                </div>
            </div>
        </div>
    </div>
</template>
