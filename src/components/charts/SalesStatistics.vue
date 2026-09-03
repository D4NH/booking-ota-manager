<script setup lang="ts">
import { computed } from 'vue';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Tooltip,
    type ChartData,
    type ChartOptions,
} from 'chart.js';
import { Line } from 'vue-chartjs';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip);

const props = defineProps<{
    labels: string[];
    bookingsData?: number[];
    profitData?: number[];
}>();

const chartData = computed<ChartData<'line'>>(() => ({
    labels: props.labels,
    datasets: [
        {
            label: 'Total Bookings',
            data: props.bookingsData || [72, 28, 20, 48, 67, 66, 73, 67, 51],
            borderColor: '#A3E635', // Lime-400
            borderWidth: 2,
            tension: 0.45,
            pointRadius: 0,
            pointHoverRadius: 4,
        },
        {
            label: 'Total Revenue',
            data: props.profitData || [37, 21, 45, 42, 24, 24, 63, 70, 72],
            borderColor: '#38BDF8', // Sky-400 Accent
            borderWidth: 2,
            tension: 0.45,
            pointRadius: 0,
            pointHoverRadius: 4,
        },
    ],
}));

console.log('props.labels', props.labels);
console.log('props.bookingsData', props.bookingsData);
console.log('props.profitData', props.profitData);

const chartOptions = computed<ChartOptions<'line'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { display: false },
        tooltip: {
            backgroundColor: '#09090B', // mist-950
            titleColor: '#F4F4F5', // mist-100
            bodyColor: '#A1A1AA', // mist-400
            borderColor: '#27272A', // mist-800
            borderWidth: 1,
            padding: 10,
            displayColors: true,
        },
    },
    scales: {
        x: { display: false },
        y: {
            min: 0,
            max: 100,
            ticks: {
                stepSize: 20,
                color: '#A1A1AA', // mist-400
                font: { size: 11 },
                callback: (val) => `${val}k`,
            },
            grid: { color: '#27272A' }, // mist-800 grid lines
            border: { display: false },
        },
    },
}));
</script>

<template>
    <div
        class="flex h-full flex-col justify-between rounded-xl border border-mist-800 bg-mist-900 p-5 shadow-lg">
        <!-- Header Controls -->
        <div class="flex items-center justify-between">
            <div>
                <h3 class="text-base font-bold text-mist-100">Sales</h3>
                <p class="text-xs text-mist-400">
                    Monthly breakdown of gross revenue, profit, and costs
                </p>
            </div>
        </div>

        <!-- Chart Canvas -->
        <div class="my-4 h-48 w-full">
            <Line
                :data="chartData"
                :options="chartOptions" />
        </div>
    </div>
</template>
