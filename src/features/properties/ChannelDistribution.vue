<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { CHANNEL_COLORS } from '@/config/channel';
import type { Booking } from '@/types/booking';
import { formatIDR } from '@/utils/money';
import CardTitle from '@/components/CardTitle.vue';

interface Props {
    bookings: Booking[];
}

const { bookings } = defineProps<Props>();

const hoveredIndex = ref<number | null>(null);

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

    const total = totalCount;

    const entries = Array.from(counts.entries()).map(([name, value]) => ({
        name,
        count: value,
        revenue: revenues.get(name) ?? 0,
        value,
        percentage: total > 0 ? Math.round((value / total) * 100) : 0,
        color: CHANNEL_COLORS[name] ?? CHANNEL_COLORS.Other ?? '#71717a',
    }));

    entries.sort((a, b) => b.value - a.value);
    return { entries, totalCount, totalRevenue, total };
});

// SVG Donut Math: radius = 38, circumference = 2 * PI * 38 ≈ 238.76
const circumference = 238.76;

const donutSegments = computed(() => {
    const total = channelStats.value.total || 1;
    let accumulatedOffset = 0;

    return channelStats.value.entries.map((entry, idx) => {
        const length = (entry.value / total) * circumference;
        const strokeDasharray = `${length} ${circumference - length}`;
        const strokeDashoffset = -accumulatedOffset;
        accumulatedOffset += length;

        return {
            ...entry,
            strokeDasharray,
            strokeDashoffset,
            isHovered: hoveredIndex.value === idx,
        };
    });
});

const clearHighlight = (): void => {
    hoveredIndex.value = null;
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
                <template #title>Channel Distribution</template>
                <template #subtitle>Share breakdown by volume and gross revenue</template>
            </CardTitle>

            <!-- Year Selector -->
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
                class="flex flex-1 flex-col sm:flex-row items-center gap-4">
                <div
                    class="relative h-60 w-60 shrink-0 flex items-center justify-center"
                    @mouseleave="clearHighlight">
                    <svg
                        class="w-full h-full transform -rotate-90"
                        viewBox="0 0 100 100">
                        <!-- Background track -->
                        <circle
                            cx="50"
                            cy="50"
                            r="38"
                            stroke="#1c2731"
                            stroke-width="11"
                            fill="transparent" />

                        <!-- Dynamic Segments -->
                        <circle
                            v-for="(seg, idx) in donutSegments"
                            :key="seg.name"
                            cx="50"
                            cy="50"
                            r="38"
                            :stroke="seg.color"
                            :stroke-width="seg.isHovered ? 14 : 11"
                            fill="transparent"
                            :stroke-dasharray="seg.strokeDasharray"
                            :stroke-dashoffset="seg.strokeDashoffset"
                            class="cursor-pointer transition-all duration-300"
                            :class="{
                                'opacity-100': hoveredIndex === null || seg.isHovered,
                                'opacity-40': hoveredIndex !== null && !seg.isHovered,
                            }"
                            @mouseenter="hoveredIndex = idx" />
                    </svg>

                    <!-- Center KPI -->
                    <div
                        class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
                        <span class="font-mono text-xl font-bold text-mist-100">
                            {{
                                hoveredIndex !== null && channelStats.entries[hoveredIndex]
                                    ? channelStats.entries[hoveredIndex]?.count
                                    : channelStats.totalCount
                            }}
                        </span>
                        <span
                            class="text-[10px] font-semibold uppercase tracking-wider text-mist-400 mt-0.5">
                            {{
                                hoveredIndex !== null && channelStats.entries[hoveredIndex]
                                    ? channelStats.entries[hoveredIndex]?.name
                                    : 'Total Bookings'
                            }}
                        </span>
                    </div>
                </div>

                <!-- Breakdown List -->
                <div class="flex-1 w-full overflow-y-auto space-y-1">
                    <div
                        v-for="(ch, index) in channelStats.entries"
                        :key="ch.name"
                        class="text-xs px-2.5 py-2 rounded-md transition cursor-pointer"
                        :class="
                            hoveredIndex === index
                                ? 'bg-mist-800/80 shadow-xs'
                                : 'hover:bg-mist-800/40'
                        "
                        @mouseenter="hoveredIndex = index"
                        @mouseleave="clearHighlight">
                        <div class="flex items-center justify-between">
                            <span class="flex items-center gap-2">
                                <span
                                    class="h-2 w-2 rounded-full shrink-0"
                                    :style="{ backgroundColor: ch.color }" />
                                <span class="font-medium text-mist-200">
                                    {{ ch.name }}
                                </span>
                                <span class="text-xs text-mist-500">&bull;</span>
                                <span class="text-[11px] text-mist-400 font-mono">
                                    {{ ch.count }} stays
                                </span>
                            </span>
                            <div class="flex items-center gap-2 font-mono">
                                <span class="text-mist-400 text-[11px]">
                                    {{ formatIDR(ch.revenue) }}
                                </span>
                                <span
                                    class="font-semibold text-mist-200 min-w-8 text-right text-[11px]">
                                    {{ ch.percentage }}%
                                </span>
                            </div>
                        </div>

                        <div class="mt-1.5">
                            <div class="h-1.5 w-full rounded-full bg-mist-950/60 overflow-hidden">
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
    </div>
</template>
