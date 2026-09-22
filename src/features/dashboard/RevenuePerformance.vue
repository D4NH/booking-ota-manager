<script setup lang="ts">
import { ref, computed } from 'vue';
import { MONTH_NAMES as monthsList } from '@/config/constants';
import type { Booking } from '@/types/booking';
import { formatIDR } from '@/utils/money';
import CardTitle from '@/components/CardTitle.vue';

const { bookings } = defineProps<{
    bookings: Booking[];
}>();

const now = new Date();
const currentActualMonthIdx = now.getUTCMonth();
const currentActualQuarterIdx = Math.floor(currentActualMonthIdx / 3);

const activeQuarterIndex = ref<number>(currentActualQuarterIdx);
const hoveredIndex = ref<number | null>(null);

const quartersList = [
    { id: 0, label: 'Q1 2026', startMonthIdx: 0 },
    { id: 1, label: 'Q2 2026', startMonthIdx: 3 },
    { id: 2, label: 'Q3 2026', startMonthIdx: 6 },
    { id: 3, label: 'Q4 2026', startMonthIdx: 9 },
];

const fourMonthSequence = computed(() => {
    const currentQuarter = quartersList[activeQuarterIndex.value] ?? quartersList[0]!;
    const startIdx = currentQuarter.startMonthIdx;
    const baseYear = 2026;

    const sequence: { monthIdx: number; year: number }[] = [];

    for (let offset = 0; offset < 4; offset++) {
        let monthIdx = startIdx + offset;
        let year = baseYear;

        if (monthIdx >= 12) {
            monthIdx -= 12;
            year += 1;
        }

        sequence.push({ monthIdx, year });
    }

    const containsCurrentMonth = sequence.some((s) => s.monthIdx === currentActualMonthIdx);

    return sequence.map(({ monthIdx, year }) => {
        const monthName = monthsList[monthIdx] ?? '';
        const revenue = bookings
            .filter((b) => {
                if (b.status === 'Unavailable') return false;
                const date = new Date(b.checkIn);
                return date.getUTCFullYear() === year && date.getUTCMonth() === monthIdx;
            })
            .reduce((sum, b) => sum + b.payout, 0);

        const isHighlighted = containsCurrentMonth
            ? monthIdx === currentActualMonthIdx
            : monthIdx === sequence[3]!.monthIdx;

        return {
            monthIdx,
            monthName,
            year,
            revenue,
            isHighlighted,
        };
    });
});

const summaryStats = computed(() => {
    const data = fourMonthSequence.value;
    const highlightedItem = data.find((item) => item.isHighlighted) ?? data[data.length - 1]!;

    const highlightedIdx = data.findIndex((item) => item.isHighlighted);
    const prevItem = highlightedIdx > 0 ? data[highlightedIdx - 1] : null;

    const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0);
    const avgRevenue = totalRevenue / (data.length || 1);

    const highlightedRevenue = highlightedItem.revenue;
    const prevRevenue = prevItem?.revenue ?? 0;

    const momChange =
        prevRevenue > 0 ? ((highlightedRevenue - prevRevenue) / prevRevenue) * 100 : 0;

    const firstLabel = data[0]?.monthName ?? '';
    const lastLabel = data[data.length - 1]?.monthName ?? '';

    return {
        highlightedMonthLabel: highlightedItem.monthName,
        highlightedMonthRevenue: highlightedRevenue,
        prevMonthLabel: prevItem?.monthName ?? '',
        momChange: Number(momChange.toFixed(1)),
        avgRevenue,
        rangeLabel: firstLabel && lastLabel ? `${firstLabel} - ${lastLabel}` : '',
    };
});

const maxRevenue = computed<number>(() => {
    let highest = 0;
    for (const item of fourMonthSequence.value) {
        if (item.revenue > highest) highest = item.revenue;
    }
    if (highest <= 0) return 10_000_000;
    return Math.ceil(highest / 5_000_000) * 5_000_000;
});

const yAxisTicks = computed(() => {
    const max = maxRevenue.value;
    const step = max / 4;
    return [
        { value: max, label: `${(max / 1_000_000).toFixed(0)}jt` },
        { value: step * 3, label: `${((step * 3) / 1_000_000).toFixed(0)}jt` },
        { value: step * 2, label: `${((step * 2) / 1_000_000).toFixed(0)}jt` },
        { value: step, label: `${(step / 1_000_000).toFixed(0)}jt` },
        { value: 0, label: '0' },
    ];
});

const getBarHeightPct = (amount: number): number => {
    if (maxRevenue.value <= 0 || !amount) return 0;
    return Math.min(100, (amount / maxRevenue.value) * 100);
};
</script>

<template>
    <div class="flex flex-col h-full min-h-0">
        <div class="flex justify-between items-center">
            <CardTitle>
                <template #title>Revenue Performance</template>
                <template #subtitle>
                    Showing 4-month breakdown for {{ summaryStats.rangeLabel }}
                </template>
            </CardTitle>
            <div class="relative w-23">
                <select
                    v-model.number="activeQuarterIndex"
                    class="w-full appearance-none rounded-md border border-mist-800 bg-mist-950/50 px-3 py-2 text-xs text-mist-400 focus:border-lime-500 focus:outline-none transition-colors cursor-pointer">
                    <option
                        v-for="q in quartersList"
                        :key="q.id"
                        :value="q.id">
                        {{ q.label }}
                    </option>
                </select>
                <div
                    class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-mist-400">
                    <fa-icon
                        class="text-xs"
                        icon="angle-down" />
                </div>
            </div>
        </div>

        <div
            class="flex flex-col flex-1 min-h-0 p-4 rounded-md border border-mist-800 bg-mist-900 shadow-md"
            @mouseleave="hoveredIndex = null">
            <div class="flex items-start justify-between gap-4">
                <div class="flex flex-col space-y-1">
                    <span class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                        {{ summaryStats.highlightedMonthLabel }}
                    </span>
                    <div class="font-mono text-lg font-semibold text-mist-200">
                        {{ formatIDR(summaryStats.highlightedMonthRevenue) }}
                    </div>
                    <div
                        v-if="summaryStats.prevMonthLabel"
                        class="flex items-center gap-1 text-xs">
                        <span
                            :class="
                                summaryStats.momChange >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            "
                            class="font-medium">
                            <fa-icon
                                :icon="
                                    summaryStats.momChange >= 0
                                        ? 'arrow-trend-up'
                                        : 'arrow-trend-down'
                                " />
                            {{ Math.abs(summaryStats.momChange) }}%
                        </span>
                        <span class="text-mist-500">vs {{ summaryStats.prevMonthLabel }}</span>
                    </div>
                </div>
            </div>

            <!-- Native Lightweight CSS Bar Chart -->
            <div class="relative mt-6 h-55 w-full flex items-end">
                <!-- Background Horizontal Gridlines -->
                <div
                    class="absolute inset-0 flex flex-col justify-between pointer-events-none pb-6 pr-2">
                    <div
                        v-for="tick in yAxisTicks"
                        :key="tick.value"
                        class="w-full flex items-center border-b border-mist-800/60 text-[10px] font-mono text-mist-500">
                        <span class="w-10 text-right pr-2 select-none">{{ tick.label }}</span>
                        <div class="flex-1 border-b border-mist-800/40" />
                    </div>
                </div>

                <!-- Monthly Bars Column Area -->
                <div class="relative w-full h-full flex items-end justify-between pl-12 pr-4 pb-6">
                    <div
                        v-for="(item, idx) in fourMonthSequence"
                        :key="item.monthName"
                        class="flex-1 flex flex-col items-center h-full justify-end group relative cursor-pointer px-2"
                        @mouseenter="hoveredIndex = idx">
                        <!-- Custom Tooltip -->
                        <div
                            v-if="hoveredIndex === idx"
                            class="absolute -top-14 z-30 pointer-events-none bg-mist-950 border border-mist-750 shadow-2xl rounded-md px-2.5 py-1.5 text-xs font-mono whitespace-nowrap space-y-0.5">
                            <div class="text-[10px] text-mist-400 font-sans">
                                {{ item.monthName }} {{ item.year }}
                            </div>
                            <div class="text-lime-400 font-semibold">
                                {{ formatIDR(item.revenue) }}
                            </div>
                        </div>

                        <!-- Bar Column -->
                        <div class="w-full max-w-12 flex items-end justify-center h-full">
                            <div
                                class="w-full rounded-t-sm transition-all duration-300"
                                :class="[
                                    item.isHighlighted
                                        ? 'bg-lime-400 shadow-sm shadow-lime-400/30'
                                        : 'bg-mist-600 group-hover:bg-mist-500',
                                ]"
                                :style="{ height: `${getBarHeightPct(item.revenue)}%` }" />
                        </div>

                        <!-- X-Axis Month Label -->
                        <span
                            class="absolute -bottom-5 text-xs font-mono transition-colors"
                            :class="
                                item.isHighlighted || hoveredIndex === idx
                                    ? 'font-bold text-lime-400'
                                    : 'text-mist-400 group-hover:text-mist-200'
                            ">
                            {{ item.monthName }}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
