<script setup lang="ts">
import { ref, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { SHORT_MONTH_NAMES } from '@/config/constants';
import { useBookingStore } from '@/stores/useBookingStore';
import { usePropertyStore } from '@/stores/usePropertyStore';
import type { Booking } from '@/types/booking';
import type { ChannelStat } from '@/types/finance';
import type { PropertyId } from '@/types/property';
import { formatIDR } from '@/utils/money';

import PropertyRevenue from '@/components/charts/PropertyRevenue.vue';

const bookingStore = useBookingStore();
const { bookings } = storeToRefs(bookingStore);
const propertyStore = usePropertyStore();
const { sortedProperties } = storeToRefs(propertyStore);

const selectedProperty = ref<PropertyId | 'all'>('all');
const selectedYear = ref<string>(new Date().getFullYear().toString());

const propertyBookings = computed(() =>
    selectedProperty.value === 'all'
        ? bookings.value
        : bookings.value.filter((b) => b.propertyId === selectedProperty.value)
);
const availableYears = computed<string[]>(() => {
    const years = bookings.value.map((b) => b.checkIn.substring(0, 4));
    const unique = Array.from(new Set(years));
    if (!unique.includes(selectedYear.value)) unique.push(selectedYear.value);
    return unique.sort((a, b) => b.localeCompare(a));
});
const financeBookings = computed<Booking[]>(() =>
    propertyBookings.value.filter((b) => {
        if (b.status === 'Unavailable') return false;
        if (selectedProperty.value !== 'all' && b.propertyId !== selectedProperty.value)
            return false;
        if (selectedYear.value !== 'all' && !b.checkIn.startsWith(selectedYear.value)) return false;
        return true;
    })
);
const totalRevenue = computed(() =>
    financeBookings.value.reduce((acc, b) => acc + (b.payout || 0), 0)
);
const totalNights = computed(() =>
    financeBookings.value.reduce((acc, b) => acc + (b.nights || 1), 0)
);
const averageDailyRate = computed(() =>
    totalNights.value === 0 ? 0 : Math.round(totalRevenue.value / totalNights.value)
);
const channelStats = computed<ChannelStat[]>(() => {
    const channels: Booking['listing'][] = [
        'Airbnb',
        'Booking.com',
        'Tiket.com',
        'Trip.com',
        'Whatsapp',
    ];
    const statsMap: Record<string, { count: number; revenue: number }> = {};

    channels.forEach((ch) => {
        statsMap[ch] = { count: 0, revenue: 0 };
    });
    financeBookings.value.forEach((b) => {
        const key = b.listing;
        if (!statsMap[key]) {
            statsMap[key] = { count: 0, revenue: 0 };
        }
        statsMap[key].count++;
        statsMap[key].revenue += b.payout || 0;
    });

    const grandTotal = totalRevenue.value || 1;

    return Object.entries(statsMap)
        .map(([channel, stat]) => ({
            channel,
            count: stat.count,
            revenue: stat.revenue,
            percentage: Math.round((stat.revenue / grandTotal) * 100),
        }))
        .sort((a, b) => b.revenue - a.revenue);
});
const monthlyPropertyData = computed(() => {
    const yearPrefix = `${selectedYear.value}-`;

    const monthlyPropertyBookings = SHORT_MONTH_NAMES.map((label) => ({
        label,
        piyungan: 0,
        wonosari: 0,
        bantul: 0,
    }));

    for (const b of bookings.value) {
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

const handleTabChange = (id: string) => {
    selectedProperty.value = id as PropertyId;
};
</script>

<template>
    <div class="mx-auto max-w-7xl space-y-4">
        <!-- Header Controls -->
        <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
                <h1 class="text-xl font-bold text-mist-100">Financial Performance</h1>
                <p class="text-xs text-mist-400">
                    Revenue analytics, channel distribution & extra fees
                </p>
            </div>

            <div class="flex items-center gap-3">
                <!-- Year Selector -->
                <select
                    v-model="selectedYear"
                    class="rounded-lg border border-mist-700 bg-mist-900 px-3 py-2 text-xs text-mist-200 focus:border-lime-500 focus:outline-none">
                    <option
                        v-for="yr in availableYears"
                        :key="yr"
                        :value="yr">
                        {{ yr }}
                    </option>
                </select>

                <!-- Property Filter Switcher -->
                <div
                    class="flex items-center gap-1 rounded-lg border border-mist-800 bg-mist-900 p-1">
                    <button
                        type="button"
                        :class="[
                            'rounded-md px-3 py-1.5 text-xs font-semibold transition',
                            selectedProperty === 'all'
                                ? 'bg-mist-800 text-mist-100'
                                : 'text-mist-400 hover:text-mist-200',
                        ]"
                        @click="selectedProperty = 'all'">
                        All
                    </button>
                    <button
                        v-for="prop in sortedProperties"
                        :key="prop.id"
                        type="button"
                        :class="[
                            'rounded-md px-3 py-1.5 text-xs font-semibold transition',
                            selectedProperty === prop.id
                                ? 'bg-mist-800 text-mist-100'
                                : 'text-mist-400 hover:text-mist-200',
                        ]"
                        class="capitalize"
                        @click="handleTabChange(prop.id)">
                        {{ prop.id }}
                    </button>
                </div>
            </div>
        </div>

        <!-- KPI Cards Row -->
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div class="rounded-lg border border-mist-800 bg-mist-900 p-4">
                <p class="text-xs uppercase font-bold text-mist-400">Total Revenue</p>
                <p class="text-lg font-bold font-mono text-mist-100 mt-1">
                    {{ formatIDR(totalRevenue) }}
                </p>
                <p class="text-xs text-mist-500 mt-1">Across all properties</p>
            </div>
            <div class="rounded-lg border border-mist-800 bg-mist-900 p-4">
                <p class="text-xs uppercase font-bold text-mist-400">Average Daily Rate (ADR)</p>
                <p class="text-lg font-bold font-mono text-mist-100 mt-1">
                    {{ formatIDR(averageDailyRate) }}
                </p>
                <p class="text-xs text-mist-500 mt-1">Across {{ totalNights }} total nights</p>
            </div>
            <div class="rounded-lg border border-mist-800 bg-mist-900 p-4">
                <p class="text-xs uppercase font-bold text-mist-400">Total Booked Nights</p>
                <p class="text-lg font-bold font-mono text-mist-100 mt-1">
                    {{ totalNights }} Nights
                </p>
                <p class="text-xs text-mist-500 mt-1">
                    Avg {{ (totalNights / (financeBookings.length || 1)).toFixed(1) }} nights/stay
                </p>
            </div>
        </div>

        <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <!-- Monthly Revenue Comparison & Breakdown Grid -->
            <PropertyRevenue
                class="col-span-2"
                :data="monthlyPropertyData"
                :selected-property="selectedProperty" />

            <!-- Channel Distribution -->
            <div class="rounded-lg border border-mist-800 bg-mist-900 p-5 space-y-4">
                <div class="border-b border-mist-800 pb-4 mb-4">
                    <h2 class="text-base font-bold text-mist-100">Channel Distribution</h2>
                    <p class="text-xs text-mist-400">Revenue share by booking channel</p>
                </div>
                <div class="space-y-4">
                    <div
                        v-for="ch in channelStats"
                        :key="ch.channel"
                        class="space-y-1">
                        <div class="flex items-center justify-between text-xs">
                            <span class="font-medium text-mist-200">{{ ch.channel }}</span>
                            <span class="font-mono text-mist-400">
                                {{ ch.percentage }}% ({{ formatIDR(ch.revenue) }})
                            </span>
                        </div>
                        <div class="h-2 w-full rounded-full bg-mist-950 overflow-hidden">
                            <div
                                class="h-full bg-lime-500 transition-all duration-300"
                                :style="{ width: `${ch.percentage}%` }"></div>
                        </div>
                        <span class="text-[10px] text-mist-500">
                            {{ ch.count }} {{ ch.count === 1 ? 'booking' : 'bookings' }}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
