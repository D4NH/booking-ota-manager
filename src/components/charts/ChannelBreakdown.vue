<script setup lang="ts">
import { ref, computed } from 'vue';
import { Doughnut } from 'vue-chartjs';
import { Chart as ChartJS, ArcElement, Tooltip, type ChartData, type ChartOptions } from 'chart.js';
import type { Booking } from '@/types/booking';

ChartJS.register(ArcElement, Tooltip);

const props = defineProps<{
    bookings: Booking[];
    targetMonth?: string;
}>();

const chartRef = ref<InstanceType<typeof Doughnut> | null>(null);
const hoveredIndex = ref<number | null>(null);

const channelColors = [
    { name: 'Airbnb', color: '#FF5A5F' },
    { name: 'Booking.com', color: '#003580' },
    { name: 'Tiket.com', color: '#0064D2' },
    { name: 'Trip.com', color: '#2577E3' },
    { name: 'Whatsapp', color: '#25D366' },
];

const channelStats = computed(() => {
    const currentMonth = props.targetMonth || '';
    const counts: Record<string, number> = {
        Airbnb: 0,
        'Booking.com': 0,
        'Tiket.com': 0,
        'Trip.com': 0,
        Whatsapp: 0,
    };

    const list = props.bookings || [];
    for (let i = 0; i < list.length; i++) {
        const b = list[i];
        if (!b || b.status === 'Unavailable') continue;

        if (currentMonth && !b.checkIn?.startsWith(currentMonth)) continue;

        const channel = b.listing;
        if (counts[channel] !== undefined) {
            counts[channel]++;
        }
    }

    return channelColors.map((c) => ({
        name: c.name,
        color: c.color,
        count: counts[c.name] || 0,
    }));
});
const totalBookings = computed(() => channelStats.value.reduce((sum, item) => sum + item.count, 0));
const centerLabel = computed(() =>
    hoveredIndex.value !== null && channelStats.value[hoveredIndex.value]
        ? channelStats.value[hoveredIndex.value]?.name
        : 'Total Bookings'
);
const centerValue = computed(() =>
    hoveredIndex.value !== null && channelStats.value[hoveredIndex.value]
        ? channelStats.value[hoveredIndex.value]?.count
        : totalBookings.value
);
const chartData = computed<ChartData<'doughnut'>>(() => ({
    labels: channelStats.value.map((item) => item.name),
    datasets: [
        {
            data: channelStats.value.map((item) => item.count),
            backgroundColor: channelStats.value.map((item) => item.color),
            borderColor: '#121820',
            borderWidth: 2,
            hoverOffset: 25,
        },
    ],
}));
const chartOptions = computed<ChartOptions<'doughnut'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    layout: {
        padding: 5,
    },
    cutout: '75%',
    onHover: (_event, activeElements) => {
        const activeItem = activeElements[0];
        if (activeItem) {
            hoveredIndex.value = activeItem.index;
        } else {
            hoveredIndex.value = null;
        }
    },
    plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
    },
}));

const getChartInstance = (): ChartJS | null => {
    return chartRef.value?.chartInstance || chartRef.value?.chart || null;
};
const highlightSlice = (index: number) => {
    hoveredIndex.value = index;
    const chart = getChartInstance();
    if (!chart) return;

    chart.setActiveElements([{ datasetIndex: 0, index }]);
    chart.update();
};
const clearHighlight = () => {
    hoveredIndex.value = null;
    const chart = getChartInstance();
    if (!chart) return;

    chart.setActiveElements([]);
    chart.update();
};
</script>

<template>
    <div class="flex h-full flex-col rounded-lg border border-mist-800 bg-mist-900 p-5 shadow-md">
        <div class="mb-4">
            <h3 class="text-base font-bold text-mist-100">Channel Distribution</h3>
            <p class="text-xs text-mist-400">Total bookings split by acquisition source</p>
        </div>

        <div class="flex flex-1 justify-center items-center">
            <div class="relative h-50 w-50">
                <Doughnut
                    ref="chartRef"
                    :data="chartData"
                    :options="chartOptions" />

                <div
                    class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span class="text-xs font-semibold text-mist-400 transition-all duration-150">
                        {{ centerLabel }}
                    </span>
                    <span
                        class="text-xl font-extrabold font-mono text-mist-100 transition-all duration-150">
                        {{ centerValue }}
                    </span>
                </div>
            </div>
            <div class="flex flex-col ml-4">
                <div
                    v-for="(item, index) in channelStats"
                    :key="item.name"
                    class="rounded px-2.5 py-1 transition-colors hover:bg-mist-800/50"
                    :class="{ 'bg-mist-800/60': hoveredIndex === index }"
                    @mouseenter="highlightSlice(index)"
                    @mouseleave="clearHighlight">
                    <div class="flex flex-col space-y-1">
                        <div class="flex items-center space-x-2.5">
                            <span
                                class="h-3 w-3 shrink-0 rounded-full"
                                :style="{ backgroundColor: item.color }" />
                            <span class="text-sm text-mist-200">{{ item.name }}</span>
                        </div>
                        <span class="text-xs text-mist-500"> {{ item.count }} Bookings</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
