<script setup lang="ts">
import { computed } from 'vue';
import { PROPERTY_LIST } from '@/config/properties';
import { SHORT_MONTH_NAMES } from '@/config/constants';
import type { Booking } from '@/types/booking';
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
    data: Booking[];
    selectedProperty?: string | 'all';
}>();

const monthlyPropertyData = computed(() => {
    const selectedYear = new Date().getFullYear();
    const yearPrefix = `${selectedYear}-`;

    const monthlyPropertyBookings = SHORT_MONTH_NAMES.map((label) => ({
        label,
        piyungan: 0,
        wonosari: 0,
        bantul: 0,
    }));

    for (const b of props.data) {
        if (!b.checkIn.startsWith(yearPrefix) || b.status === 'Unavailable') continue;

        const monthIndex = Number(b.checkIn.substring(5, 7)) - 1;
        const targetMonth = monthlyPropertyBookings[monthIndex];

        if (
            targetMonth &&
            (b.propertyId === 'piyungan' ||
                b.propertyId === 'wonosari' ||
                b.propertyId === 'bantul')
        ) {
            targetMonth[b.propertyId] += b.payout || 0;
        }
    }

    return monthlyPropertyBookings;
});
const quarterlyData = computed(() => {
    const quarters = [
        { piyungan: 0, wonosari: 0, bantul: 0 },
        { piyungan: 0, wonosari: 0, bantul: 0 },
        { piyungan: 0, wonosari: 0, bantul: 0 },
        { piyungan: 0, wonosari: 0, bantul: 0 },
    ];

    const monthlyList = monthlyPropertyData.value || [];

    for (let i = 0; i < monthlyList.length; i++) {
        const item = monthlyList[i];
        if (!item) continue;

        const qIdx = Math.min(3, Math.floor(i / 3));
        const targetQ = quarters[qIdx];

        if (targetQ) {
            targetQ.piyungan += item.piyungan || 0;
            targetQ.wonosari += item.wonosari || 0;
            targetQ.bantul += item.bantul || 0;
        }
    }

    return quarters;
});
const totalRevenue = computed(() => props.data.reduce((acc, b) => acc + (b.payout || 0), 0));
const chartData = computed<ChartData<'bar'>>(() => {
    const activeConfigs = PROPERTY_LIST.filter((config) => {
        if (!props.selectedProperty || props.selectedProperty === 'all') return true;
        return config.id === props.selectedProperty;
    });

    const datasets = activeConfigs.map((config) => ({
        label: `${config.id.charAt(0).toUpperCase()}${config.id.slice(1)}`,
        data: quarterlyData.value.map((q) => q[config.id]),
        backgroundColor: config.color,
        borderRadius: 4,
        maxBarThickness: 24,
    }));

    return {
        labels: ['Q1', 'Q2', 'Q3', 'Q4'],
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
            maxBarThickness: 24,
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
    <div
        class="flex flex-col justify-between rounded-xl border border-mist-800 bg-mist-900 p-5 shadow-lg">
        <div class="flex justify-between">
            <div>
                <h3 class="text-base font-bold text-mist-100">Total Revenue</h3>
                <p class="text-xs text-mist-400">Quarterly payout comparison across properties</p>
            </div>
            <div class="text-lg font-bold font-mono whitespace-nowrap">
                {{ formatIDR(totalRevenue) }}
            </div>
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
