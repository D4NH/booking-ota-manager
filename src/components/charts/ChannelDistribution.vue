<script setup lang="ts">
import { computed } from 'vue';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, type ChartOptions } from 'chart.js';
import { Doughnut } from 'vue-chartjs';
import { CHANNEL_COLORS } from '@/config/channel';
import type { Booking } from '@/types/booking';

import CardTitle from '@/components/CardTitle.vue';

ChartJS.register(ArcElement, Tooltip, Legend);

const { bookings } = defineProps<{
    bookings: Booking[];
}>();

const channelStats = computed(() => {
    const counts: Record<string, number> = {};
    let total = 0;

    bookings.forEach((b) => {
        if (b.status === 'Unavailable') return;
        const ch = b.listing || 'Other';
        counts[ch] = (counts[ch] || 0) + 1;
        total += 1;
    });

    const entries = Object.entries(counts).map(([name, count]) => ({
        name,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
        color: CHANNEL_COLORS[name] || CHANNEL_COLORS.Other,
    }));

    // Sort descending by bookings count
    entries.sort((a, b) => b.count - a.count);

    return { entries, total };
});
const chartData = computed(() => ({
    labels: channelStats.value.entries.map((e) => e.name),
    datasets: [
        {
            data: channelStats.value.entries.map((e) => e.count),
            backgroundColor: channelStats.value.entries.map((e) => e.color),
            borderColor: '#18181b', // mist-900 border between segments
            borderWidth: 2,
            hoverOffset: 25,
        },
    ],
}));

const chartOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    layout: {
        padding: 5,
    },
    plugins: {
        legend: { display: false },
        tooltip: {
            backgroundColor: '#18181b',
            titleColor: '#e4e4e7',
            borderColor: '#27272a',
            borderWidth: 1,
            padding: 8,
            callbacks: {
                label: (ctx) => ` ${ctx.label}: ${ctx.raw} bookings`,
            },
        },
    },
};
</script>

<template>
    <div class="flex flex-col">
        <CardTitle>
            <template #title>Channel Distribution</template>
            <template #subtitle> Reservation share by acquisition platform </template>
        </CardTitle>
        <!-- Chart -->
        <div class="flex h-full rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md">
            <div
                v-if="channelStats.total === 0"
                class="flex flex-1 flex-col items-center justify-center text-xs text-mist-300">
                <fa-icon
                    icon="receipt"
                    class="text-xl" />
                <p class="mt-2">No bookings found</p>
            </div>
            <div
                v-else
                class="flex flex-1 items-center gap-4">
                <div class="relative h-55 w-55 shrink-0">
                    <Doughnut
                        :data="chartData"
                        :options="chartOptions" />
                    <div
                        class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span class="text-xl font-bold font-mono text-mist-100 leading-tight">
                            {{ channelStats.total }}
                        </span>
                        <span
                            class="text-[9px] uppercase tracking-wider text-mist-500 font-semibold">
                            Total bookings
                        </span>
                    </div>
                </div>

                <!-- Channel Breakdown List -->
                <div class="flex-1 space-y-4 overflow-y-auto pr-1">
                    <div
                        v-for="ch in channelStats.entries"
                        :key="ch.name"
                        class="space-y-2 text-xs">
                        <div class="flex items-center justify-between">
                            <span class="flex items-center gap-1.5">
                                <span
                                    class="h-2 w-2 rounded-full shrink-0"
                                    :style="{ backgroundColor: ch.color }" />
                                <span class="font-medium text-mist-200">{{ ch.name }}</span>
                                &bull;
                                <span class="text-xs text-mist-500">
                                    <strong class="text-mist-400"> {{ ch.count }}</strong>
                                    bookings
                                </span>
                            </span>
                            <span class="font-mono text-mist-400"> {{ ch.percentage }}% </span>
                        </div>

                        <!-- Progress Bar -->
                        <div class="h-1.5 w-full rounded-full bg-mist-950 overflow-hidden">
                            <div
                                class="h-full rounded-full transition-all duration-500"
                                :style="{
                                    width: `${ch.percentage}%`,
                                    backgroundColor: ch.color,
                                }" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
