<script setup lang="ts">
import { ref, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { MONTH_NAMES_SHORT } from '@/config/constants';
import { normalizeDate } from '@/utils/date';
import { formatIDR } from '@/utils/money';
import CardTitle from '@/components/CardTitle.vue';
import type { PersonalOwner } from '@/types/finance';

interface Props {
    owner?: PersonalOwner | 'Shared' | 'All';
}

interface MonthlyPoint {
    monthStr: string;
    label: string;
    income: number;
    expenses: number;
    netMargin: number;
}

interface YAxisTick {
    value: number;
    y: number;
    label: string;
}

interface BarGroupItem extends MonthlyPoint {
    centerX: number;
    incomeX: number;
    incomeY: number;
    incomeHeight: number;
    expenseX: number;
    expenseY: number;
    expenseHeight: number;
    barWidth: number;
    stepX: number;
    triggerX: number;
}

const SVG_WIDTH = 600;
const SVG_HEIGHT = 160;
const PADDING_TOP = 12;
const PADDING_BOTTOM = 12;
const PADDING_LEFT = 16;
const PADDING_RIGHT = 16;
const chartPlotWidth = SVG_WIDTH - PADDING_LEFT - PADDING_RIGHT;
const chartPlotHeight = SVG_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

const { owner = 'Danh Nguyen' } = defineProps<Props>();

const financeStore = useFinanceStore();
const { personalFinances, sharedFinances, selectedMonth } = storeToRefs(financeStore);

const activeView = ref<'6M' | 'YTD'>('6M');
const hoveredIndex = ref<number | null>(null);

const activeYear = computed<string>(() => selectedMonth.value.slice(0, 4));
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
    const personal = personalFinances.value || [];
    const shared = sharedFinances.value || [];

    return monthsToInspect.value.map((cycle): MonthlyPoint => {
        let inc = 0;
        let exp = 0;

        if (owner === 'All' || owner === 'Danh Nguyen' || owner === 'Citra Ayu Wardani') {
            for (let i = 0; i < personal.length; i++) {
                const item = personal[i];
                if (!item?.date) continue;
                if (owner !== 'All' && item.owner !== owner) continue;

                const itemCycle = normalizeDate(item.date).slice(0, 7);
                if (itemCycle !== cycle) continue;

                const category = item.category?.toLowerCase().trim();
                if (category === 'savings' || category === 'gold') continue;

                const amount = Number(item.amount) || 0;
                if (item.type === 'income') inc += amount;
                else if (item.type === 'expense' || item.type === 'fixed_cost') exp += amount;
            }
        }

        if (owner === 'All' || owner === 'Shared') {
            for (let i = 0; i < shared.length; i++) {
                const item = shared[i];
                if (!item?.date) continue;

                const itemCycle = normalizeDate(item.date).slice(0, 7);
                if (itemCycle !== cycle) continue;

                const category = item.category?.toLowerCase().trim();
                if (category === 'savings' || category === 'gold') continue;

                const amount = Number(item.amount) || 0;
                if (item.type === 'income') inc += amount;
                else if (item.type === 'expense' || item.type === 'fixed_cost') exp += amount;
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
const currentMonthPoint = computed<MonthlyPoint>(() => {
    return (
        chartData.value.find((d) => d.monthStr === selectedMonth.value) || {
            monthStr: selectedMonth.value,
            label: selectedMonth.value,
            netMargin: 0,
            income: 0,
            expenses: 0,
        }
    );
});
const maxVal = computed<number>(() => {
    let highest = 0;
    chartData.value.forEach((d) => {
        if (d.income > highest) highest = d.income;
        if (d.expenses > highest) highest = d.expenses;
    });
    if (highest <= 0) return 1_000_000;
    const step = highest > 10_000_000 ? 5_000_000 : 1_000_000;
    return Math.ceil(highest / step) * step;
});
const yAxisTicks = computed<YAxisTick[]>(() => {
    const max = maxVal.value;
    const step = max / 4;
    return [
        {
            value: max,
            y: PADDING_TOP,
            label:
                max >= 1_000_000
                    ? `${(max / 1_000_000).toFixed(0)}jt`
                    : `${(max / 1_000).toFixed(0)}rb`,
        },
        {
            value: step * 2,
            y: PADDING_TOP + chartPlotHeight / 2,
            label: `${((step * 2) / 1_000_000).toFixed(0)}jt`,
        },
        {
            value: 0,
            y: PADDING_TOP + chartPlotHeight,
            label: '0',
        },
    ];
});
const barGroups = computed<BarGroupItem[]>(() => {
    const len = chartData.value.length;
    if (len === 0) return [];
    const stepX = chartPlotWidth / len;
    const barWidth = Math.min(22, Math.max(12, stepX * 0.32));
    const gap = 2;

    return chartData.value.map((d, i): BarGroupItem => {
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

function handleSelectMonth(targetMonthStr: string): void {
    financeStore.selectedMonth = targetMonthStr;
}
</script>

<template>
    <div class="flex h-full min-h-0 flex-col">
        <div class="flex shrink-0 items-center justify-between">
            <CardTitle>
                <template #title>Cash Flow</template>
                <template #subtitle>
                    {{ activeView === '6M' ? '6-Month Rolling Window' : `Year ${activeYear}` }}
                </template>
            </CardTitle>

            <div
                class="flex items-center rounded-md border border-mist-800 bg-mist-950/50 p-0.5 text-xs select-none">
                <button
                    type="button"
                    class="cursor-pointer rounded-xs px-3 py-1.5 transition"
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
            class="flex min-h-0 flex-1 flex-col justify-between space-y-3 rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md"
            @mouseleave="hoveredIndex = null">
            <div class="flex shrink-0 flex-wrap items-baseline justify-between gap-2">
                <div class="flex flex-col gap-0.5">
                    <div class="flex items-center gap-1 font-mono text-base font-semibold">
                        <span
                            v-if="currentMonthPoint.netMargin < 0"
                            class="text-rose-400">
                            -
                        </span>
                        <span>
                            {{ formatIDR(Math.abs(currentMonthPoint.netMargin)) }}
                        </span>
                    </div>
                    <p class="flex items-center gap-1 text-xs text-mist-500">
                        Net income this month for {{ owner }}
                    </p>
                </div>

                <div class="flex items-center gap-4 text-xs font-medium text-mist-400 select-none">
                    <div class="flex items-center gap-1.5">
                        <span class="h-2 w-2 rounded-full bg-emerald-400" />
                        <span class="text-mist-200">Income</span>
                    </div>
                    <div class="flex items-center gap-1.5">
                        <span class="h-2 w-2 rounded-full bg-rose-400" />
                        <span>Expenses</span>
                    </div>
                </div>
            </div>

            <div class="flex min-h-0 flex-1 items-stretch">
                <div
                    class="flex w-10 shrink-0 flex-col justify-between py-1.5 pr-2 text-right font-mono text-xs text-mist-500 select-none">
                    <span
                        v-for="tick in yAxisTicks"
                        :key="tick.value">
                        {{ tick.label }}
                    </span>
                </div>

                <div class="relative flex min-h-0 min-w-0 flex-1 flex-col justify-between">
                    <div
                        v-if="hoveredIndex !== null && barGroups[hoveredIndex]"
                        :style="{
                            left: `${(barGroups[hoveredIndex]!.centerX / SVG_WIDTH) * 100}%`,
                        }"
                        :class="[
                            hoveredIndex === 0
                                ? 'translate-x-0'
                                : hoveredIndex === barGroups.length - 1
                                  ? '-translate-x-full'
                                  : '-translate-x-1/2',
                        ]"
                        class="pointer-events-none absolute -top-3 z-30 space-y-1 rounded-md border border-mist-700 bg-mist-950 px-3 py-2 font-mono text-xs whitespace-nowrap shadow-2xl backdrop-blur-sm transition-all duration-75">
                        <div class="border-b border-mist-800 pb-0.5 text-xs text-mist-400">
                            {{ barGroups[hoveredIndex]!.label }}
                        </div>
                        <div class="flex justify-between gap-3 text-emerald-400">
                            <span>Income:</span>
                            <span class="font-bold">
                                {{ formatIDR(barGroups[hoveredIndex]!.income) }}
                            </span>
                        </div>
                        <div class="flex justify-between gap-3 text-rose-400">
                            <span>Expenses:</span>
                            <span class="font-bold">
                                {{ formatIDR(barGroups[hoveredIndex]!.expenses) }}
                            </span>
                        </div>
                        <div
                            class="flex justify-between gap-3 border-t border-mist-800/80 pt-0.5 text-mist-300">
                            <span>Net:</span>
                            <span>
                                {{ formatIDR(barGroups[hoveredIndex]!.netMargin) }}
                            </span>
                        </div>
                    </div>

                    <div class="relative min-h-0 w-full flex-1">
                        <svg
                            class="h-full w-full overflow-visible select-none"
                            :viewBox="`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`"
                            preserveAspectRatio="none">
                            <g
                                v-for="tick in yAxisTicks"
                                :key="tick.value">
                                <line
                                    :x1="0"
                                    :y1="tick.y"
                                    :x2="SVG_WIDTH"
                                    :y2="tick.y"
                                    class="stroke-mist-800/60"
                                    stroke-width="1" />
                            </g>

                            <g
                                v-for="(group, idx) in barGroups"
                                :key="group.monthStr">
                                <line
                                    v-if="hoveredIndex === idx"
                                    :x1="group.centerX"
                                    :y1="PADDING_TOP"
                                    :x2="group.centerX"
                                    :y2="PADDING_TOP + chartPlotHeight"
                                    class="stroke-lime-400/40"
                                    stroke-width="1"
                                    stroke-dasharray="2 2" />

                                <rect
                                    :x="group.incomeX"
                                    :y="group.incomeY"
                                    :width="group.barWidth"
                                    :height="group.incomeHeight"
                                    rx="2"
                                    class="transition-all duration-200"
                                    :class="
                                        hoveredIndex === idx
                                            ? 'fill-emerald-300'
                                            : 'fill-emerald-500/70'
                                    " />

                                <rect
                                    :x="group.expenseX"
                                    :y="group.expenseY"
                                    :width="group.barWidth"
                                    :height="group.expenseHeight"
                                    rx="2"
                                    class="transition-all duration-200"
                                    :class="
                                        hoveredIndex === idx ? 'fill-rose-400' : 'fill-rose-500/50'
                                    " />

                                <rect
                                    :x="group.triggerX"
                                    :y="0"
                                    :width="group.stepX"
                                    :height="SVG_HEIGHT"
                                    fill="transparent"
                                    class="cursor-pointer"
                                    @mouseenter="hoveredIndex = idx"
                                    @click="handleSelectMonth(group.monthStr)" />
                            </g>
                        </svg>
                    </div>

                    <!-- X-Axis Labels -->
                    <div class="relative mt-2 h-3.5 w-full text-xs text-mist-500 select-none">
                        <span
                            v-for="(group, idx) in barGroups"
                            :key="group.monthStr"
                            class="absolute -translate-x-1/2 whitespace-nowrap transition-colors"
                            :style="{ left: `${(group.centerX / SVG_WIDTH) * 100}%` }"
                            :class="{
                                'font-bold text-lime-400':
                                    hoveredIndex === idx || group.monthStr === selectedMonth,
                            }">
                            {{ group.label }}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
