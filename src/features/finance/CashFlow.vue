<script setup lang="ts">
import { ref, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { MONTH_NAMES_SHORT } from '@/config/constants';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { normalizeDate } from '@/utils/date';
import { formatIDR } from '@/utils/money';

import CardTitle from '@/components/CardTitle.vue';

interface MonthlyDataPoint {
    monthStr: string; // "YYYY-MM"
    label: string; // "Jan", "Feb"
    revenue: number;
    expenses: number;
    netMargin: number;
    isActive: boolean;
}

const financeStore = useFinanceStore();
const { unifiedPropertyFinances, selectedMonth } = storeToRefs(financeStore);

const hoveredBar = ref<MonthlyDataPoint | null>(null);
const viewRange = ref<'6M' | 'YTD'>('6M');

const activeYear = computed(() => selectedMonth.value.slice(0, 4));
const monthsToInspect = computed<string[]>(() => {
    if (viewRange.value === 'YTD') {
        // Full Year Jan to Dec for the active year
        return Array.from({ length: 12 }, (_, i) => {
            const m = String(i + 1).padStart(2, '0');
            return `${activeYear.value}-${m}`;
        });
    }

    // 6-Month Rolling window ending at selectedMonth
    const [yStr, mStr] = selectedMonth.value.split('-');
    const currentYear = Number(yStr);
    const currentMonth = Number(mStr);

    const list: string[] = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(currentYear, currentMonth - 1 - i, 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        list.push(`${y}-${m}`);
    }
    return list;
});
const chartData = computed<MonthlyDataPoint[]>(() => {
    const all = unifiedPropertyFinances.value;

    return monthsToInspect.value.map((cycle) => {
        let rev = 0;
        let exp = 0;

        for (let i = 0; i < all.length; i++) {
            const item = all[i];
            if (!item?.date) continue;
            const itemCycle = normalizeDate(item.date).slice(0, 7);
            if (itemCycle !== cycle) continue;

            const amount = Number(item.amount) || 0;
            if (
                item.type === 'income' &&
                item.category !== 'Owner Payout' &&
                item.category !== 'Mai House Jogja Share'
            ) {
                rev += amount;
            } else if (item.type === 'expense' && item.category !== 'Owner Payout Outflow') {
                exp += amount;
            }
        }

        const monthIdx = Number(cycle.split('-')[1]) - 1;
        const label = MONTH_NAMES_SHORT[monthIdx] || cycle;

        return {
            monthStr: cycle,
            label,
            revenue: rev,
            expenses: exp,
            netMargin: rev - exp,
            isActive: cycle === selectedMonth.value,
        };
    });
});
// Dynamic Y-Axis Scaling & Guidelines
const maxVal = computed<number>(() => {
    let highest = 0;
    chartData.value.forEach((d) => {
        if (d.revenue > highest) highest = d.revenue;
        if (d.expenses > highest) highest = d.expenses;
    });
    // Default ceiling to 20M if empty, round up to nearest 5M
    const ceiling = Math.max(highest, 15000000);
    return Math.ceil(ceiling / 5000000) * 5000000;
});
// Generate 4 Y-Axis scale marks (20M, 15M, 10M, 5M, 0)
const yAxisMarks = computed(() => {
    const step = maxVal.value / 4;
    return [
        { val: maxVal.value, label: `Rp ${(maxVal.value / 1000000).toFixed(0)}Jt` },
        { val: step * 3, label: `Rp ${((step * 3) / 1000000).toFixed(0)}Jt` },
        { val: step * 2, label: `Rp ${((step * 2) / 1000000).toFixed(0)}Jt` },
        { val: step, label: `Rp ${(step / 1000000).toFixed(0)}Jt` },
        { val: 0, label: 'Rp 0' },
    ];
});

function calculateHeightPct(amount: number): number {
    if (maxVal.value <= 0) return 0;
    return Math.min(100, (amount / maxVal.value) * 100);
}
</script>

<template>
    <div class="flex flex-col min-h-0">
        <!-- Header & Range Switcher -->
        <div class="flex items-center justify-between">
            <CardTitle>
                <template #title>Property Cash Flow</template>
                <template #subtitle>
                    Rental Revenue vs Operational Expenses &bull;
                    {{ viewRange === '6M' ? '6-Month Rolling' : `Year ${activeYear}` }}
                </template>
            </CardTitle>

            <!-- Range Selector Toggle -->
            <div
                class="flex items-center rounded-md border border-mist-800 bg-mist-950/50 p-0.5 text-xs">
                <button
                    type="button"
                    class="cursor-pointer rounded-md px-3 py-1.5 transition"
                    :class="
                        viewRange === '6M'
                            ? 'bg-mist-800 text-lime-400 shadow-sm'
                            : 'text-mist-400 hover:text-mist-200'
                    "
                    @click="viewRange = '6M'">
                    6 Months
                </button>
                <button
                    type="button"
                    class="cursor-pointer rounded-md px-3 py-1.5 transition"
                    :class="
                        viewRange === 'YTD'
                            ? 'bg-mist-800 text-lime-400 shadow-sm'
                            : 'text-mist-400 hover:text-mist-200'
                    "
                    @click="viewRange = 'YTD'">
                    Full Year
                </button>
            </div>
        </div>

        <div class="h-full border border-mist-800 p-4 rounded-md flex flex-col justify-between">
            <!-- Legend -->
            <div class="flex items-center justify-end gap-3 mb-4 text-xs font-medium text-mist-300">
                <div class="flex items-center gap-3">
                    <div class="flex items-center gap-1.5">
                        <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
                        <span>Revenue</span>
                    </div>
                    <div class="flex items-center gap-1.5">
                        <span class="w-2 h-2 rounded-full bg-rose-400"></span>
                        <span>Expenses</span>
                    </div>
                </div>
            </div>

            <div class="relative flex flex-1 items-end pt-5 pb-2">
                <!-- Background Horizontal Gridlines -->
                <div
                    class="absolute inset-0 flex flex-col justify-between pointer-events-none pb-6 pr-2">
                    <div
                        v-for="mark in yAxisMarks"
                        :key="mark.val"
                        class="w-full flex items-center text-[9px] font-mono text-mist-500">
                        <span class="w-12 text-right pr-2 text-mist-500 select-none">
                            {{ mark.label }}
                        </span>
                        <div class="flex-1 border-b border-mist-800/40"></div>
                    </div>
                </div>

                <!-- Bars Column Container -->
                <div class="relative w-full h-full flex items-end justify-between pl-14 pr-2 pb-6">
                    <div
                        v-for="point in chartData"
                        :key="point.monthStr"
                        class="flex-1 flex flex-col items-center h-full justify-end group relative cursor-pointer px-1"
                        @mouseenter="hoveredBar = point"
                        @mouseleave="hoveredBar = null"
                        @click="financeStore.selectedMonth = point.monthStr">
                        <!-- Hover Tooltip Overlay -->
                        <div
                            v-if="hoveredBar?.monthStr === point.monthStr"
                            class="absolute -top-12 z-30 pointer-events-none bg-mist-950 border border-mist-700 shadow-xl rounded-lg p-2 text-xs font-mono space-y-0.5 whitespace-nowrap">
                            <div class="font-bold text-mist-100 text-xs mb-1">
                                {{ point.label }} {{ point.monthStr.slice(0, 4) }}
                            </div>
                            <div class="flex justify-between gap-3 text-emerald-400 mt-2">
                                <span>Rev:</span>
                                <span>{{ formatIDR(point.revenue) }}</span>
                            </div>
                            <div class="flex justify-between gap-3 text-rose-400">
                                <span>Exp:</span>
                                <span>{{ formatIDR(point.expenses) }}</span>
                            </div>
                            <div
                                class="flex justify-between gap-3 text-mist-300 py-1 mt-1.5 border-t border-mist-800">
                                <span>Net:</span>
                                <span class="text-mist-200">
                                    {{ formatIDR(point.netMargin) }}
                                </span>
                            </div>
                        </div>

                        <!-- Paired Bars -->
                        <div class="w-full flex items-end justify-center gap-1 h-full">
                            <!-- Revenue Bar -->
                            <div
                                class="w-3.5 sm:w-5 rounded-t-sm transition-all duration-300"
                                :class="[
                                    point.isActive
                                        ? 'bg-emerald-400 shadow-sm shadow-lime-400/30'
                                        : 'bg-emerald-500/70 group-hover:bg-emerald-400',
                                ]"
                                :style="{ height: `${calculateHeightPct(point.revenue)}%` }"></div>

                            <!-- Expense Bar -->
                            <div
                                class="w-3.5 sm:w-5 rounded-t-sm transition-all duration-300"
                                :class="[
                                    point.isActive
                                        ? 'bg-rose-400 shadow-sm shadow-rose-400/30'
                                        : 'bg-rose-500/50 group-hover:bg-rose-400',
                                ]"
                                :style="{ height: `${calculateHeightPct(point.expenses)}%` }"></div>
                        </div>

                        <!-- X-Axis Label -->
                        <span
                            class="absolute -bottom-5 text-[10px] font-mono transition-colors"
                            :class="
                                point.isActive
                                    ? 'font-bold text-lime-400'
                                    : 'text-mist-400 group-hover:text-mist-200'
                            ">
                            {{ point.label }}
                        </span>
                    </div>
                </div>
            </div>

            <!-- Footer Metric / Insight -->
            <div
                class="pt-3 mt-1 border-t border-mist-800/70 flex justify-between items-center text-xs text-mist-400">
                <span>Click any column to jump active calculated month</span>
                <div class="flex items-center gap-2">
                    <span> Net Profit: </span>
                    <span class="font-mono text-mist-300 font-semibold">
                        {{ formatIDR(maxVal) }}
                    </span>
                </div>
            </div>
        </div>
    </div>
</template>
