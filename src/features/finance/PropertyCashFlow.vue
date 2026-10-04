<script setup lang="ts">
import { ref, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { MONTH_NAMES_SHORT } from '@/config/constants';
import { normalizeDate, formatDate } from '@/utils/date';
import { formatIDR } from '@/utils/money';

import CardTitle from '@/components/CardTitle.vue';

const SVG_WIDTH = 600;
const SVG_HEIGHT = 200;
const PADDING_TOP = 20;
const PADDING_BOTTOM = 30;
const PADDING_LEFT = 45;
const PADDING_RIGHT = 20;
const chartPlotWidth = SVG_WIDTH - PADDING_LEFT - PADDING_RIGHT;
const chartPlotHeight = SVG_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

interface MonthlyPoint {
    monthStr: string; // "YYYY-MM"
    label: string; // "May"
    income: number;
    expenses: number;
    netMargin: number;
}

const financeStore = useFinanceStore();
const { unifiedPropertyFinances, selectedMonth } = storeToRefs(financeStore);

const activeView = ref<'6M' | 'YTD'>('6M');
const hoveredIndex = ref<number | null>(null);

const activeYear = computed(() => selectedMonth.value.slice(0, 4));

const monthsToInspect = computed<string[]>(() => {
    if (activeView.value === 'YTD') {
        return Array.from({ length: 12 }, (_, i) => {
            const m = String(i + 1).padStart(2, '0');
            return `${activeYear.value}-${m}`;
        });
    }

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

const chartData = computed<MonthlyPoint[]>(() => {
    const property = unifiedPropertyFinances.value || [];

    return monthsToInspect.value.map((cycle) => {
        let inc = 0;
        let exp = 0;

        for (let i = 0; i < property.length; i++) {
            const item = property[i];
            if (!item?.date) continue;
            const itemCycle = normalizeDate(item.date).slice(0, 7);
            if (itemCycle !== cycle) continue;

            const amount = Number(item.amount) || 0;
            if (
                item.type === 'income' &&
                item.category !== 'Owner Payout' &&
                item.category !== 'Mai House Jogja Share'
            ) {
                inc += amount;
            } else if (item.type === 'expense' && item.category !== 'Owner Payout Outflow') {
                exp += amount;
            }
        }

        const [y, m] = cycle.split('-');
        const monthIdx = Number(m) - 1;
        const shortMonth = MONTH_NAMES_SHORT[monthIdx] || m;
        const label = `${shortMonth} ${y?.slice(2)}`;

        return {
            monthStr: cycle,
            label,
            income: inc,
            expenses: exp,
            netMargin: inc - exp,
        };
    });
});

const currentMonthPoint = computed(() => {
    return (
        chartData.value.find((d) => d.monthStr === selectedMonth.value) || {
            netMargin: 0,
            income: 0,
            expenses: 0,
        }
    );
});

const maxVal = computed(() => {
    let highest = 0;
    chartData.value.forEach((d) => {
        if (d.income > highest) highest = d.income;
        if (d.expenses > highest) highest = d.expenses;
    });
    if (highest <= 0) return 1_000_000;
    const step = highest > 10_000_000 ? 5_000_000 : 1_000_000;
    return Math.ceil(highest / step) * step;
});

const yAxisTicks = computed(() => {
    const max = maxVal.value;
    const step = max / 4;
    return [
        {
            value: max,
            y: PADDING_TOP,
            label:
                max >= 1_000_000
                    ? `${(max / 1_000_000).toFixed(1)}jt`
                    : `${(max / 1_000).toFixed(0)}rb`,
        },
        {
            value: step * 2,
            y: PADDING_TOP + chartPlotHeight / 2,
            label:
                step * 2 >= 1_000_000
                    ? `${((step * 2) / 1_000_000).toFixed(1)}jt`
                    : `${((step * 2) / 1_000).toFixed(0)}rb`,
        },
        {
            value: 0,
            y: PADDING_TOP + chartPlotHeight,
            label: '0',
        },
    ];
});

const barGroups = computed(() => {
    const len = chartData.value.length;
    if (len === 0) return [];
    const stepX = chartPlotWidth / len;
    const barWidth = Math.min(18, Math.max(10, stepX * 0.28));
    const gap = 2;

    return chartData.value.map((d, i) => {
        const groupCenterX = PADDING_LEFT + i * stepX + stepX / 2;

        const incomeNorm = maxVal.value > 0 ? d.income / maxVal.value : 0;
        const incomeHeight = Math.max(0, incomeNorm * chartPlotHeight);
        const incomeY = PADDING_TOP + chartPlotHeight - incomeHeight;
        const incomeX = groupCenterX - barWidth - gap / 2;

        const expenseNorm = maxVal.value > 0 ? d.expenses / maxVal.value : 0;
        const expenseHeight = Math.max(0, expenseNorm * chartPlotHeight);
        const expenseY = PADDING_TOP + chartPlotHeight - expenseHeight;
        const expenseX = groupCenterX + gap / 2;

        return {
            ...d,
            centerX: groupCenterX,
            incomeX,
            incomeY,
            incomeHeight,
            expenseX,
            expenseY,
            expenseHeight,
            barWidth,
            stepX,
            triggerX: PADDING_LEFT + i * stepX,
        };
    });
});
</script>

<template>
    <div class="flex h-full min-h-0 flex-col">
        <div class="flex items-center justify-between">
            <CardTitle>
                <template #title>Cash Flow</template>
                <template #subtitle>
                    {{ activeView === '6M' ? '6-Month Rolling Window' : `Year ${activeYear}` }}
                </template>
            </CardTitle>

            <!-- View Switcher Toggle -->
            <div
                class="flex items-center rounded-md border border-mist-800 bg-mist-950/50 p-0.5 text-xs">
                <button
                    type="button"
                    class="cursor-pointer rounded-md px-3 py-1.5 transition"
                    :class="[
                        activeView === '6M'
                            ? 'bg-mist-800 text-lime-400 shadow-sm'
                            : 'text-mist-400 hover:text-mist-200',
                    ]"
                    @click="
                        activeView = '6M';
                        hoveredIndex = null;
                    ">
                    6 Months
                </button>
                <button
                    type="button"
                    class="cursor-pointer rounded-md px-3 py-1.5 transition"
                    :class="[
                        activeView === 'YTD'
                            ? 'bg-mist-800 text-lime-400 shadow-sm'
                            : 'text-mist-400 hover:text-mist-200',
                    ]"
                    @click="
                        activeView = 'YTD';
                        hoveredIndex = null;
                    ">
                    Full Year
                </button>
            </div>
        </div>

        <div
            class="flex flex-1 flex-col justify-between space-y-4 rounded-md border border-mist-800 bg-mist-900 p-5 shadow-md"
            @mouseleave="hoveredIndex = null">
            <!-- Header Metrics -->
            <div class="flex flex-wrap items-baseline justify-between gap-2">
                <div class="flex flex-col items-baseline gap-1">
                    <span class="font-mono text-lg font-semibold">
                        <span
                            class="pr-1"
                            :class="
                                currentMonthPoint.netMargin >= 0
                                    ? 'text-emerald-400'
                                    : 'text-rose-400'
                            ">
                            {{ currentMonthPoint.netMargin >= 0 ? '+' : '-' }}
                        </span>
                        <span>{{ formatIDR(Math.abs(currentMonthPoint.netMargin)) }}</span>
                    </span>

                    <p class="flex items-center gap-1 text-xs text-mist-500">
                        Net this month {{ formatDate(selectedMonth, { monthHeader: true }) }}
                    </p>
                </div>

                <!-- Legend -->
                <div class="flex items-center gap-4 text-xs font-medium text-mist-400">
                    <div class="flex items-center gap-1.5">
                        <span class="h-2 w-2 rounded-full bg-emerald-400"></span>
                        <span class="text-mist-200">Revenue</span>
                    </div>
                    <div class="flex items-center gap-1.5">
                        <span class="h-2 w-2 rounded-full bg-rose-400"></span>
                        <span>Expenses</span>
                    </div>
                </div>
            </div>

            <div class="relative flex w-full items-center justify-center">
                <!-- Tooltip -->
                <div
                    v-if="hoveredIndex !== null && barGroups[hoveredIndex]"
                    :style="{
                        left: `${(barGroups[hoveredIndex]!.centerX / SVG_WIDTH) * 100}%`,
                    }"
                    class="pointer-events-none absolute -top-3 z-30 -translate-x-1/2 space-y-1 rounded-md border border-mist-700 bg-mist-950/95 px-3 py-2 font-mono text-xs whitespace-nowrap shadow-2xl backdrop-blur-sm transition-all duration-75">
                    <div class="border-b border-mist-800 pb-0.5 text-[11px] text-mist-400">
                        {{ barGroups[hoveredIndex]!.label }}
                    </div>
                    <div class="flex justify-between gap-3">
                        <span class="text-emerald-400">Income:</span>
                        <span class="font-medium text-mist-300">
                            {{ formatIDR(barGroups[hoveredIndex]!.income) }}
                        </span>
                    </div>
                    <div class="flex justify-between gap-3">
                        <span class="text-rose-400">Expenses:</span>
                        <span class="font-medium text-mist-300">
                            {{ formatIDR(barGroups[hoveredIndex]!.expenses) }}
                        </span>
                    </div>
                    <div
                        class="flex justify-between gap-3 border-t border-mist-800/80 pt-0.5 text-mist-300">
                        <span>Net:</span>
                        <span
                            class="font-medium"
                            :class="
                                barGroups[hoveredIndex]!.netMargin >= 0
                                    ? 'text-emerald-400'
                                    : 'text-rose-400'
                            ">
                            {{ formatIDR(barGroups[hoveredIndex]!.netMargin) }}
                        </span>
                    </div>
                </div>

                <svg
                    class="h-full w-full overflow-visible select-none"
                    :viewBox="`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`"
                    preserveAspectRatio="none">
                    <!-- Horizontal Grid Lines & Y-Axis Labels -->
                    <g
                        v-for="tick in yAxisTicks"
                        :key="tick.value">
                        <line
                            :x1="PADDING_LEFT"
                            :y1="tick.y"
                            :x2="SVG_WIDTH - PADDING_RIGHT"
                            :y2="tick.y"
                            class="stroke-mist-800/60"
                            stroke-width="1" />
                        <text
                            :x="PADDING_LEFT - 8"
                            :y="tick.y + 3.5"
                            class="fill-mist-500 font-mono text-[10px]"
                            text-anchor="end">
                            {{ tick.label }}
                        </text>
                    </g>

                    <!-- Render Paired Bars & Interactive Zones -->
                    <g
                        v-for="(group, idx) in barGroups"
                        :key="group.monthStr">
                        <!-- Vertical Crosshair line on hover -->
                        <line
                            v-if="hoveredIndex === idx"
                            :x1="group.centerX"
                            :y1="PADDING_TOP"
                            :x2="group.centerX"
                            :y2="PADDING_TOP + chartPlotHeight"
                            class="stroke-lime-400/40"
                            stroke-width="1"
                            stroke-dasharray="2 2" />

                        <!-- Income Bar -->
                        <rect
                            :x="group.incomeX"
                            :y="group.incomeY"
                            :width="group.barWidth"
                            :height="group.incomeHeight"
                            rx="2"
                            class="transition-all duration-200"
                            :class="
                                hoveredIndex === idx ? 'fill-emerald-300' : 'fill-emerald-500/70'
                            " />

                        <!-- Expense Bar -->
                        <rect
                            :x="group.expenseX"
                            :y="group.expenseY"
                            :width="group.barWidth"
                            :height="group.expenseHeight"
                            rx="2"
                            class="transition-all duration-200"
                            :class="hoveredIndex === idx ? 'fill-rose-400' : 'fill-rose-500/50'" />

                        <!-- Full-height invisible hover trigger -->
                        <rect
                            :x="group.triggerX"
                            :y="0"
                            :width="group.stepX"
                            :height="SVG_HEIGHT"
                            fill="transparent"
                            class="cursor-pointer"
                            @mouseenter="hoveredIndex = idx"
                            @click="financeStore.selectedMonth = group.monthStr" />

                        <!-- X-Axis Labels -->
                        <text
                            :x="group.centerX"
                            :y="SVG_HEIGHT - 6"
                            text-anchor="middle"
                            class="pointer-events-none text-[11px] font-medium transition-colors"
                            :class="
                                hoveredIndex === idx || group.monthStr === selectedMonth
                                    ? 'fill-lime-400'
                                    : 'fill-mist-500'
                            ">
                            {{ group.label }}
                        </text>
                    </g>
                </svg>
            </div>
        </div>
    </div>
</template>
