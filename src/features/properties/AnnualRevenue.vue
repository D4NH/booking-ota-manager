<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { PROPERTY_LIST } from '@/config/properties';
import { useBookingStore } from '@/stores/useBookingStore';
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

import CardTitle from '@/components/CardTitle.vue';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface Props {
    selectedProperty?: PropertyId | 'all';
}

const { selectedProperty = 'all' } = defineProps<Props>();

const bookingStore = useBookingStore();
const { bookings } = storeToRefs(bookingStore);

const MONTH_LABELS = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
] as const;

const hoveredIndex = ref<number | null>(null);

const yearOptions = computed<number[]>(() => {
    const years = new Set<number>();

    for (const b of bookings.value) {
        if (b.checkIn && b.checkIn.length >= 4) {
            const year = Number(b.checkIn.slice(0, 4));
            if (!Number.isNaN(year)) years.add(year);
        }
    }

    if (years.size === 0) {
        years.add(new Date().getFullYear());
    }

    return Array.from(years).sort((a, b) => b - a); // Descending (newest first)
});

const selectedYear = ref<number>(yearOptions.value[0] ?? new Date().getFullYear());

const monthlyData = computed<MonthlyPropertyRevenue[]>(() => {
    const yearStr = String(selectedYear.value);

    const months: MonthlyPropertyRevenue[] = MONTH_LABELS.map((label) => ({
        label,
        piyungan: 0,
        wonosari: 0,
        bantul: 0,
        nusadua: 0,
    }));

    for (const b of bookings.value) {
        if (b.status === 'Unavailable' || b.status === 'No show') continue;
        if (!b.checkIn || b.checkIn.slice(0, 4) !== yearStr) continue;

        const monthIdx = Number(b.checkIn.slice(5, 7)) - 1;
        if (monthIdx >= 0 && monthIdx < 12) {
            const propId = b.propertyId;
            if (propId in months[monthIdx]!) {
                months[monthIdx]![propId] += b.payout || 0;
            }
        }
    }

    return months;
});
const activeConfigs = computed(() => {
    return PROPERTY_LIST.filter((config) => {
        if (selectedProperty !== 'all') return config.id === selectedProperty;

        const totalEarned = monthlyData.value.reduce((sum, row) => {
            const val = row[config.id];
            return sum + (typeof val === 'number' ? val : 0);
        }, 0);

        return totalEarned > 0;
    });
});
const totalAnnualRevenue = computed(() => {
    return monthlyData.value.reduce((sum, row) => {
        return (
            sum +
            activeConfigs.value.reduce((subtotal, config) => {
                const val = row[config.id];
                return subtotal + (typeof val === 'number' ? val : 0);
            }, 0)
        );
    }, 0);
});
const displayHeaderMonth = computed(() => {
    if (hoveredIndex.value !== null) {
        const item = monthlyData.value[hoveredIndex.value];
        if (item?.label) return `${item.label} ${selectedYear.value}`;
    }
    return `Total ${selectedYear.value}`;
});
const displayHeaderValue = computed(() => {
    if (hoveredIndex.value !== null && monthlyData.value.length > 0) {
        const item = monthlyData.value[hoveredIndex.value];
        if (!item) return 0;

        return activeConfigs.value.reduce((sum, config) => {
            const val = item[config.id];
            return sum + (typeof val === 'number' ? val : 0);
        }, 0);
    }

    return totalAnnualRevenue.value;
});
const chartData = computed<ChartData<'bar'>>(() => {
    const datasets = activeConfigs.value.map((config) => ({
        label: `${config.id.charAt(0).toUpperCase()}${config.id.slice(1)}`,
        data: monthlyData.value.map((d) => d[config.id] || 0),
        backgroundColor: config.color,
        borderRadius: 4,
        maxBarThickness: 24,
    }));

    return {
        labels: monthlyData.value.map((d) => d.label),
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
            ticks: { color: '#71717a', font: { size: 12, weight: 'bold' } },
        },
        y: {
            stacked: true,
            grid: { color: '#1e2632' },
            ticks: {
                color: '#71717a',
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

watch(yearOptions, (available) => {
    if (!available.includes(selectedYear.value) && available.length > 0) {
        selectedYear.value = available[0]!;
    }
});
</script>

<template>
    <div class="flex flex-col">
        <div class="flex justify-between items-center">
            <CardTitle>
                <template #title>Annual Revenue</template>
                <template #subtitle>Monthly gross earnings across properties</template>
            </CardTitle>
            <div class="relative w-18">
                <select
                    v-model.number="selectedYear"
                    class="w-full appearance-none rounded-md border border-mist-800 bg-mist-950/50 px-3 py-2 text-xs text-mist-400 focus:border-lime-500 focus:outline-none transition-colors cursor-pointer">
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
        <div
            class="h-full flex flex-col rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md"
            @mouseleave="hoveredIndex = null">
            <div class="flex justify-between items-center">
                <div class="flex flex-col space-y-1">
                    <span class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                        {{ displayHeaderMonth }}
                    </span>
                    <div class="font-mono text-lg font-semibold text-mist-100">
                        {{ formatIDR(displayHeaderValue) }}
                    </div>
                </div>
                <!-- Legend -->
                <div class="flex items-center gap-4">
                    <div
                        class="hidden sm:flex items-center gap-4 text-xs font-medium text-mist-300">
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
            </div>
            <div class="mt-4 h-full w-full min-h-55">
                <Bar
                    :data="chartData"
                    :options="chartOptions" />
            </div>
        </div>
    </div>
</template>
