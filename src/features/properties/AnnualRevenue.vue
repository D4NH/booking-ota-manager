<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { PROPERTY_LIST } from '@/config/properties';
import { useBookingStore } from '@/stores/useBookingStore';
import type { PropertyId, MonthlyPropertyRevenue } from '@/types/property';
import { formatIDR } from '@/utils/money';
import CardTitle from '@/components/CardTitle.vue';

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

    return Array.from(years).sort((a, b) => b - a);
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

// Chart calculations: maximum monthly stacked value for Y-axis bounds
const maxMonthlyTotal = computed<number>(() => {
    let highest = 0;
    for (const row of monthlyData.value) {
        const monthSum = activeConfigs.value.reduce((sum, config) => {
            const val = row[config.id];
            return sum + (typeof val === 'number' ? val : 0);
        }, 0);
        if (monthSum > highest) highest = monthSum;
    }
    if (highest <= 0) return 10_000_000;
    // Round ceiling up to nearest 5jt
    return Math.ceil(highest / 5_000_000) * 5_000_000;
});

const yAxisTicks = computed(() => {
    const max = maxMonthlyTotal.value;
    const step = max / 4;
    return [
        { value: max, label: `${(max / 1_000_000).toFixed(0)}jt` },
        { value: step * 3, label: `${((step * 3) / 1_000_000).toFixed(0)}jt` },
        { value: step * 2, label: `${((step * 2) / 1_000_000).toFixed(0)}jt` },
        { value: step, label: `${(step / 1_000_000).toFixed(0)}jt` },
        { value: 0, label: '0' },
    ];
});

// Calculate stacked segment percentage height relative to max ceiling
const getSegmentHeightPct = (value: number): number => {
    if (maxMonthlyTotal.value <= 0 || !value) return 0;
    return (value / maxMonthlyTotal.value) * 100;
};

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
            <!-- Summary & Legend -->
            <div class="flex justify-between items-center">
                <div class="flex flex-col space-y-1">
                    <span class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                        {{ displayHeaderMonth }}
                    </span>
                    <div class="font-mono text-lg font-semibold text-mist-100">
                        {{ formatIDR(displayHeaderValue) }}
                    </div>
                </div>
                <div class="flex items-center gap-4">
                    <div
                        class="hidden sm:flex items-center gap-4 text-xs font-medium text-mist-200">
                        <div
                            v-for="item in activeConfigs"
                            :key="item.id"
                            class="flex items-center">
                            <div class="flex items-center gap-1.5">
                                <span
                                    class="h-2 w-2 shrink-0 rounded-full"
                                    :style="{ backgroundColor: item.color }" />
                                <span class="capitalize">{{ item.id }}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="relative mt-6 mb-4 h-full w-full flex items-end">
                <!-- Background Horizontal Gridlines -->
                <div
                    class="absolute inset-0 flex flex-col justify-between pointer-events-none pb-6 pr-2">
                    <div
                        v-for="tick in yAxisTicks"
                        :key="tick.value"
                        class="w-full flex items-center text-xs font-mono text-mist-500">
                        <span class="w-10 text-right pr-2 select-none">{{ tick.label }}</span>
                        <div class="flex-1 border-b border-mist-800/40" />
                    </div>
                </div>

                <!-- Bars Columns -->
                <div class="relative w-full h-full flex items-end justify-between pl-12 pr-2 pb-6">
                    <div
                        v-for="(row, idx) in monthlyData"
                        :key="row.label"
                        class="flex-1 flex flex-col items-center h-full justify-end group relative cursor-pointer px-1"
                        @mouseenter="hoveredIndex = idx">
                        <!-- Custom Tooltip -->
                        <div
                            v-if="hoveredIndex === idx"
                            class="absolute -top-20 z-30 pointer-events-none bg-mist-950 border border-mist-750 shadow-2xl rounded-md p-2 text-xs font-mono whitespace-nowrap space-y-1">
                            <div
                                class="font-bold text-mist-100 text-[11px] pb-1 border-b border-mist-800">
                                {{ row.label }} {{ selectedYear }}
                            </div>
                            <div
                                v-for="config in activeConfigs"
                                :key="config.id"
                                class="flex items-center justify-between gap-3 text-xs">
                                <span class="flex items-center gap-1.5 text-mist-400 capitalize">
                                    <span
                                        class="w-2 h-2 rounded-xs"
                                        :style="{ backgroundColor: config.color }" />
                                    {{ config.id }}:
                                </span>
                                <span class="text-mist-100 font-semibold">
                                    {{ formatIDR(Number(row[config.id]) || 0) }}
                                </span>
                            </div>
                        </div>

                        <!-- Stacked Bar Column -->
                        <div
                            class="w-full max-w-6 flex flex-col-reverse items-center h-full justify-start">
                            <div
                                v-for="config in activeConfigs"
                                :key="config.id"
                                class="w-full transition-all duration-300 first:rounded-b-sm last:rounded-t-sm"
                                :style="{
                                    height: `${getSegmentHeightPct(Number(row[config.id]) || 0)}%`,
                                    backgroundColor:
                                        hoveredIndex === idx ? '#9AE600' : config.color,
                                }"
                                :class="
                                    hoveredIndex === idx
                                        ? 'bg-lime-400'
                                        : 'text-mist-400 group-hover:text-mist-200'
                                " />
                        </div>

                        <!-- X-Axis Month Label -->
                        <span
                            class="absolute -bottom-7 text-xs transition-colors"
                            :class="
                                hoveredIndex === idx
                                    ? 'font-semibold text-lime-400'
                                    : 'text-mist-400 group-hover:text-mist-200'
                            ">
                            {{ row.label }}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
