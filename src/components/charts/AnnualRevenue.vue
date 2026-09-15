<script setup lang="ts">
import { ref, computed } from 'vue';
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
    type ActiveElement,
    type ChartEvent,
} from 'chart.js';
import { formatDate, getCurrentMonth } from '@/utils/date';

import CardTitle from '@/components/CardTitle.vue';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const {
    data,
    selectedProperty = 'all',
    totalRevenue,
} = defineProps<{
    data: MonthlyPropertyRevenue[];
    selectedProperty?: PropertyId | 'all';
    totalRevenue: number;
}>();

const hoveredIndex = ref<number | null>(null);

// Computes properties with > 0 revenue across the entire dataset for legend & chart rendering
const activeConfigs = computed(() => {
    return PROPERTY_LIST.filter((config) => {
        // Filter by property scope if provided
        if (selectedProperty && selectedProperty !== 'all') {
            return config.id === selectedProperty;
        }

        // Sum earnings across all 12 months for this property
        const totalEarned = data.reduce((sum, row) => {
            const val = row[config.id];
            return sum + (typeof val === 'number' ? val : 0);
        }, 0);

        return totalEarned > 0;
    });
});

const displayHeaderMonth = computed(() => {
    if (hoveredIndex.value !== null) {
        const item = data[hoveredIndex.value];
        if (item?.label) return `${item.label} 2026`;
    }
    return formatDate(getCurrentMonth(), { monthHeader: true });
});

const displayHeaderValue = computed(() => {
    if (hoveredIndex.value !== null && data.length > 0) {
        const item = data[hoveredIndex.value];
        if (!item) return 0;

        return activeConfigs.value.reduce((sum, config) => {
            const val = item[config.id];
            return sum + (typeof val === 'number' ? val : 0);
        }, 0);
    }

    return totalRevenue;
});

const chartData = computed<ChartData<'bar'>>(() => {
    const datasets = activeConfigs.value.map((config) => ({
        label: `${config.id.charAt(0).toUpperCase()}${config.id.slice(1)}`,
        data: data.map((d) => d[config.id] || 0),
        backgroundColor: config.color,
        borderRadius: 4,
        maxBarThickness: 24,
    }));

    return {
        labels: data.map((d) => d.label),
        datasets,
    };
});

const chartOptions = computed<ChartOptions<'bar'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    onHover: (_event: ChartEvent, elements: ActiveElement[] | null) => {
        if (!elements?.[0] || typeof elements[0].index !== 'number') {
            hoveredIndex.value = null;
            return;
        }
        hoveredIndex.value = elements[0].index;
    },
    plugins: {
        legend: { display: false },
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
            ticks: { color: '#8b9bb0', font: { size: 12 } },
        },
        y: {
            stacked: true,
            grid: { color: '#1e2632' },
            ticks: {
                color: '#8b9bb0',
                font: { size: 12 },
                callback: (val) => {
                    const num = Number(val);
                    if (!num || num < 1_000_000) return `${num}`;
                    return `${(num / 1_000_000).toFixed(0)}jt`;
                },
            },
        },
    },
}));
</script>

<template>
    <div class="flex flex-col">
        <CardTitle>
            <template #title>Annual Revenue</template>
            <template #subtitle>Monthly gross earnings across properties</template>
        </CardTitle>
        <div
            class="h-full flex flex-col rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md"
            @mouseleave="hoveredIndex = null">
            <div class="flex justify-between items-center">
                <div>
                    <div class="flex items-center gap-2 h-5">
                        <h3 class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                            {{ displayHeaderMonth }}
                        </h3>
                    </div>
                    <p class="mt-1 text-xl font-bold font-mono text-mist-100">
                        {{ formatIDR(displayHeaderValue) }}
                    </p>
                </div>
                <!-- Dynamic Legend (Shows active revenue units only) -->
                <div class="flex items-center gap-4 text-xs font-medium text-mist-300">
                    <div
                        v-for="item in activeConfigs"
                        :key="item.id"
                        class="flex items-center">
                        <div class="flex items-center space-x-2.5">
                            <span
                                class="h-2.5 w-2.5 shrink-0 rounded-md"
                                :style="{ backgroundColor: item.color }" />
                            <span class="text-sm text-mist-200 capitalize">{{ item.id }}</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="mt-4 h-full w-full min-h-55">
                <Bar
                    :data="chartData"
                    :options="chartOptions" />
            </div>
        </div>
    </div>
</template>
