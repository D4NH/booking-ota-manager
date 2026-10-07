<script setup lang="ts">
import { ref, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { MONTH_NAMES_SHORT } from '@/config/constants';
import { normalizeDate, formatDate } from '@/utils/date';
import { formatIDR } from '@/utils/money';
import CardTitle from '@/components/CardTitle.vue';

interface NetWorthPoint {
    monthStr: string;
    label: string;
    liquidSavings: number;
    sbnPrincipal: number;
    goldValuation: number;
    totalNetWorth: number;
}

interface SvgCoordinatePoint {
    x: number;
    y: number;
    val: number;
    point: NetWorthPoint;
}

interface YAxisTick {
    value: number;
    y: number;
    label: string;
}

const SVG_WIDTH = 600;
const SVG_HEIGHT = 200;
const PADDING_TOP = 20;
const PADDING_BOTTOM = 30;
const PADDING_LEFT = 45;
const PADDING_RIGHT = 20;
const chartPlotWidth = SVG_WIDTH - PADDING_LEFT - PADDING_RIGHT;
const chartPlotHeight = SVG_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

const financeStore = useFinanceStore();
const {
    personalFinances,
    sharedFinances,
    sbnInvestments,
    goldAssets,
    currentGoldPricePerGram,
    selectedMonth,
} = storeToRefs(financeStore);

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
const trajectoryData = computed<NetWorthPoint[]>(() => {
    const personal = personalFinances.value || [];
    const shared = sharedFinances.value || [];
    const sbnList = sbnInvestments.value || [];
    const goldList = goldAssets.value || [];
    const goldPrice = currentGoldPricePerGram.value || 0;

    return monthsToInspect.value.map((cycle) => {
        let cumulativeSavings = 0;

        const processSavingsItem = (item: {
            date?: string;
            category?: string;
            amount?: number;
        }): void => {
            if (!item?.date) return;
            const itemDate = normalizeDate(item.date);
            if (itemDate.slice(0, 7) > cycle) return;
            if (item.category?.toLowerCase().trim() === 'savings') {
                cumulativeSavings += Number(item.amount) || 0;
            }
        };

        for (let i = 0; i < personal.length; i++) {
            const p = personal[i];
            if (p) processSavingsItem(p);
        }
        for (let i = 0; i < shared.length; i++) {
            const s = shared[i];
            if (s) processSavingsItem(s);
        }

        let activeSbn = 0;
        for (let i = 0; i < sbnList.length; i++) {
            const b = sbnList[i];
            if (!b || !b.active) continue;
            const issueCycle = b.issueDate ? normalizeDate(b.issueDate).slice(0, 7) : '0000-00';
            const maturityCycle = b.maturityDate
                ? normalizeDate(b.maturityDate).slice(0, 7)
                : '9999-99';
            if (issueCycle <= cycle && maturityCycle >= cycle) {
                activeSbn += Number(b.principalAmount) || 0;
            }
        }

        let cumulativeGoldGrams = 0;
        for (let i = 0; i < goldList.length; i++) {
            const g = goldList[i];
            if (!g?.purchaseDate) continue;
            const buyCycle = normalizeDate(g.purchaseDate).slice(0, 7);
            if (buyCycle <= cycle) {
                cumulativeGoldGrams += Number(g.weightGrams) || 0;
            }
        }
        const goldValuation = Math.round(cumulativeGoldGrams * goldPrice);

        const totalNetWorth = Math.max(0, cumulativeSavings) + activeSbn + goldValuation;
        const [y, m] = cycle.split('-');
        const monthIdx = Number(m) - 1;
        const shortMonth = MONTH_NAMES_SHORT[monthIdx] || m;
        const label = `${shortMonth} ${y?.slice(2)}`;

        return {
            monthStr: cycle,
            label,
            liquidSavings: Math.max(0, cumulativeSavings),
            sbnPrincipal: activeSbn,
            goldValuation,
            totalNetWorth,
        };
    });
});
const currentMonthPoint = computed<NetWorthPoint>(() => {
    return (
        trajectoryData.value.find((d) => d.monthStr === selectedMonth.value) ||
        trajectoryData.value[trajectoryData.value.length - 1] || {
            monthStr: selectedMonth.value,
            label: selectedMonth.value,
            liquidSavings: 0,
            sbnPrincipal: 0,
            goldValuation: 0,
            totalNetWorth: 0,
        }
    );
});
const previousMonthPoint = computed<NetWorthPoint | null>(() => {
    const list = trajectoryData.value;
    const currentIdx = list.findIndex((d) => d.monthStr === selectedMonth.value);
    if (currentIdx > 0) return list[currentIdx - 1] || null;
    return null;
});
const netWorthGrowthPct = computed<number | null>(() => {
    if (!previousMonthPoint.value || previousMonthPoint.value.totalNetWorth === 0) return null;
    const diff = currentMonthPoint.value.totalNetWorth - previousMonthPoint.value.totalNetWorth;
    return Number(((diff / previousMonthPoint.value.totalNetWorth) * 100).toFixed(1));
});
const maxVal = computed<number>(() => {
    let highest = 0;
    trajectoryData.value.forEach((d) => {
        if (d.totalNetWorth > highest) highest = d.totalNetWorth;
    });
    if (highest <= 0) return 50_000_000;
    const step = highest > 100_000_000 ? 50_000_000 : 10_000_000;
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
const coordinates = computed<SvgCoordinatePoint[]>(() => {
    const len = trajectoryData.value.length;
    if (len === 0) return [];
    const stepX = chartPlotWidth / Math.max(1, len - 1);

    return trajectoryData.value.map((point, i) => {
        const x = PADDING_LEFT + i * stepX;
        const normalizedY = maxVal.value > 0 ? point.totalNetWorth / maxVal.value : 0;
        const y = PADDING_TOP + (1 - normalizedY) * chartPlotHeight;
        return { x, y, val: point.totalNetWorth, point };
    });
});
const linePath = computed<string>(() => generateSmoothPath(coordinates.value));
const areaPath = computed<string>(() => {
    if (!coordinates.value.length) return '';
    const line = linePath.value;
    const lastX = coordinates.value[coordinates.value.length - 1]!.x;
    const firstX = coordinates.value[0]!.x;
    const bottomY = PADDING_TOP + chartPlotHeight;
    return `${line} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
});

function generateSmoothPath(points: { x: number; y: number }[]): string {
    if (!points.length) return '';
    if (points.length === 1) return `M ${points[0]!.x} ${points[0]!.y}`;

    let path = `M ${points[0]!.x} ${points[0]!.y}`;
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i]!;
        const p1 = points[i + 1]!;
        const controlX = (p0.x + p1.x) / 2;
        path += ` C ${controlX} ${p0.y}, ${controlX} ${p1.y}, ${p1.x} ${p1.y}`;
    }
    return path;
}
function handleSelectMonth(targetMonthStr: string): void {
    financeStore.selectedMonth = targetMonthStr;
}
</script>

<template>
    <div class="flex h-full min-h-0 flex-col">
        <div class="flex items-center justify-between">
            <CardTitle>
                <template #title>Total Net Worth Trajectory</template>
                <template #subtitle>
                    {{
                        activeView === '6M'
                            ? '6-Month Rolling Balance Sheet'
                            : `Year ${activeYear} Cumulative Capital`
                    }}
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
            class="flex flex-1 flex-col justify-between space-y-4 rounded-md border border-mist-800 bg-mist-900 p-5 shadow-md"
            @mouseleave="hoveredIndex = null">
            <div class="flex flex-wrap items-baseline justify-between gap-2">
                <div class="flex flex-col items-baseline gap-1">
                    <span class="font-mono text-lg font-semibold text-mist-100">
                        {{ formatIDR(currentMonthPoint.totalNetWorth) }}
                    </span>
                    <p class="flex items-center gap-1 text-xs">
                        <span
                            v-if="netWorthGrowthPct !== null"
                            class="font-medium"
                            :class="netWorthGrowthPct >= 0 ? 'text-lime-400' : 'text-rose-400'">
                            <fa-icon
                                :icon="
                                    netWorthGrowthPct >= 0 ? 'arrow-trend-up' : 'arrow-trend-down'
                                " />
                            {{ Math.abs(netWorthGrowthPct) }}%
                        </span>
                        <span
                            v-else
                            class="text-mist-500"
                            >—</span
                        >
                        <span class="text-mist-500">
                            vs previous month in
                            {{ formatDate(selectedMonth, { monthHeader: true }) }}
                        </span>
                    </p>
                </div>

                <div class="flex items-center gap-4 text-xs font-medium text-mist-400">
                    <div class="flex items-center gap-1.5">
                        <span class="h-2 w-2 rounded-full bg-lime-400" />
                        <span class="text-mist-200">Total Net Worth</span>
                    </div>
                    <div class="flex items-center gap-1.5 font-mono text-[11px] text-mist-500">
                        <span>(Savings + SBN + Gold)</span>
                    </div>
                </div>
            </div>

            <div class="relative flex w-full items-center justify-center">
                <div
                    v-if="hoveredIndex !== null && coordinates[hoveredIndex]"
                    :style="{
                        left: `${(coordinates[hoveredIndex]!.x / SVG_WIDTH) * 100}%`,
                    }"
                    :class="[
                        hoveredIndex === 0
                            ? 'translate-x-0'
                            : hoveredIndex === coordinates.length - 1
                              ? '-translate-x-full'
                              : '-translate-x-1/2',
                    ]"
                    class="pointer-events-none absolute -top-3 z-30 space-y-1 rounded-md border border-mist-700 bg-mist-950 px-3 py-2 font-mono text-xs whitespace-nowrap shadow-2xl backdrop-blur-sm transition-all duration-75">
                    <div class="border-b border-mist-800 pb-0.5 text-[11px] text-mist-400">
                        {{ coordinates[hoveredIndex]!.point.label }}
                    </div>
                    <div class="flex justify-between gap-3 text-amber-400">
                        <span>Gold Value:</span>
                        <span>{{ formatIDR(coordinates[hoveredIndex]!.point.goldValuation) }}</span>
                    </div>
                    <div class="flex justify-between gap-3 text-blue-400">
                        <span>Savings:</span>
                        <span>{{ formatIDR(coordinates[hoveredIndex]!.point.liquidSavings) }}</span>
                    </div>
                    <div class="flex justify-between gap-3 text-teal-400">
                        <span>SBN:</span>
                        <span>{{ formatIDR(coordinates[hoveredIndex]!.point.sbnPrincipal) }}</span>
                    </div>
                    <div class="flex justify-between gap-3 font-bold text-mist-300">
                        <span>Net Worth:</span>
                        <span>{{ formatIDR(coordinates[hoveredIndex]!.point.totalNetWorth) }}</span>
                    </div>
                </div>

                <svg
                    class="h-full w-full overflow-visible select-none"
                    :viewBox="`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`"
                    preserveAspectRatio="none">
                    <defs>
                        <linearGradient
                            id="netWorthGradient"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1">
                            <stop
                                offset="0%"
                                stop-color="currentColor"
                                class="text-lime-400"
                                stop-opacity="0.25" />
                            <stop
                                offset="100%"
                                stop-color="currentColor"
                                class="text-lime-400"
                                stop-opacity="0.0" />
                        </linearGradient>
                    </defs>

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

                    <path
                        :d="areaPath"
                        fill="url(#netWorthGradient)"
                        class="pointer-events-none transition-all duration-300" />

                    <path
                        :d="linePath"
                        fill="none"
                        class="pointer-events-none stroke-lime-400 transition-all duration-300"
                        stroke-width="2.5"
                        stroke-linecap="round"
                        stroke-linejoin="round" />

                    <g
                        v-if="coordinates.length && hoveredIndex === null"
                        :transform="`translate(${coordinates[coordinates.length - 1]!.x}, ${coordinates[coordinates.length - 1]!.y})`">
                        <circle
                            cx="0"
                            cy="0"
                            r="5"
                            class="animate-ping fill-lime-400 opacity-40" />
                        <circle
                            cx="0"
                            cy="0"
                            r="3.5"
                            class="fill-lime-400 stroke-mist-950"
                            stroke-width="1.5" />
                    </g>

                    <g
                        v-for="(pt, idx) in coordinates"
                        :key="pt.point.monthStr">
                        <line
                            v-if="hoveredIndex === idx"
                            :x1="pt.x"
                            :y1="PADDING_TOP"
                            :x2="pt.x"
                            :y2="PADDING_TOP + chartPlotHeight"
                            class="stroke-lime-400/60"
                            stroke-width="1"
                            stroke-dasharray="2 2" />

                        <circle
                            v-if="hoveredIndex === idx"
                            :cx="pt.x"
                            :cy="pt.y"
                            r="4.5"
                            class="fill-lime-300 stroke-mist-950"
                            stroke-width="1.5" />

                        <rect
                            :x="pt.x - chartPlotWidth / coordinates.length / 2"
                            :y="0"
                            :width="chartPlotWidth / coordinates.length"
                            :height="SVG_HEIGHT"
                            fill="transparent"
                            class="cursor-pointer"
                            @mouseenter="hoveredIndex = idx"
                            @click="handleSelectMonth(pt.point.monthStr)" />

                        <text
                            :x="pt.x"
                            :y="SVG_HEIGHT - 6"
                            text-anchor="middle"
                            class="pointer-events-none text-[11px] font-medium transition-colors"
                            :class="
                                hoveredIndex === idx || pt.point.monthStr === selectedMonth
                                    ? 'fill-lime-400 font-bold'
                                    : 'fill-mist-500'
                            ">
                            {{ pt.point.label }}
                        </text>
                    </g>
                </svg>
            </div>
        </div>
    </div>
</template>
