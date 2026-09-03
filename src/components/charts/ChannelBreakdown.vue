<script setup lang="ts">
import { computed } from 'vue';
import { Chart as ChartJS, ArcElement, Tooltip, type ChartData, type ChartOptions } from 'chart.js';
import { Doughnut } from 'vue-chartjs';
import type { Booking } from '@/types/booking';

ChartJS.register(ArcElement, Tooltip);

const props = defineProps<{
    bookings: Booking[];
    targetMonth?: string;
}>();

const channelColors = [
    { name: 'Airbnb', color: '#FF5A5F' }, // Lime-400
    { name: 'Booking.com', color: '#003580' }, // Sky-400
    { name: 'Tiket.com', color: '#0064D2' }, // Rose-500
    { name: 'Trip.com', color: '#2577E3' }, // Purple-400
    { name: 'Whatsapp', color: '#25D366' }, // Rose-500
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

    const channels = [
        ...new Set(props.bookings.filter((b) => b.listing !== 'Unavailable').map((b) => b.listing)),
    ];

    console.log('channels', channels);

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

const chartData = computed<ChartData<'doughnut'>>(() => ({
    labels: channelStats.value.map((item) => item.name),
    datasets: [
        {
            data: channelStats.value.map((item) => item.count),
            backgroundColor: channelStats.value.map((item) => item.color),
            borderColor: '#18181B', // mist-900 matching card background
            borderWidth: 2,
            hoverOffset: 4,
        },
    ],
}));

const chartOptions = computed<ChartOptions<'doughnut'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    plugins: {
        legend: {
            display: false,
        },
        tooltip: {
            enabled: false,
        },
    },
}));
</script>

<template>
    <div class="flex h-full flex-col rounded-xl border border-mist-800 bg-mist-900 p-5 shadow-lg">
        <div class="mb-4">
            <h3 class="text-base font-bold text-mist-100">Channel Distribution</h3>
            <p class="text-xs text-mist-400">Total bookings split by acquisition source</p>
        </div>

        <div class="flex flex-1 items-center justify-between gap-4">
            <div class="relative h-44 w-44 shrink-0">
                <Doughnut
                    :data="chartData"
                    :options="chartOptions" />

                <div
                    class="pointer-events-none absolute inset-0 flex items-center justify-center text-mist-500">
                    <fa-icon
                        class="text-xl"
                        icon="book" />
                </div>
            </div>

            <!-- Legend -->
            <div class="flex-1 space-y-3 pl-2">
                <div
                    v-for="item in channelStats"
                    :key="item.name"
                    class="flex items-center justify-between text-xs font-medium">
                    <div class="flex items-center space-x-2.5">
                        <span
                            class="h-3 w-3 rounded-full shrink-0"
                            :style="{ backgroundColor: item.color }" />
                        <span class="text-mist-200">{{ item.name }}</span>
                    </div>
                    <span class="font-mono font-bold text-mist-100">{{ item.count }}</span>
                </div>
            </div>
        </div>
    </div>
</template>
