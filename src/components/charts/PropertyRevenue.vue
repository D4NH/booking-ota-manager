<script setup lang="ts">
import { computed } from 'vue';

import { PROPERTY_LIST } from '@/config/properties';
import type { PropertyId, MonthlyPropertyRevenue } from '@/types/property';
import { formatIDR } from '@/utils/money';

import { Bar } from 'vue-chartjs';
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

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const props = defineProps<{
    data: MonthlyPropertyRevenue[];
    selectedProperty?: PropertyId | 'all';
}>();

const chartData = computed<ChartData<'bar'>>(() => {
    const activeConfigs = PROPERTY_LIST.filter((config) => {
        if (!props.selectedProperty || props.selectedProperty === 'all') return true;
        return config.id === props.selectedProperty;
    });

    const datasets = activeConfigs.map((config) => ({
        label: `${config.id.charAt(0).toUpperCase()}${config.id.slice(1)}`,
        data: props.data.map((d) => d[config.id]),
        backgroundColor: config.color,
        borderRadius: 4,
        maxBarThickness: 24,
    }));

    return {
        labels: props.data.map((d) => d.label),
        datasets,
    };
});
const chartOptions = computed<ChartOptions<'bar'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            display: false,
        },
        tooltip: {
            backgroundColor: '#121820',
            titleColor: '#e6edf8',
            bodyColor: '#8b9bb0',
            borderColor: '#1e2632',
            borderWidth: 1,
            padding: 10,
            callbacks: {
                label: (context) =>
                    ` ${context.dataset.label}: ${formatIDR(context.parsed.y || 0)}`,
            },
        },
    },
    scales: {
        x: {
            stacked: true,
            grid: { display: false },
            ticks: { color: '#8b9bb0', font: { size: 12, weight: 'bold' } },
        },
        y: {
            stacked: true,
            grid: { color: '#1e2632' },
            ticks: {
                color: '#8b9bb0',
                font: { size: 12 },
                callback: (val) => {
                    const num = Number(val);
                    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(0)}jt`;
                    return `${num}`;
                },
            },
        },
    },
}));
</script>

<template>
    <div class="flex flex-col h-full rounded-xl border border-mist-800 bg-mist-900 p-5 shadow-lg">
        <div>
            <h3 class="text-base font-bold text-mist-100">Total Revenue</h3>
            <p class="text-xs text-mist-400">Monthly payout comparison across properties</p>
        </div>

        <div class="my-4 flex gap-3">
            <div
                v-for="item in PROPERTY_LIST"
                :key="item.id"
                class="flex items-center justify-between text-xs font-medium">
                <div class="flex items-center space-x-2.5">
                    <span
                        class="h-3 w-3 shrink-0 rounded-full"
                        :style="{ backgroundColor: item.color }" />
                    <span class="text-mist-200 capitalize">{{ item.id }}</span>
                </div>
            </div>
        </div>

        <div class="relative h-full w-full">
            <Bar
                :data="chartData"
                :options="chartOptions" />
        </div>
    </div>
</template>
