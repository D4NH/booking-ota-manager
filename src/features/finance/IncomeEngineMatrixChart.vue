<script setup lang="ts">
import { ref, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { MONTH_NAMES_SHORT } from '@/config/constants';
import { normalizeDate, formatDate } from '@/utils/date';
import { formatIDR } from '@/utils/money';
import CardTitle from '@/components/CardTitle.vue';

interface StreamPoint {
    monthStr: string;
    label: string;
    villaNet: number;
    passiveYield: number;
    activeIncome: number;
    totalInflow: number;
    freedomRatio: number;
}

interface SvgBarSegment {
    monthStr: string;
    label: string;
    centerX: number;
    barWidth: number;
    stepX: number;
    triggerX: number;
    villaX: number;
    villaY: number;
    villaH: number;
    passiveX: number;
    passiveY: number;
    passiveH: number;
    activeX: number;
    activeY: number;
    activeH: number;
    data: StreamPoint;
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
const { unifiedPropertyFinances, personalFinances, sharedFinances, selectedMonth } =
    storeToRefs(financeStore);

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
const matrixData = computed<StreamPoint[]>(() => {
    const properties = unifiedPropertyFinances.value || [];
    const personal = personalFinances.value || [];
    const shared = sharedFinances.value || [];

    return monthsToInspect.value.map((cycle): StreamPoint => {
        let propRev = 0;
        let propExp = 0;

        for (let i = 0; i < properties.length; i++) {
            const item = properties[i];
            if (!item?.date) continue;
            if (normalizeDate(item.date).slice(0, 7) !== cycle) continue;

            const amount = Number(item.amount) || 0;
            if (
                item.type === 'income' &&
                item.category !== 'Owner Payout' &&
                item.category !== 'Mai House Jogja Share'
            ) {
                propRev += amount;
            } else if (item.type === 'expense' && item.category !== 'Owner Payout Outflow') {
                propExp += amount;
            }
        }
        const villaNet = Math.max(0, propRev - propExp);

        let passiveYield = 0;
        const checkYield = (item: {
            date?: string;
            type?: string;
            category?: string;
            notes?: string;
            amount?: number;
        }): void => {
            if (!item?.date || item.type !== 'income') return;
            if (normalizeDate(item.date).slice(0, 7) !== cycle) return;
            const text = `${item.category || ''} ${item.notes || ''}`;
            if (/SR022|SR021|ORI|SBN|SUKUK|yield|coupon/i.test(text)) {
                passiveYield += Number(item.amount) || 0;
            }
        };

        for (let i = 0; i < shared.length; i++) {
            const s = shared[i];
            if (s) checkYield(s);
        }
        for (let i = 0; i < personal.length; i++) {
            const p = personal[i];
            if (p) checkYield(p);
        }

        let activeIncome = 0;
        for (let i = 0; i < personal.length; i++) {
            const item = personal[i];
            if (!item?.date || item.type !== 'income') continue;
            if (normalizeDate(item.date).slice(0, 7) !== cycle) continue;
            // if (item.category === 'Owner Payout') continue;

            const text = `${item.category || ''} ${item.notes || ''}`;
            if (!/SR022|SR021|ORI|SBN|SUKUK|yield|coupon/i.test(text)) {
                activeIncome += Number(item.amount) || 0;
            }
        }

        const totalInflow = villaNet + passiveYield + activeIncome;
        const freedomRatio =
            totalInflow > 0 ? Math.round(((villaNet + passiveYield) / totalInflow) * 100) : 0;

        const [y, m] = cycle.split('-');
        const monthIdx = Number(m) - 1;
        const shortMonth = MONTH_NAMES_SHORT[monthIdx] || m;
        const label = `${shortMonth} ${y?.slice(2)}`;

        return {
            monthStr: cycle,
            label,
            villaNet,
            passiveYield,
            activeIncome,
            totalInflow,
            freedomRatio,
        };
    });
});
const currentMonthPoint = computed<StreamPoint>(() => {
    return (
        matrixData.value.find((d) => d.monthStr === selectedMonth.value) ||
        matrixData.value[matrixData.value.length - 1] || {
            monthStr: selectedMonth.value,
            label: selectedMonth.value,
            villaNet: 0,
            passiveYield: 0,
            activeIncome: 0,
            totalInflow: 0,
            freedomRatio: 0,
        }
    );
});
const maxVal = computed<number>(() => {
    let highest = 0;
    matrixData.value.forEach((d) => {
        if (d.totalInflow > highest) highest = d.totalInflow;
    });
    if (highest <= 0) return 20_000_000;
    const step = highest > 50_000_000 ? 20_000_000 : 5_000_000;
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
const barSegments = computed<SvgBarSegment[]>(() => {
    const len = matrixData.value.length;
    if (len === 0) return [];
    const stepX = chartPlotWidth / len;
    const barWidth = Math.min(24, Math.max(14, stepX * 0.4));

    return matrixData.value.map((d, i) => {
        const centerX = PADDING_LEFT + i * stepX + stepX / 2;
        const barX = centerX - barWidth / 2;
        const groundY = PADDING_TOP + chartPlotHeight;

        const villaH = maxVal.value > 0 ? (d.villaNet / maxVal.value) * chartPlotHeight : 0;
        const villaY = groundY - villaH;

        const passiveH = maxVal.value > 0 ? (d.passiveYield / maxVal.value) * chartPlotHeight : 0;
        const passiveY = villaY - passiveH;

        const activeH = maxVal.value > 0 ? (d.activeIncome / maxVal.value) * chartPlotHeight : 0;
        const activeY = passiveY - activeH;

        return {
            monthStr: d.monthStr,
            label: d.label,
            centerX,
            barWidth,
            stepX,
            triggerX: PADDING_LEFT + i * stepX,
            villaX: barX,
            villaY,
            villaH,
            passiveX: barX,
            passiveY,
            passiveH,
            activeX: barX,
            activeY,
            activeH,
            data: d,
        };
    });
});

function handleSelectMonth(targetMonthStr: string): void {
    financeStore.selectedMonth = targetMonthStr;
}
</script>

<template>
    <div class="flex h-full min-h-0 flex-col">
        <div class="flex items-center justify-between">
            <CardTitle>
                <template #title>Income Engine Matrix</template>
                <template #subtitle> Villa Profits &bull; SBN Yields &bull; Active Work </template>
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
                        {{ formatIDR(currentMonthPoint.totalInflow) }}
                    </span>
                    <p class="flex items-center gap-1.5 text-xs">
                        <span
                            class="rounded border border-lime-400/20 bg-lime-400/10 px-1.5 py-0.5 font-mono font-bold text-lime-400">
                            {{ currentMonthPoint.freedomRatio }}% Passive / Asset Funded
                        </span>
                        <span class="text-mist-500">
                            in {{ formatDate(selectedMonth, { monthHeader: true }) }}
                        </span>
                    </p>
                </div>

                <div class="flex items-center gap-4 text-xs font-medium text-mist-400 select-none">
                    <div class="flex items-center gap-1.5">
                        <span class="h-2 w-2 rounded-sm bg-lime-400" />
                        <span class="text-mist-200">Villa Net</span>
                    </div>
                    <div class="flex items-center gap-1.5">
                        <span class="h-2 w-2 rounded-sm bg-sky-400" />
                        <span class="text-mist-200">SBN Yields</span>
                    </div>
                    <div class="flex items-center gap-1.5">
                        <span class="h-2 w-2 rounded-sm bg-mist-500" />
                        <span>Active Salary</span>
                    </div>
                </div>
            </div>

            <div class="relative flex w-full items-center justify-center">
                <div
                    v-if="hoveredIndex !== null && barSegments[hoveredIndex]"
                    :style="{
                        left: `${(barSegments[hoveredIndex]!.centerX / SVG_WIDTH) * 100}%`,
                    }"
                    :class="[
                        hoveredIndex === 0
                            ? 'translate-x-0'
                            : hoveredIndex === barSegments.length - 1
                              ? '-translate-x-full'
                              : '-translate-x-1/2',
                    ]"
                    class="pointer-events-none absolute -top-3 z-30 space-y-1 rounded-md border border-mist-700 bg-mist-950 px-3 py-2 font-mono text-xs whitespace-nowrap shadow-2xl backdrop-blur-sm transition-all duration-75">
                    <div class="border-b border-mist-800 pb-0.5 text-[11px] text-mist-400">
                        {{ barSegments[hoveredIndex]!.label }} ({{
                            barSegments[hoveredIndex]!.data.freedomRatio
                        }}% Asset Funded)
                    </div>
                    <div class="flex justify-between gap-3 text-lime-400">
                        <span>Villa Net:</span>
                        <span class="font-bold">{{
                            formatIDR(barSegments[hoveredIndex]!.data.villaNet)
                        }}</span>
                    </div>
                    <div class="flex justify-between gap-3 text-sky-400">
                        <span>SBN Yields:</span>
                        <span class="font-bold">{{
                            formatIDR(barSegments[hoveredIndex]!.data.passiveYield)
                        }}</span>
                    </div>
                    <div class="flex justify-between gap-3 text-mist-300">
                        <span>Active Work:</span>
                        <span class="font-bold">{{
                            formatIDR(barSegments[hoveredIndex]!.data.activeIncome)
                        }}</span>
                    </div>
                    <div
                        class="flex justify-between gap-3 border-t border-mist-800/80 pt-0.5 font-bold text-mist-100">
                        <span>Total Receipts:</span>
                        <span>{{ formatIDR(barSegments[hoveredIndex]!.data.totalInflow) }}</span>
                    </div>
                </div>

                <svg
                    class="h-full w-full overflow-visible select-none"
                    :viewBox="`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`"
                    preserveAspectRatio="none">
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

                    <g
                        v-for="(seg, idx) in barSegments"
                        :key="seg.monthStr">
                        <line
                            v-if="hoveredIndex === idx"
                            :x1="seg.centerX"
                            :y1="PADDING_TOP"
                            :x2="seg.centerX"
                            :y2="PADDING_TOP + chartPlotHeight"
                            class="stroke-lime-400/40"
                            stroke-width="1"
                            stroke-dasharray="2 2" />

                        <rect
                            :x="seg.villaX"
                            :y="seg.villaY"
                            :width="seg.barWidth"
                            :height="seg.villaH"
                            class="transition-all duration-200"
                            :class="hoveredIndex === idx ? 'fill-lime-300' : 'fill-lime-400'" />

                        <rect
                            :x="seg.passiveX"
                            :y="seg.passiveY"
                            :width="seg.barWidth"
                            :height="seg.passiveH"
                            class="transition-all duration-200"
                            :class="hoveredIndex === idx ? 'fill-sky-300' : 'fill-sky-400'" />

                        <rect
                            :x="seg.activeX"
                            :y="seg.activeY"
                            :width="seg.barWidth"
                            :height="seg.activeH"
                            rx="2"
                            class="transition-all duration-200"
                            :class="hoveredIndex === idx ? 'fill-mist-400' : 'fill-mist-500'" />

                        <rect
                            :x="seg.triggerX"
                            :y="0"
                            :width="seg.stepX"
                            :height="SVG_HEIGHT"
                            fill="transparent"
                            class="cursor-pointer"
                            @mouseenter="hoveredIndex = idx"
                            @click="handleSelectMonth(seg.monthStr)" />

                        <text
                            :x="seg.centerX"
                            :y="SVG_HEIGHT - 6"
                            text-anchor="middle"
                            class="pointer-events-none text-[11px] font-medium transition-colors"
                            :class="
                                hoveredIndex === idx || seg.monthStr === selectedMonth
                                    ? 'fill-lime-400 font-bold'
                                    : 'fill-mist-500'
                            ">
                            {{ seg.label }}
                        </text>
                    </g>
                </svg>
            </div>
        </div>
    </div>
</template>
