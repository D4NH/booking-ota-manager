<script setup lang="ts">
import { ref, computed } from 'vue';
import { MONTH_NAMES as monthsList } from '@/config/constants';
import type { Booking } from '@/types/booking';
import { formatIDR } from '@/utils/money';

import CardTitle from '@/components/CardTitle.vue';

import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    type ChartData,
    type ChartOptions,
} from 'chart.js';
import { Bar } from 'vue-chartjs';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const { bookings } = defineProps<{
    bookings: Booking[];
}>();

const now = new Date();
const currentActualMonthIdx = now.getUTCMonth(); // e.g. 8 for September
const currentActualQuarterIdx = Math.floor(currentActualMonthIdx / 3); // e.g. 2 for Q3

const activeQuarterIndex = ref<number>(currentActualQuarterIdx);

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

    // If selected quarter contains current month, highlight current month. Otherwise highlight the last month in the quarter.
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
const chartData = computed<ChartData<'bar'>>(() => ({
    labels: fourMonthSequence.value.map((item) => item.monthName),
    datasets: [
        {
            label: 'Gross Revenue (IDR)',
            backgroundColor: fourMonthSequence.value.map((item) =>
                item.isHighlighted ? '#a3e635' : '#475569'
            ),
            hoverBackgroundColor: fourMonthSequence.value.map((item) =>
                item.isHighlighted ? '#84cc16' : '#334155'
            ),
            borderRadius: 4,
            data: fourMonthSequence.value.map((item) => item.revenue),
            maxBarThickness: 50,
            options: {
                animations: {
                    x: false,
                },
            },
        },
    ],
}));
const chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { display: false },
        tooltip: {
            backgroundColor: '#0f172a',
            titleColor: '#f8fafc',
            bodyColor: '#e2e8f0',
            borderColor: '#334155',
            borderWidth: 1,
            callbacks: {
                label: (context) => ` Revenue: ${formatIDR((context.raw as number) ?? 0)}`,
            },
        },
    },
    scales: {
        y: {
            grid: { color: '#1e293b' },
            ticks: {
                color: '#64748b',
                callback: (val) => {
                    const num = Number(val);
                    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(0)}jt`;
                    return `${num}`;
                },
            },
        },
        x: {
            grid: { display: false },
            ticks: { color: '#f8fafc', font: { size: 13 } },
        },
    },
};
</script>

<template>
    <div class="flex flex-col h-full min-h-0 text-mist-100">
        <div class="flex justify-between items-center">
            <CardTitle>
                <template #title>Revenue Performance</template>
                <template #subtitle>
                    Showing 4-month breakdown for {{ summaryStats.rangeLabel }}
                </template>
            </CardTitle>
            <!-- Quarter Selector -->
            <div class="relative w-23">
                <select
                    v-model.number="activeQuarterIndex"
                    class="w-full appearance-none rounded-md border border-mist-800 bg-mist-950/50 px-3 py-1.5 text-xs text-mist-200 focus:border-lime-500 focus:outline-none transition-colors cursor-pointer">
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

        <div class="p-4 h-full min-h-0 rounded-md border border-mist-800 bg-mist-900 shadow-md">
            <div class="flex items-start justify-between gap-4">
                <!-- KPI Summary Cards -->
                <div class="flex flex-col">
                    <span class="text-xs font-medium uppercase tracking-wider text-mist-400">
                        {{ summaryStats.highlightedMonthLabel }}
                    </span>
                    <div class="mt-1 text-lg font-mono font-extrabold text-lime-400">
                        {{ formatIDR(summaryStats.highlightedMonthRevenue) }}
                    </div>
                    <div
                        v-if="summaryStats.prevMonthLabel"
                        class="flex items-center gap-1 text-xs mt-1">
                        <span
                            :class="summaryStats.momChange >= 0 ? 'text-lime-400' : 'text-rose-400'"
                            class="font-medium">
                            {{ summaryStats.momChange >= 0 ? '↑ +' : '↓ '
                            }}{{ summaryStats.momChange }}%
                        </span>
                        <span class="text-mist-500">vs {{ summaryStats.prevMonthLabel }}</span>
                    </div>
                </div>
            </div>

            <div class="mt-4 relative h-64 w-full">
                <Bar
                    :data="chartData"
                    :options="chartOptions" />
            </div>
        </div>
    </div>
</template>
