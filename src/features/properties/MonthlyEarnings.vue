<script setup lang="ts">
import { ref, computed } from 'vue';
import { formatIDR } from '@/utils/money';
import type { WeeklyData, MonthlyData } from '@/composables/useRevenueData';
import CardTitle from '@/components/CardTitle.vue';

interface CoordinatePoint {
    x: number;
    y: number;
    val: number;
}

interface YAxisTick {
    value: number;
    y: number;
    label: string;
}

interface Props {
    weeklyData: WeeklyData;
    monthlyData: MonthlyData;
}

const SVG_WIDTH = 600;
const SVG_HEIGHT = 160;
const PADDING_TOP = 12;
const PADDING_BOTTOM = 12;
const PADDING_LEFT = 12;
const PADDING_RIGHT = 12;
const chartPlotWidth = SVG_WIDTH - PADDING_LEFT - PADDING_RIGHT;
const chartPlotHeight = SVG_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

const { weeklyData, monthlyData } = defineProps<Props>();

const activeView = ref<'weekly' | 'monthly'>('monthly');
const hoveredIndex = ref<number | null>(null);

const currentTotal = computed<number>(() => {
    const list = activeView.value === 'weekly' ? weeklyData.currentWeek : monthlyData.currentMonth;
    return list.reduce((a, b) => a + b, 0);
});
const previousTotal = computed<number>(() => {
    const list = activeView.value === 'weekly' ? weeklyData.lastWeek : monthlyData.lastMonth;
    return list.reduce((a, b) => a + b, 0);
});
const growthPercentage = computed<number>(() => {
    if (previousTotal.value === 0) return 0;
    const diff = currentTotal.value - previousTotal.value;
    return Number(((diff / previousTotal.value) * 100).toFixed(1));
});
const activeLabels = computed<string[]>(() =>
    activeView.value === 'weekly' ? weeklyData.labels : monthlyData.labels
);
const currentPoints = computed<number[]>(() =>
    activeView.value === 'weekly' ? weeklyData.currentWeek : monthlyData.currentMonth
);
const previousPoints = computed<number[]>(() =>
    activeView.value === 'weekly' ? weeklyData.lastWeek : monthlyData.lastMonth
);
const maxVal = computed<number>(() => {
    const all = [...currentPoints.value, ...previousPoints.value];
    const highest = Math.max(...all, 0);
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

const currentCoords = computed<CoordinatePoint[]>(() => mapToCoordinates(currentPoints.value));
const previousCoords = computed<CoordinatePoint[]>(() => mapToCoordinates(previousPoints.value));
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

function mapToCoordinates(data: number[]): CoordinatePoint[] {
    const len = data.length;
    if (len === 0) return [];
    const stepX = chartPlotWidth / Math.max(1, len - 1);

    return data.map((val, i) => {
        const x = PADDING_LEFT + i * stepX;
        const normalizedY = maxVal.value > 0 ? val / maxVal.value : 0;
        const y = PADDING_TOP + (1 - normalizedY) * chartPlotHeight;
        return { x, y, val };
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
</script>

<template>
    <div class="flex h-full min-h-0 flex-col">
        <div class="flex shrink-0 items-center justify-between">
            <CardTitle>
                <template #title>Monthly Earnings</template>
                <template #subtitle>
                    {{
                        activeView === 'weekly'
                            ? 'Compare against last week'
                            : 'Compare against last month'
                    }}
                </template>
            </CardTitle>

            <div
                class="flex items-center rounded-md border border-mist-800 bg-mist-950/50 p-0.5 text-xs select-none">
                <button
                    type="button"
                    class="cursor-pointer rounded-xs px-3 py-1 transition"
                    :class="[
                        activeView === 'weekly'
                            ? 'bg-mist-800 text-lime-400 shadow-sm'
                            : 'text-mist-400 hover:text-mist-200',
                    ]"
                    @click="
                        activeView = 'weekly';
                        hoveredIndex = null;
                    ">
                    Weekly
                </button>
                <button
                    type="button"
                    class="cursor-pointer rounded-xs px-3 py-1 transition"
                    :class="[
                        activeView === 'monthly'
                            ? 'bg-mist-800 text-lime-400 shadow-sm'
                            : 'text-mist-400 hover:text-mist-200',
                    ]"
                    @click="
                        activeView = 'monthly';
                        hoveredIndex = null;
                    ">
                    Monthly
                </button>
            </div>
        </div>

        <div
            class="flex min-h-0 flex-1 flex-col justify-between space-y-3 rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md"
            @mouseleave="hoveredIndex = null">
            <div class="flex shrink-0 flex-wrap items-start justify-between gap-2">
                <div class="flex flex-col gap-0.5">
                    <p class="text-md font-mono font-bold">
                        {{ formatIDR(currentTotal) }}
                    </p>
                    <p class="flex items-center gap-1 text-xs">
                        <span
                            class="font-medium"
                            :class="growthPercentage >= 0 ? 'text-lime-400' : 'text-rose-400'">
                            <fa-icon
                                class="text-[10px]"
                                :icon="
                                    growthPercentage >= 0 ? 'arrow-trend-up' : 'arrow-trend-down'
                                " />
                            {{ Math.abs(growthPercentage) }}%
                        </span>
                        <span class="text-mist-500">
                            vs {{ activeView === 'weekly' ? 'last week' : 'last month' }}
                        </span>
                    </p>
                </div>

                <div class="flex items-center gap-4 text-xs font-medium text-mist-400 select-none">
                    <div class="flex items-center gap-1.5">
                        <span class="h-2 w-2 rounded-full bg-lime-400"></span>
                        <span class="text-mist-200">
                            {{ activeView === 'weekly' ? 'This Week' : 'This Month' }}
                        </span>
                    </div>
                    <div class="flex items-center gap-1.5">
                        <span
                            class="h-0.5 w-3 border-t border-dashed border-mist-400 bg-mist-500"></span>
                        <span>{{ activeView === 'weekly' ? 'Last Week' : 'Last Month' }}</span>
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
                        v-if="hoveredIndex !== null && currentCoords[hoveredIndex]"
                        :style="{ left: `${(currentCoords[hoveredIndex]!.x / SVG_WIDTH) * 100}%` }"
                        :class="[
                            hoveredIndex === 0
                                ? 'translate-x-0'
                                : hoveredIndex === currentCoords.length - 1
                                  ? '-translate-x-full'
                                  : '-translate-x-1/2',
                        ]"
                        class="pointer-events-none absolute -top-3 z-30 space-y-1 rounded-md border border-mist-800 bg-mist-950 px-3 py-2 font-mono text-xs whitespace-nowrap shadow-2xl backdrop-blur-sm transition-all duration-75">
                        <div class="text-mist-400">
                            {{ activeLabels[hoveredIndex] }}
                        </div>
                        <div class="flex justify-between gap-3 text-lime-400">
                            <span>Current:</span>
                            <span class="font-bold">
                                {{ formatIDR(currentPoints[hoveredIndex] ?? 0) }}
                            </span>
                        </div>
                        <div class="flex justify-between gap-3">
                            <span>Previous:</span>
                            <span class="font-bold">
                                {{ formatIDR(previousPoints[hoveredIndex] ?? 0) }}
                            </span>
                        </div>
                    </div>

                    <div class="relative min-h-0 w-full flex-1">
                        <svg
                            class="h-full w-full overflow-visible select-none"
                            :viewBox="`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`"
                            preserveAspectRatio="none">
                            <defs>
                                <linearGradient
                                    id="earningsAreaGradient"
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="1">
                                    <stop
                                        offset="0%"
                                        stop-color="#a3e635"
                                        stop-opacity="0.28" />
                                    <stop
                                        offset="100%"
                                        stop-color="#a3e635"
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
                                :d="currentAreaPath"
                                fill="url(#earningsAreaGradient)"
                                class="pointer-events-none transition-all duration-300" />

                            <path
                                :d="previousLinePath"
                                fill="none"
                                stroke="#71717a"
                                stroke-width="2"
                                stroke-dasharray="5 5"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                class="pointer-events-none transition-all duration-300" />

                            <path
                                :d="currentLinePath"
                                fill="none"
                                stroke="#a3e635"
                                stroke-width="2.5"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                class="pointer-events-none transition-all duration-300" />

                            <g
                                v-for="(pt, idx) in currentCoords"
                                :key="idx">
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
                                    :cx="pt.x"
                                    :cy="pt.y"
                                    :r="hoveredIndex === idx ? 5 : 3"
                                    :fill="hoveredIndex === idx ? '#bef264' : '#a3e635'"
                                    stroke="#18181b"
                                    stroke-width="2"
                                    class="pointer-events-none transition-all duration-150" />

                                <rect
                                    :x="pt.x - chartPlotWidth / currentCoords.length / 2"
                                    :y="0"
                                    :width="chartPlotWidth / currentCoords.length"
                                    :height="SVG_HEIGHT"
                                    fill="transparent"
                                    class="cursor-pointer"
                                    @mouseenter="hoveredIndex = idx" />
                            </g>
                        </svg>
                    </div>

                    <div class="mt-2 flex justify-between text-xs text-mist-400 select-none">
                        <span
                            v-for="(label, idx) in activeLabels"
                            :key="label"
                            class="transition-colors"
                            :class="{ 'font-semibold text-lime-400': hoveredIndex === idx }">
                            {{ label }}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
