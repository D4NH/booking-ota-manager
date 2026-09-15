<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend,
    type ChartOptions,
    type ChartData,
} from 'chart.js';
import { Doughnut } from 'vue-chartjs';
import { CHANNEL_COLORS } from '@/config/channel';
import type { Booking } from '@/types/booking';
import { formatIDR } from '@/utils/money';

import CardTitle from '@/components/CardTitle.vue';

ChartJS.register(ArcElement, Tooltip, Legend);

interface Props {
    bookings: Booking[];
}

interface DoughnutChartRef {
    chart: ChartJS<'doughnut'> | null;
}

const { bookings } = defineProps<Props>();

const chartRef = ref<DoughnutChartRef | null>(null);
const hoveredIndex = ref<number | null>(null);
const viewMode = ref<'count' | 'revenue'>('count');

const yearOptions = computed<number[]>(() => {
    const years = new Set<number>();
    for (const b of bookings) {
        if (b.checkIn && b.checkIn.length >= 4) {
            const year = Number(b.checkIn.slice(0, 4));
            if (!Number.isNaN(year)) years.add(year);
        }
    }
    if (years.size === 0) years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
});

const selectedYear = ref<number>(yearOptions.value[0] ?? new Date().getFullYear());

watch(yearOptions, (available) => {
    if (!available.includes(selectedYear.value) && available.length > 0) {
        selectedYear.value = available[0]!;
    }
});

const channelStats = computed(() => {
    const targetYearStr = String(selectedYear.value);
    const counts = new Map<string, number>();
    const revenues = new Map<string, number>();
    let totalCount = 0;
    let totalRevenue = 0;

    for (const b of bookings) {
        if (b.status === 'Unavailable' || b.status === 'No show') continue;
        if (!b.checkIn || b.checkIn.slice(0, 4) !== targetYearStr) continue;

        const channel = b.listing || 'Other';
        const payout = b.payout || 0;

        counts.set(channel, (counts.get(channel) ?? 0) + 1);
        revenues.set(channel, (revenues.get(channel) ?? 0) + payout);

        totalCount += 1;
        totalRevenue += payout;
    }

    const isRev = viewMode.value === 'revenue';
    const sourceMap = isRev ? revenues : counts;
    const total = isRev ? totalRevenue : totalCount;

    const entries = Array.from(sourceMap.entries()).map(([name, value]) => ({
        name,
        count: counts.get(name) ?? 0,
        revenue: revenues.get(name) ?? 0,
        value,
        percentage: total > 0 ? Math.round((value / total) * 100) : 0,
        color: CHANNEL_COLORS[name] ?? CHANNEL_COLORS.Other,
    }));

    entries.sort((a, b) => b.value - a.value);
    return { entries, totalCount, totalRevenue, total };
});

const chartData = computed<ChartData<'doughnut'>>(() => ({
    labels: channelStats.value.entries.map((e) => e.name),
    datasets: [
        {
            data: channelStats.value.entries.map((e) => e.value),
            backgroundColor: channelStats.value.entries.map((e) => e.color),
            borderColor: '#18181b',
            borderWidth: 2,
            hoverOffset: 20,
        },
    ],
}));

const chartOptions = computed<ChartOptions<'doughnut'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '75%',
    layout: { padding: 5 },
    onHover: (_event, activeElements) => {
        hoveredIndex.value = activeElements[0]?.index ?? null;
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
                label: (ctx) => {
                    const val = Number(ctx.raw) || 0;
                    return viewMode.value === 'revenue'
                        ? ` ${ctx.label}: ${formatIDR(val)}`
                        : ` ${ctx.label}: ${val} stays`;
                },
            },
        },
    },
}));

const clearHighlight = (): void => {
    hoveredIndex.value = null;
    chartRef.value?.chart?.setActiveElements([]);
    chartRef.value?.chart?.update();
};
</script>

<template>
    <div class="flex flex-col">
        <div class="flex justify-between items-center">
            <CardTitle>
                <template #title>Channel Distribution</template>
                <template #subtitle>Share breakdown by volume and gross revenue</template>
            </CardTitle>

            <div class="flex items-center gap-2">
                <!-- Count / Revenue Toggle -->
                <div
                    class="flex items-center rounded-md border border-mist-800 bg-mist-950 p-0.5 text-xs">
                    <button
                        type="button"
                        class="rounded px-2 py-1 transition"
                        :class="
                            viewMode === 'count'
                                ? 'bg-mist-800 text-lime-400'
                                : 'text-mist-400 hover:text-mist-200'
                        "
                        @click="viewMode = 'count'">
                        Volume
                    </button>
                    <button
                        type="button"
                        class="rounded px-2 py-1 transition"
                        :class="
                            viewMode === 'revenue'
                                ? 'bg-mist-800 text-lime-400'
                                : 'text-mist-400 hover:text-mist-200'
                        "
                        @click="viewMode = 'revenue'">
                        Payout
                    </button>
                </div>

                <!-- Year Selector -->
                <div class="relative w-18">
                    <select
                        v-model.number="selectedYear"
                        class="w-full appearance-none rounded-md border border-mist-800 bg-mist-950/50 px-3 py-1.5 text-xs text-mist-200 focus:border-lime-500 focus:outline-none transition-colors cursor-pointer">
                        <option
                            v-for="year in yearOptions"
                            :key="year"
                            :value="year"
                            class="bg-mist-900">
                            {{ year }}
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
        </div>

        <!-- Chart Body -->
        <div
            class="flex h-full rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md min-h-60">
            <div
                v-if="channelStats.total === 0"
                class="flex flex-1 flex-col items-center justify-center text-xs text-mist-400">
                <fa-icon
                    icon="receipt"
                    class="text-xl" />
                <p class="mt-2">No data recorded for {{ selectedYear }}</p>
            </div>

            <div
                v-else
                class="flex flex-1 items-center gap-4">
                <div
                    class="relative h-52 w-52 shrink-0"
                    @mouseleave="clearHighlight">
                    <Doughnut
                        ref="chartRef"
                        :data="chartData"
                        :options="chartOptions" />
                    <div
                        class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
                        <span class="text-base font-bold font-mono text-mist-100 leading-tight">
                            {{
                                viewMode === 'revenue'
                                    ? formatIDR(channelStats.totalRevenue)
                                    : channelStats.totalCount
                            }}
                        </span>
                        <span
                            class="text-[10px] uppercase tracking-wider text-mist-500 font-semibold">
                            {{ viewMode === 'revenue' ? 'Total Payout' : 'Total Stays' }}
                        </span>
                    </div>
                </div>

                <!-- Breakdown List -->
                <div class="flex-1 overflow-y-auto space-y-1">
                    <div
                        v-for="(ch, index) in channelStats.entries"
                        :key="ch.name"
                        class="text-xs p-2 rounded-md transition"
                        :class="{ 'bg-mist-800/60': hoveredIndex === index }">
                        <div class="flex items-center justify-between">
                            <span class="flex items-center gap-1.5">
                                <span
                                    class="h-2 w-2 rounded-full shrink-0"
                                    :style="{ backgroundColor: ch.color }" />
                                <span class="font-medium text-mist-200">{{ ch.name }}</span>
                                &bull;
                                <span class="text-xs text-mist-400">
                                    {{
                                        viewMode === 'revenue'
                                            ? formatIDR(ch.revenue)
                                            : `${ch.count} stays`
                                    }}
                                </span>
                            </span>
                            <span class="font-mono text-mist-400 font-semibold">
                                {{ ch.percentage }}%
                            </span>
                        </div>

                        <div class="mt-1.5 h-1.5 w-full rounded-full bg-mist-950 overflow-hidden">
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
