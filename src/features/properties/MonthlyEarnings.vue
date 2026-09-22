<script setup lang="ts">
import { ref, computed } from 'vue';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler,
    type ChartData,
    type ChartOptions,
} from 'chart.js';
import { Line } from 'vue-chartjs';
import { formatIDR } from '@/utils/money';
import type { WeeklyData, MonthlyData } from '@/composables/useRevenueData';

import CardTitle from '@/components/ui/CardTitle.vue';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

const { weeklyData, monthlyData } = defineProps<{
    weeklyData: WeeklyData;
    monthlyData: MonthlyData;
}>();

const activeView = ref<'weekly' | 'monthly'>('monthly');

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
const chartData = computed<ChartData<'line'>>(() => {
    const isWeekly = activeView.value === 'weekly';

    const labels = isWeekly ? weeklyData.labels : monthlyData.labels;
    const currentData = isWeekly ? weeklyData.currentWeek : monthlyData.currentMonth;
    const previousData = isWeekly ? weeklyData.lastWeek : monthlyData.lastMonth;

    return {
        labels,
        datasets: [
            {
                label: isWeekly ? 'This Week' : 'This Month',
                data: currentData,
                borderColor: '#a3e635', // lime-400
                borderWidth: 2.5,
                tension: 0.35,
                fill: true,
            },
            {
                label: isWeekly ? 'Last Week' : 'Last Month',
                data: previousData,
                borderColor: '#71717a', // mist-500
                borderWidth: 2,
                borderDash: [5, 5],
                tension: 0.35,
                fill: false,
            },
        ],
    };
});
const chartOptions = computed<ChartOptions<'line'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
        mode: 'index',
        intersect: false,
    },
    plugins: {
        legend: {
            display: false,
        },
        tooltip: {
            backgroundColor: '#18181b', // mist-900
            titleColor: '#e4e4e7',
            borderColor: '#27272a',
            borderWidth: 1,
            padding: 10,
            callbacks: {
                label: (ctx) => ` ${ctx.dataset.label}: ${formatIDR(ctx.parsed.y ?? 0)}`,
            },
        },
    },
    scales: {
        x: {
            grid: { display: false },
            ticks: {
                color: '#71717a',
                font: { size: 12, weight: 'bold' },
            },
            border: { display: false },
        },
        y: {
            beginAtZero: true,
            ticks: {
                color: '#71717a',
                font: { size: 12 },
                callback: (val) => {
                    const num = Number(val);
                    if (num === 0) return '0';
                    return num >= 1000000
                        ? `${(num / 1000000).toFixed(1)}jt`
                        : `${(num / 1000).toFixed(0)}rb`;
                },
            },
            grid: {
                color: 'rgba(39, 39, 42, 0.6)', // mist-800
            },
            border: { display: false },
        },
    },
}));
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
            <!-- Toggle Buttons -->
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
                    @click="activeView = 'weekly'">
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
                    @click="activeView = 'monthly'">
                    Monthly
                </button>
            </div>
        </div>
        <div
            class="flex flex-col flex-1 justify-between rounded-md border border-mist-800 bg-mist-900 p-5 shadow-md space-y-4">
            <div class="flex flex-wrap items-baseline justify-between gap-2">
                <!-- Current Total -->
                <div class="flex flex-col items-baseline gap-1">
                    <p class="font-mono text-lg font-semibold text-mist-100">
                        {{ formatIDR(currentTotal) }}
                    </p>
                    <p class="flex items-center gap-1 text-xs">
                        <span
                            class="font-medium"
                            :class="growthPercentage >= 0 ? 'text-lime-400' : 'text-rose-400'">
                            {{ growthPercentage >= 0 ? '↑' : '↓' }}
                            {{ Math.abs(growthPercentage) }}%
                        </span>
                        <span class="text-mist-500">
                            vs {{ activeView === 'weekly' ? 'last week' : 'last month' }}
                        </span>
                    </p>
                </div>
                <!-- Legend -->
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

            <div class="relative flex-1 min-h-0 w-full">
                <Line
                    :data="chartData"
                    :options="chartOptions" />
            </div>
        </div>
    </div>
</template>
