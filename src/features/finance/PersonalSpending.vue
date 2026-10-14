<script setup lang="ts">
import { ref, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useFinanceStore } from '@/stores/useFinanceStore';
import type { PersonalOwner, PersonalFinance, SharedFinance } from '@/types/finance';
import { getDaysInMonth, normalizeDate, getCurrentMonth } from '@/utils/date';
import { formatIDR } from '@/utils/money';

import CardTitle from '@/components/CardTitle.vue';

type ViewMode = 'trajectory' | 'breakdown';

interface CoordinatePoint {
    x: number;
    y: number;
    val: number;
    day: number;
}

interface YAxisTick {
    value: number;
    y: number;
    label: string;
}

interface XAxisTickLabel {
    day: number;
    label: string;
    x: number;
}

interface CategoryBreakdown {
    category: string;
    amount: number;
    pct: number;
    color: string;
}

interface Props {
    owner?: PersonalOwner | 'Shared' | 'All';
}

const SVG_WIDTH = 600;
const SVG_HEIGHT = 160;
const PADDING_TOP = 12;
const PADDING_BOTTOM = 12;
const PADDING_LEFT = 12;
const PADDING_RIGHT = 12;
const chartPlotWidth = SVG_WIDTH - PADDING_LEFT - PADDING_RIGHT;
const chartPlotHeight = SVG_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

const PALETTE: readonly string[] = [
    '#F43F5E',
    '#38BDF8',
    '#F59E0B',
    '#A855F7',
    '#34D399',
    '#EC4899',
    '#64748B',
    '#818CF8',
] as const;

const { owner = 'Danh Nguyen' } = defineProps<Props>();

const financeStore = useFinanceStore();
const { personalFinances, sharedFinances, selectedMonth } = storeToRefs(financeStore);

const activeView = ref<ViewMode>('trajectory');
const hoveredIndex = ref<number | null>(null);

const currentCycle = computed<string>(() => selectedMonth.value || getCurrentMonth());
const prevCycle = computed<string>(() => {
    const [y, m] = currentCycle.value.split('-').map(Number);
    const d = new Date(y!, m! - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
});

const daysInCurrentMonth = computed<number>(() => getDaysInMonth(currentCycle.value));
const daysInPrevMonth = computed<number>(() => getDaysInMonth(prevCycle.value));
const maxCalendarDays = 31;

const activeElapsedDay = computed<number>(() => {
    const today = new Date();
    const isThisActualMonth = getCurrentMonth() === currentCycle.value;
    if (isThisActualMonth) {
        return Math.min(today.getDate(), daysInCurrentMonth.value);
    }
    return daysInCurrentMonth.value;
});

const currentPoints = computed<number[]>(() =>
    calculateDailyCumulative(currentCycle.value, activeElapsedDay.value)
);

const previousPoints = computed<number[]>(() =>
    calculateDailyCumulative(prevCycle.value, daysInPrevMonth.value)
);

const currentTotal = computed<number>(() => {
    if (!currentPoints.value.length) return 0;
    return currentPoints.value[currentPoints.value.length - 1] ?? 0;
});

const pacingPercentage = computed<number>(() => {
    const elapsed = activeElapsedDay.value;
    const prevAtSameDay = previousPoints.value[elapsed - 1] ?? 0;
    if (prevAtSameDay === 0) return 0;
    const diff = currentTotal.value - prevAtSameDay;
    return Number(((diff / prevAtSameDay) * 100).toFixed(1));
});

const maxVal = computed<number>(() => {
    const highest = Math.max(...currentPoints.value, ...previousPoints.value, 0);
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
                    ? `${(max / 1_000_000).toFixed(1)}jt`
                    : `${(max / 1_000).toFixed(0)}rb`,
        },
        {
            value: step * 2,
            y: PADDING_TOP + chartPlotHeight / 2,
            label: `${((step * 2) / 1_000_000).toFixed(1)}jt`,
        },
        {
            value: 0,
            y: PADDING_TOP + chartPlotHeight,
            label: '0',
        },
    ];
});

const currentCoords = computed<CoordinatePoint[]>(() =>
    mapPointsToCoordinates(currentPoints.value)
);
const previousCoords = computed<CoordinatePoint[]>(() =>
    mapPointsToCoordinates(previousPoints.value)
);

const currentLinePath = computed<string>(() => generateSmoothPath(currentCoords.value));
const previousLinePath = computed<string>(() => generateSmoothPath(previousCoords.value));

const currentAreaPath = computed<string>(() => {
    if (!currentCoords.value.length) return '';
    const line = currentLinePath.value;
    const lastX = currentCoords.value[currentCoords.value.length - 1]!.x;
    const firstX = currentCoords.value[0]!.x;
    const bottomY = PADDING_TOP + chartPlotHeight;
    return `${line} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
});

const xAxisTickDays = [1, 5, 9, 13, 17, 21, 25, 29];
const xAxisLabels = computed<XAxisTickLabel[]>(() => {
    const stepX = chartPlotWidth / (maxCalendarDays - 1);
    return xAxisTickDays.map((day) => ({
        day,
        label: `Day ${day}`,
        x: PADDING_LEFT + (day - 1) * stepX,
    }));
});
const scopedExpenseItems = computed<(PersonalFinance | SharedFinance)[]>(() => {
    const personal = personalFinances.value || [];
    const shared = sharedFinances.value || [];
    const cycle = currentCycle.value;
    const items: (PersonalFinance | SharedFinance)[] = [];

    function checkAndPush(item: PersonalFinance | SharedFinance): void {
        if (!item?.date) return;
        if (owner !== 'All' && 'owner' in item && item.owner !== owner) return;

        const normalized = normalizeDate(item.date);
        if (!normalized.startsWith(cycle)) return;

        const cat = item.category?.toLowerCase().trim();
        if (cat === 'savings' || cat === 'gold') return;

        if (item.type === 'expense' || item.type === 'fixed_cost') {
            items.push(item);
        }
    }

    if (owner === 'All' || owner === 'Danh Nguyen' || owner === 'Citra Ayu Wardani') {
        for (let i = 0; i < personal.length; i++) {
            const item = personal[i];
            if (item) checkAndPush(item);
        }
    }
    if (owner === 'All' || owner === 'Shared') {
        for (let i = 0; i < shared.length; i++) {
            const item = shared[i];
            if (item) checkAndPush(item);
        }
    }

    return items;
});
const breakdownTotal = computed<number>(() => {
    let sum = 0;
    const items = scopedExpenseItems.value;
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item) sum += Number(item.amount) || 0;
    }
    return sum;
});
const categoryBreakdowns = computed<CategoryBreakdown[]>(() => {
    const total = breakdownTotal.value;
    const map = new Map<string, number>();
    const items = scopedExpenseItems.value;

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item?.category) continue;
        const cat = item.category.trim();
        map.set(cat, (map.get(cat) ?? 0) + (Number(item.amount) || 0));
    }

    const result: CategoryBreakdown[] = [];
    let idx = 0;
    map.forEach((amount, category) => {
        const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
        result.push({
            category,
            amount,
            pct,
            color: PALETTE[idx % PALETTE.length] ?? '#A3E635',
        });
        idx++;
    });

    return result.sort((a, b) => b.amount - a.amount);
});

function calculateDailyCumulative(cycleStr: string, upToDay: number): number[] {
    const personal = personalFinances.value || [];
    const shared = sharedFinances.value || [];
    const dailyMap = Array.from({ length: 32 }, () => 0);

    function checkAndAdd(item: PersonalFinance | SharedFinance): void {
        if (!item?.date) return;
        if (owner !== 'All' && 'owner' in item && item.owner !== owner) return;

        const normalized = normalizeDate(item.date);
        if (!normalized.startsWith(cycleStr)) return;

        const category = item.category?.toLowerCase().trim();
        if (category === 'savings' || category === 'gold') return;

        if (item.type === 'expense' || item.type === 'fixed_cost') {
            const dayNum = Number(normalized.slice(8, 10));
            if (dayNum >= 1 && dayNum <= 31) {
                dailyMap[dayNum] = (dailyMap[dayNum] ?? 0) + (Number(item.amount) || 0);
            }
        }
    }

    if (owner === 'All' || owner === 'Danh Nguyen' || owner === 'Citra Ayu Wardani') {
        for (let i = 0; i < personal.length; i++) {
            const item = personal[i];
            if (item) checkAndAdd(item);
        }
    }
    if (owner === 'All' || owner === 'Shared') {
        for (let i = 0; i < shared.length; i++) {
            const item = shared[i];
            if (item) checkAndAdd(item);
        }
    }

    const cumulative: number[] = [];
    let runningTotal = 0;
    for (let day = 1; day <= upToDay; day++) {
        runningTotal += dailyMap[day] ?? 0;
        cumulative.push(runningTotal);
    }
    return cumulative;
}
function mapPointsToCoordinates(data: number[]): CoordinatePoint[] {
    const stepX = chartPlotWidth / (maxCalendarDays - 1);
    return data.map((val, i) => {
        const x = PADDING_LEFT + i * stepX;
        const normalizedY = maxVal.value > 0 ? val / maxVal.value : 0;
        const y = PADDING_TOP + (1 - normalizedY) * chartPlotHeight;
        return { x, y, val, day: i + 1 };
    });
}
function generateSmoothPath(points: CoordinatePoint[]): string {
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
function setViewMode(mode: ViewMode): void {
    activeView.value = mode;
}
</script>

<template>
    <div class="flex h-full min-h-0 flex-col">
        <div class="flex shrink-0 items-center justify-between">
            <CardTitle>
                <template #title>Spending</template>
                <template #subtitle>
                    {{
                        activeView === 'trajectory'
                            ? 'Cumulative MTD outflow trajectory'
                            : `Outflow distribution across categories for cycle ${currentCycle}`
                    }}
                </template>
            </CardTitle>

            <div
                class="flex items-center rounded-md border border-mist-800 bg-mist-950/50 p-0.5 text-xs select-none">
                <button
                    type="button"
                    class="cursor-pointer rounded-xs px-3 py-1.5 transition"
                    :class="
                        activeView === 'trajectory'
                            ? 'bg-mist-800 text-lime-400 shadow-sm'
                            : 'text-mist-400 hover:text-mist-200'
                    "
                    @click="setViewMode('trajectory')">
                    Trajectory
                </button>
                <button
                    type="button"
                    class="cursor-pointer rounded-xs px-3 py-1.5 transition"
                    :class="
                        activeView === 'breakdown'
                            ? 'bg-mist-800 text-lime-400 shadow-sm'
                            : 'text-mist-400 hover:text-mist-200'
                    "
                    @click="setViewMode('breakdown')">
                    Breakdown
                </button>
            </div>
        </div>

        <div
            v-if="activeView === 'trajectory'"
            class="flex min-h-0 flex-1 flex-col justify-between space-y-3 rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md"
            @mouseleave="hoveredIndex = null">
            <div class="flex shrink-0 flex-wrap items-baseline justify-between gap-2">
                <div class="flex flex-col gap-0.5">
                    <p class="font-mono text-base font-semibold">
                        {{ formatIDR(currentTotal) }}
                    </p>
                    <p class="flex items-center gap-1 text-xs">
                        <span
                            class="font-medium"
                            :class="pacingPercentage <= 0 ? 'text-emerald-400' : 'text-rose-400'">
                            <fa-icon
                                class="text-[10px]"
                                :icon="
                                    pacingPercentage <= 0 ? 'arrow-trend-down' : 'arrow-trend-up'
                                " />
                            {{ Math.abs(pacingPercentage) }}%
                        </span>
                        <span class="text-mist-500">
                            vs last month on Day {{ activeElapsedDay }}
                        </span>
                    </p>
                </div>

                <div class="flex items-center gap-4 text-xs font-medium text-mist-400 select-none">
                    <div class="flex items-center gap-1.5">
                        <span class="h-2 w-2 rounded-full bg-emerald-400" />
                        <span class="text-mist-200">This Month</span>
                    </div>
                    <div class="flex items-center gap-1.5">
                        <span
                            class="h-0.5 w-3 border-t border-dashed border-mist-400 bg-mist-500" />
                        <span>Last Month</span>
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
                        v-if="hoveredIndex !== null"
                        :style="{ left: `${(hoveredIndex / (maxCalendarDays - 1)) * 100}%` }"
                        :class="[
                            hoveredIndex <= 2
                                ? 'translate-x-0'
                                : hoveredIndex >= maxCalendarDays - 3
                                  ? '-translate-x-full'
                                  : '-translate-x-1/2',
                        ]"
                        class="pointer-events-none absolute -top-3 z-30 space-y-1 rounded-md border border-mist-700 bg-mist-950 px-3 py-2 font-mono text-xs whitespace-nowrap shadow-lg backdrop-blur-sm transition-all duration-75">
                        <div class="border-b border-mist-800 pb-0.5 text-[11px] text-mist-400">
                            Day {{ hoveredIndex + 1 }} of Month
                        </div>
                        <div class="flex justify-between gap-3 text-emerald-400">
                            <span>This Month:</span>
                            <span class="font-bold">
                                {{ formatIDR(currentPoints[hoveredIndex] ?? 0) }}
                            </span>
                        </div>
                        <div class="flex justify-between gap-3 text-mist-400">
                            <span>Last Month:</span>
                            <span>{{ formatIDR(previousPoints[hoveredIndex] ?? 0) }}</span>
                        </div>
                    </div>

                    <div class="relative min-h-0 w-full flex-1">
                        <svg
                            class="h-full w-full overflow-visible select-none"
                            :viewBox="`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`"
                            preserveAspectRatio="none">
                            <defs>
                                <linearGradient
                                    id="pacingAreaGradient"
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="1">
                                    <stop
                                        offset="0%"
                                        stop-color="currentColor"
                                        class="text-emerald-400"
                                        stop-opacity="0.28" />
                                    <stop
                                        offset="100%"
                                        stop-color="currentColor"
                                        class="text-emerald-400"
                                        stop-opacity="0.0" />
                                </linearGradient>
                            </defs>

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

                            <path
                                :d="previousLinePath"
                                fill="none"
                                class="pointer-events-none stroke-mist-500 transition-all duration-300"
                                stroke-width="2"
                                stroke-dasharray="5 5"
                                stroke-linecap="round"
                                stroke-linejoin="round" />

                            <path
                                :d="currentAreaPath"
                                fill="url(#pacingAreaGradient)"
                                class="pointer-events-none transition-all duration-300" />

                            <path
                                :d="currentLinePath"
                                fill="none"
                                class="pointer-events-none stroke-emerald-400 transition-all duration-300"
                                stroke-width="2.5"
                                stroke-linecap="round"
                                stroke-linejoin="round" />

                            <g
                                v-if="currentCoords.length && hoveredIndex === null"
                                :transform="`translate(${currentCoords[currentCoords.length - 1]!.x}, ${currentCoords[currentCoords.length - 1]!.y})`">
                                <circle
                                    cx="0"
                                    cy="0"
                                    r="5"
                                    class="animate-ping fill-emerald-400 opacity-40" />
                                <circle
                                    cx="0"
                                    cy="0"
                                    r="3.5"
                                    class="fill-emerald-400 stroke-mist-950"
                                    stroke-width="1.5" />
                            </g>

                            <g
                                v-for="dayIdx in maxCalendarDays"
                                :key="dayIdx">
                                <line
                                    v-if="hoveredIndex === dayIdx - 1"
                                    :x1="
                                        PADDING_LEFT +
                                        (dayIdx - 1) * (chartPlotWidth / (maxCalendarDays - 1))
                                    "
                                    :y1="PADDING_TOP"
                                    :x2="
                                        PADDING_LEFT +
                                        (dayIdx - 1) * (chartPlotWidth / (maxCalendarDays - 1))
                                    "
                                    :y2="PADDING_TOP + chartPlotHeight"
                                    class="stroke-lime-400/60"
                                    stroke-width="1"
                                    stroke-dasharray="2 2" />

                                <rect
                                    :x="
                                        PADDING_LEFT +
                                        (dayIdx - 1) * (chartPlotWidth / (maxCalendarDays - 1)) -
                                        chartPlotWidth / maxCalendarDays / 2
                                    "
                                    :y="0"
                                    :width="chartPlotWidth / maxCalendarDays"
                                    :height="SVG_HEIGHT"
                                    fill="transparent"
                                    class="cursor-pointer"
                                    @mouseenter="hoveredIndex = dayIdx - 1" />
                            </g>
                        </svg>
                    </div>

                    <div class="relative mt-2 h-3.5 w-full text-xs text-mist-500 select-none">
                        <span
                            v-for="tick in xAxisLabels"
                            :key="tick.day"
                            class="absolute -translate-x-1/2 whitespace-nowrap transition-colors"
                            :style="{ left: `${(tick.x / SVG_WIDTH) * 100}%` }"
                            :class="{
                                'font-bold text-lime-400':
                                    hoveredIndex !== null &&
                                    Math.abs(hoveredIndex + 1 - tick.day) <= 1,
                            }">
                            {{ tick.label }}
                        </span>
                    </div>
                </div>
            </div>
        </div>

        <div
            v-else
            class="flex min-h-0 flex-1 flex-col justify-between space-y-4 rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md">
            <div class="flex flex-col items-baseline gap-1">
                <span class="font-mono text-base font-semibold">
                    {{ formatIDR(breakdownTotal) }}
                </span>
                <p class="flex items-center gap-1 text-xs text-mist-500">
                    Total expenses this month
                </p>
            </div>

            <div class="min-h-0 flex-1 overflow-auto pr-1">
                <div
                    v-for="item in categoryBreakdowns"
                    :key="item.category"
                    class="-mx-2 mb-2 rounded-md px-2 pt-1 pb-2 text-xs transition hover:bg-mist-800/40">
                    <div class="flex items-center justify-between">
                        <span class="flex items-center gap-2 py-0.5 font-medium text-mist-200">
                            <span
                                class="h-2 w-2 shrink-0 rounded-full"
                                :style="{ backgroundColor: item.color }" />
                            <span class="truncate">{{ item.category }}</span>
                        </span>
                        <div class="flex shrink-0 items-center gap-2 font-mono">
                            <span class="text-mist-400">{{ formatIDR(item.amount) }}</span>
                            <span class="min-w-8 text-right font-semibold text-mist-200">
                                {{ item.pct }}%
                            </span>
                        </div>
                    </div>

                    <div class="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-mist-950/60">
                        <div
                            class="h-full rounded-full transition-all duration-500"
                            :style="{
                                width: `${item.pct}%`,
                                backgroundColor: item.color,
                            }" />
                    </div>
                </div>

                <div
                    v-if="categoryBreakdowns.length === 0"
                    class="py-8 text-center text-xs text-mist-400">
                    No expense entries recorded for {{ owner }} in {{ currentCycle }}.
                </div>
            </div>
        </div>
    </div>
</template>
