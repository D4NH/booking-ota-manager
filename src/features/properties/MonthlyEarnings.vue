<script setup lang="ts">
import { ref, computed } from 'vue';
import { formatIDR } from '@/utils/money';
import type { WeeklyData, MonthlyData } from '@/composables/useRevenueData';
import CardTitle from '@/components/CardTitle.vue';

const { weeklyData, monthlyData } = defineProps<{
    weeklyData: WeeklyData;
    monthlyData: MonthlyData;
}>();

const activeView = ref<'weekly' | 'monthly'>('monthly');
const hoveredIndex = ref<number | null>(null);

const currentTotal = computed(() => {
    const list = activeView.value === 'weekly' ? weeklyData.currentWeek : monthlyData.currentMonth;
    return list.reduce((a, b) => a + b, 0);
});

const previousTotal = computed(() => {
    const list = activeView.value === 'weekly' ? weeklyData.lastWeek : monthlyData.lastMonth;
    return list.reduce((a, b) => a + b, 0);
});

const growthPercentage = computed(() => {
    if (previousTotal.value === 0) return 0;
    const diff = currentTotal.value - previousTotal.value;
    return Number(((diff / previousTotal.value) * 100).toFixed(1));
});

const activeLabels = computed(() =>
    activeView.value === 'weekly' ? weeklyData.labels : monthlyData.labels
);

const currentPoints = computed(() =>
    activeView.value === 'weekly' ? weeklyData.currentWeek : monthlyData.currentMonth
);

const previousPoints = computed(() =>
    activeView.value === 'weekly' ? weeklyData.lastWeek : monthlyData.lastMonth
);

const SVG_WIDTH = 600;
const SVG_HEIGHT = 200;
const PADDING_TOP = 20;
const PADDING_BOTTOM = 30;
const PADDING_LEFT = 45;
const PADDING_RIGHT = 20;

const chartPlotWidth = SVG_WIDTH - PADDING_LEFT - PADDING_RIGHT;
const chartPlotHeight = SVG_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

const maxVal = computed(() => {
    const all = [...currentPoints.value, ...previousPoints.value];
    const highest = Math.max(...all, 0);
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

const mapToCoordinates = (data: number[]) => {
    const len = data.length;
    if (len === 0) return [];
    const stepX = chartPlotWidth / Math.max(1, len - 1);

    return data.map((val, i) => {
        const x = PADDING_LEFT + i * stepX;
        const normalizedY = maxVal.value > 0 ? val / maxVal.value : 0;
        const y = PADDING_TOP + (1 - normalizedY) * chartPlotHeight;
        return { x, y, val };
    });
};

const currentCoords = computed(() => mapToCoordinates(currentPoints.value));
const previousCoords = computed(() => mapToCoordinates(previousPoints.value));

const generateSmoothPath = (points: { x: number; y: number }[]): string => {
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
};

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
</script>

<template>
    <div class="flex flex-col h-full min-h-0">
        <div class="flex items-center justify-between">
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

            <!-- View Switcher Toggle -->
            <div
                class="flex items-center rounded-md border border-mist-800 bg-mist-950/50 p-0.5 text-xs">
                <button
                    type="button"
                    class="cursor-pointer rounded-md px-3 py-1.5 transition"
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
                    class="cursor-pointer rounded-md px-3 py-1.5 transition"
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
            class="flex flex-col flex-1 justify-between rounded-md border border-mist-800 bg-mist-900 p-5 shadow-md space-y-4"
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
                            :class="growthPercentage >= 0 ? 'text-lime-400' : 'text-rose-400'">
                            <fa-icon
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

                <!-- Custom Legend -->
                <div class="flex items-center gap-4 text-xs font-medium text-mist-400">
                    <div class="flex items-center gap-1.5">
                        <span class="h-2 w-2 rounded-full bg-lime-400"></span>
                        <span class="text-mist-200">
                            {{ activeView === 'weekly' ? 'This Week' : 'This Month' }}
                        </span>
                    </div>
                    <div class="flex items-center gap-1.5">
                        <span
                            class="h-0.5 w-3 bg-mist-500 border-t border-dashed border-mist-400"></span>
                        <span>{{ activeView === 'weekly' ? 'Last Week' : 'Last Month' }}</span>
                    </div>
                </div>
            </div>

            <div class="relative w-full flex items-center justify-center">
                <!-- Tooltip -->
                <div
                    v-if="hoveredIndex !== null && currentCoords[hoveredIndex]"
                    class="absolute -top-3 z-30 pointer-events-none bg-mist-950 border border-mist-750 shadow-2xl rounded-md px-3 py-2 text-xs font-mono whitespace-nowrap space-y-1">
                    <div class="text-[11px] text-mist-400 pb-0.5 border-b border-mist-800">
                        {{ activeLabels[hoveredIndex] }}
                    </div>
                    <div class="flex justify-between gap-3 text-lime-400">
                        <span>Current:</span>
                        <span class="font-bold">{{
                            formatIDR(currentPoints[hoveredIndex] ?? 0)
                        }}</span>
                    </div>
                    <div class="flex justify-between gap-3 text-mist-400">
                        <span>Previous:</span>
                        <span>{{ formatIDR(previousPoints[hoveredIndex] ?? 0) }}</span>
                    </div>
                </div>

                <svg
                    class="w-full h-full overflow-visible select-none"
                    :viewBox="`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`"
                    preserveAspectRatio="none">
                    <defs>
                        <!-- Lime Area Gradient -->
                        <linearGradient
                            id="areaGradient"
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

                    <!-- Horizontal Grid Lines & Y-Axis Labels -->
                    <g
                        v-for="tick in yAxisTicks"
                        :key="tick.value">
                        <line
                            :x1="PADDING_LEFT"
                            :y1="tick.y"
                            :x2="SVG_WIDTH - PADDING_RIGHT"
                            :y2="tick.y"
                            stroke="#27272a"
                            stroke-width="1"
                            stroke-opacity="0.6" />
                        <text
                            :x="PADDING_LEFT - 8"
                            :y="tick.y + 3.5"
                            fill="#71717a"
                            font-size="10"
                            font-family="monospace"
                            text-anchor="end">
                            {{ tick.label }}
                        </text>
                    </g>

                    <!-- Area Fill -->
                    <path
                        :d="currentAreaPath"
                        fill="url(#areaGradient)"
                        class="transition-all duration-300 pointer-events-none" />

                    <!-- Previous Period Dashed Line -->
                    <path
                        :d="previousLinePath"
                        fill="none"
                        stroke="#71717a"
                        stroke-width="2"
                        stroke-dasharray="5 5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        class="transition-all duration-300 pointer-events-none" />

                    <!-- Current Period Solid Line -->
                    <path
                        :d="currentLinePath"
                        fill="none"
                        stroke="#a3e635"
                        stroke-width="2.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        class="transition-all duration-300 pointer-events-none" />

                    <!-- Interactive Points & Invisible Hover Triggers -->
                    <g
                        v-for="(pt, idx) in currentCoords"
                        :key="idx">
                        <!-- Vertical Crosshair line on hover -->
                        <line
                            v-if="hoveredIndex === idx"
                            :x1="pt.x"
                            :y1="PADDING_TOP"
                            :x2="pt.x"
                            :y2="PADDING_TOP + chartPlotHeight"
                            stroke="#a3e635"
                            stroke-width="1"
                            stroke-dasharray="2 2"
                            stroke-opacity="0.6" />

                        <!-- Point Circle -->
                        <circle
                            :cx="pt.x"
                            :cy="pt.y"
                            :r="hoveredIndex === idx ? 5 : 3"
                            :fill="hoveredIndex === idx ? '#bef264' : '#a3e635'"
                            stroke="#18181b"
                            stroke-width="2"
                            class="transition-all duration-150 pointer-events-none" />

                        <!-- Full-height invisible hover zone -->
                        <rect
                            :x="pt.x - chartPlotWidth / currentCoords.length / 2"
                            :y="0"
                            :width="chartPlotWidth / currentCoords.length"
                            :height="SVG_HEIGHT"
                            fill="transparent"
                            class="cursor-pointer"
                            @mouseenter="hoveredIndex = idx" />

                        <!-- X-Axis Labels -->
                        <text
                            :x="pt.x"
                            :y="SVG_HEIGHT - 6"
                            fill="#71717a"
                            font-size="11"
                            font-weight="600"
                            font-family="'Noto Sans Variable', 'Noto Sans', sans-serif"
                            text-anchor="middle"
                            class="pointer-events-none"
                            :class="{ 'fill-lime-400 font-black': hoveredIndex === idx }">
                            {{ activeLabels[idx] }}
                        </text>
                    </g>
                </svg>
            </div>
        </div>
    </div>
</template>
