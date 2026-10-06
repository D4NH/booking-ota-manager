<script setup lang="ts">
import { ref, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useFinanceStore } from '@/stores/useFinanceStore';
import type { PersonalOwner, PersonalFinance, SharedFinance } from '@/types/finance';
import { getDaysInMonth, normalizeDate, getCurrentMonth } from '@/utils/date';
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

const { owner = 'Danh Nguyen' } = defineProps<{
    owner?: PersonalOwner | 'Shared';
}>();

const financeStore = useFinanceStore();
const { personalFinances, sharedFinances, selectedMonth } = storeToRefs(financeStore);

const hoveredIndex = ref<number | null>(null);

const currentCycle = computed(() => selectedMonth.value || getCurrentMonth());
const prevCycle = computed(() => {
    const [y, m] = currentCycle.value.split('-').map(Number);
    const d = new Date(y!, m! - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
});

const daysInCurrentMonth = computed(() => getDaysInMonth(currentCycle.value));
const daysInPrevMonth = computed(() => getDaysInMonth(prevCycle.value));
const maxCalendarDays = 31;

const activeElapsedDay = computed(() => {
    const today = new Date();
    const isThisActualMonth = getCurrentMonth() === currentCycle.value;
    if (isThisActualMonth) {
        return Math.min(today.getDate(), daysInCurrentMonth.value);
    }
    return daysInCurrentMonth.value;
});

function calculateDailyCumulative(cycleStr: string, upToDay: number): number[] {
    const personal = personalFinances.value || [];
    const shared = sharedFinances.value || [];
    const dailyMap = Array.from({ length: 32 }, () => 0);

    const checkAndAdd = (item: PersonalFinance | SharedFinance) => {
        if (!item?.date) return;
        if ('owner' in item && item.owner !== owner) return;

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
    };

    if (owner === 'Danh Nguyen' || owner === 'Citra Ayu Wardani') {
        personal.forEach(checkAndAdd);
    }
    if (owner === 'Shared') {
        shared.forEach(checkAndAdd);
    }

    const cumulative: number[] = [];
    let runningTotal = 0;
    for (let day = 1; day <= upToDay; day++) {
        runningTotal += dailyMap[day] ?? 0;
        cumulative.push(runningTotal);
    }
    return cumulative;
}

const currentPoints = computed(() =>
    calculateDailyCumulative(currentCycle.value, activeElapsedDay.value)
);
const previousPoints = computed(() =>
    calculateDailyCumulative(prevCycle.value, daysInPrevMonth.value)
);

const currentTotal = computed(() => {
    if (!currentPoints.value.length) return 0;
    return currentPoints.value[currentPoints.value.length - 1] ?? 0;
});

const pacingPercentage = computed(() => {
    const elapsed = activeElapsedDay.value;
    const prevAtSameDay = previousPoints.value[elapsed - 1] ?? 0;
    if (prevAtSameDay === 0) return 0;
    const diff = currentTotal.value - prevAtSameDay;
    return Number(((diff / prevAtSameDay) * 100).toFixed(1));
});

const maxVal = computed(() => {
    const highest = Math.max(...currentPoints.value, ...previousPoints.value, 0);
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

function mapPointsToCoordinates(data: number[]) {
    const stepX = chartPlotWidth / (maxCalendarDays - 1);
    return data.map((val, i) => {
        const x = PADDING_LEFT + i * stepX;
        const normalizedY = maxVal.value > 0 ? val / maxVal.value : 0;
        const y = PADDING_TOP + (1 - normalizedY) * chartPlotHeight;
        return { x, y, val, day: i + 1 };
    });
}

const currentCoords = computed(() => mapPointsToCoordinates(currentPoints.value));
const previousCoords = computed(() => mapPointsToCoordinates(previousPoints.value));

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

const currentLinePath = computed(() => generateSmoothPath(currentCoords.value));
const previousLinePath = computed(() => generateSmoothPath(previousCoords.value));

const currentAreaPath = computed(() => {
    if (!currentCoords.value.length) return '';
    const line = currentLinePath.value;
    const lastX = currentCoords.value[currentCoords.value.length - 1]!.x;
    const firstX = currentCoords.value[0]!.x;
    const bottomY = PADDING_TOP + chartPlotHeight;
    return `${line} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
});

const xAxisTickDays = [1, 5, 9, 13, 17, 21, 25, 29];
const xAxisLabels = computed(() => {
    const stepX = chartPlotWidth / (maxCalendarDays - 1);
    return xAxisTickDays.map((day) => ({
        day,
        label: `Day ${day}`,
        x: PADDING_LEFT + (day - 1) * stepX,
    }));
});
</script>

<template>
    <div class="flex h-full min-h-0 flex-col">
        <CardTitle>
            <template #title>Spending</template>
            <template #subtitle>Cumulative MTD outflow trajectory</template>
        </CardTitle>

        <div
            class="flex flex-1 flex-col justify-between space-y-4 rounded-md border border-mist-800 bg-mist-900 p-5 shadow-md"
            @mouseleave="hoveredIndex = null">
            <!-- Header Metrics -->
            <div class="flex flex-wrap items-baseline justify-between gap-2">
                <div class="flex flex-col items-baseline gap-1">
                    <p class="font-mono text-lg font-semibold text-mist-100">
                        {{ formatIDR(currentTotal) }}
                    </p>
                    <p class="flex items-center gap-1 text-xs">
                        <span
                            class="font-medium"
                            :class="pacingPercentage <= 0 ? 'text-emerald-400' : 'text-rose-400'">
                            <fa-icon
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

                <!-- Custom Legend -->
                <div class="flex items-center gap-4 text-xs font-medium text-mist-400">
                    <div class="flex items-center gap-1.5">
                        <span class="h-2 w-2 rounded-full bg-emerald-400"></span>
                        <span class="text-mist-200">This Month</span>
                    </div>
                    <div class="flex items-center gap-1.5">
                        <span
                            class="h-0.5 w-3 border-t border-dashed border-mist-400 bg-mist-500"></span>
                        <span>Last Month</span>
                    </div>
                </div>
            </div>

            <div class="relative flex w-full items-center justify-center">
                <!-- Tooltip -->
                <div
                    v-if="hoveredIndex !== null"
                    class="pointer-events-none absolute -top-3 z-30 space-y-1 rounded-md border border-mist-700 bg-mist-950 px-3 py-2 font-mono text-xs whitespace-nowrap shadow-2xl">
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

                <svg
                    class="h-full w-full overflow-visible select-none"
                    :viewBox="`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`"
                    preserveAspectRatio="none">
                    <defs>
                        <linearGradient
                            id="pacingLimeGradient"
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

                    <!-- Previous Month Trajectory (Muted Gray Dashed Line) -->
                    <path
                        :d="previousLinePath"
                        fill="none"
                        class="pointer-events-none stroke-mist-500 transition-all duration-300"
                        stroke-width="2"
                        stroke-dasharray="5 5"
                        stroke-linecap="round"
                        stroke-linejoin="round" />

                    <!-- Current Month Area Gradient -->
                    <path
                        :d="currentAreaPath"
                        fill="url(#pacingLimeGradient)"
                        class="pointer-events-none transition-all duration-300" />

                    <!-- Current Month Line -->
                    <path
                        :d="currentLinePath"
                        fill="none"
                        class="pointer-events-none stroke-emerald-400 transition-all duration-300"
                        stroke-width="2.5"
                        stroke-linecap="round"
                        stroke-linejoin="round" />

                    <!-- Centered Pulsing Dot -->
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

                    <!-- Hover Crosshairs -->
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

                        <!-- Invisible scrub rect -->
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

                    <!-- Static X-Axis Ticks -->
                    <text
                        v-for="tick in xAxisLabels"
                        :key="tick.day"
                        :x="tick.x"
                        :y="SVG_HEIGHT - 6"
                        text-anchor="middle"
                        class="pointer-events-none font-mono text-[11px] font-medium transition-colors"
                        :class="
                            hoveredIndex !== null && Math.abs(hoveredIndex + 1 - tick.day) <= 1
                                ? 'fill-lime-400'
                                : 'fill-mist-500'
                        ">
                        {{ tick.label }}
                    </text>
                </svg>
            </div>
        </div>
    </div>
</template>
