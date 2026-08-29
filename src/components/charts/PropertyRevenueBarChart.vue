<script setup lang="ts">
import { computed } from 'vue';
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
import type { PropertyId, MonthlyPropertyRevenue } from '@/types/properties';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const ALL_DATASETS = [
    {
        id: 'piyungan' as PropertyId,
        label: 'Piyungan',
        key: 'piyungan' as const,
        backgroundColor: '#016730',
    },
    {
        id: 'wonosari' as PropertyId,
        label: 'Wonosari',
        key: 'wonosari' as const,
        backgroundColor: '#60a5fa',
    },
    {
        id: 'bantul' as PropertyId,
        label: 'Bantul',
        key: 'bantul' as const,
        backgroundColor: '#fbbf24',
    },
];

const props = defineProps<{
    data: MonthlyPropertyRevenue[];
    selectedProperty?: PropertyId | 'all';
}>();

const chartData = computed<ChartData<'bar'>>(() => {
    // Filter datasets based on selectedProperty prop
    const activeConfigs = ALL_DATASETS.filter((config) => {
        if (!props.selectedProperty || props.selectedProperty === 'all') return true;
        return config.id === props.selectedProperty;
    });

    const datasets = activeConfigs.map((config) => ({
        label: config.label,
        data: props.data.map((d) => d[config.key]),
        backgroundColor: config.backgroundColor,
        borderRadius: 4,
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
            position: 'top',
            align: 'end',
            labels: {
                color: '#8b9bb0',
                boxWidth: 12,
                usePointStyle: true,
                font: { size: 11 },
            },
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
            ticks: { color: '#8b9bb0', font: { size: 11 } },
        },
        y: {
            stacked: true,
            grid: { color: '#1e2632' },
            ticks: {
                color: '#8b9bb0',
                font: { size: 11 },
                callback: (val) => {
                    const num = Number(val);
                    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(0)}M`;
                    return `${num}`;
                },
            },
        },
    },
}));

const formatIDR = (val: number): string => `Rp ${val.toLocaleString('id-ID')}`;
</script>

<template>
    <div class="h-86 w-full">
        <Bar
            :data="chartData"
            :options="chartOptions" />
    </div>
</template>
