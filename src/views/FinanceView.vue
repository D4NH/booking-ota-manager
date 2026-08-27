<script setup lang="ts">
import { ref, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useBookingStore } from '@/stores/useBookingStore';
import { usePropertyStore } from '@/stores/usePropertyStore';
import type { Booking } from '@/db';
import type { PropertyId } from '@/config/properties';

interface MonthlyBreakdown {
    monthKey: string;
    label: string;
    total: number;
    byProperty: Record<string, number>;
}
interface ChannelStat {
    channel: string;
    count: number;
    revenue: number;
    percentage: number;
}

const bookingStore = useBookingStore();
const { bookings } = storeToRefs(bookingStore);
const propertyStore = usePropertyStore();
const { sortedProperties } = storeToRefs(propertyStore);

const selectedProperty = ref<PropertyId | 'all'>('all');
const selectedYear = ref<string>(new Date().getFullYear().toString());

const availableYears = computed<string[]>(() => {
    const years = bookings.value.map((b) => b.checkIn.substring(0, 4));
    const unique = Array.from(new Set(years));
    if (!unique.includes(selectedYear.value)) unique.push(selectedYear.value);
    return unique.sort((a, b) => b.localeCompare(a));
});
const financeBookings = computed<Booking[]>(() => {
    return bookings.value.filter((b) => {
        if (b.status === 'Unavailable') return false;
        if (selectedProperty.value !== 'all' && b.propertyId !== selectedProperty.value)
            return false;
        if (selectedYear.value !== 'all' && !b.checkIn.startsWith(selectedYear.value)) return false;
        return true;
    });
});
const totalRevenue = computed(() => {
    return financeBookings.value.reduce((acc, b) => acc + (b.payout || 0), 0);
});
const totalNights = computed(() => {
    return financeBookings.value.reduce((acc, b) => acc + (b.nights || 1), 0);
});
const averageDailyRate = computed(() => {
    if (totalNights.value === 0) return 0;
    return Math.round(totalRevenue.value / totalNights.value);
});
const monthlyRevenueData = computed<MonthlyBreakdown[]>(() => {
    const map: Record<string, Record<string, number>> = {};

    // Initialize all 12 months for selected year
    for (let m = 1; m <= 12; m++) {
        const monthKey = `${selectedYear.value}-${String(m).padStart(2, '0')}`;
        const propertyRecord: Record<string, number> = {};

        sortedProperties.value.forEach((p) => {
            propertyRecord[p.id] = 0;
        });

        map[monthKey] = propertyRecord;
    }

    // Populate actual revenue payouts safely
    financeBookings.value.forEach((b) => {
        const monthKey = b.checkIn.substring(0, 7);
        const currentMonthRecord = map[monthKey];
        if (currentMonthRecord) {
            currentMonthRecord[b.propertyId] =
                (currentMonthRecord[b.propertyId] || 0) + (b.payout || 0);
        }
    });

    return Object.keys(map)
        .sort((a, b) => a.localeCompare(b))
        .map((monthKey) => {
            // Ensure propertyMap is never undefined for TypeScript
            const propertyMap = map[monthKey] ?? {};
            const [yearStr, monthStr] = monthKey.split('-');

            const date = new Date(Number(yearStr), Number(monthStr) - 1, 1);
            const label = date.toLocaleDateString('en-US', { month: 'short' });
            const total = Object.values(propertyMap).reduce((acc, val) => acc + val, 0);

            return {
                monthKey,
                label,
                total,
                byProperty: propertyMap,
            };
        });
});
const maxMonthlyTotal = computed(() => {
    const max = Math.max(...monthlyRevenueData.value.map((m) => m.total));
    return max > 0 ? max : 1;
});
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
        const key = b.listing || 'Whatsapp';
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

const formatIDR = (val: number): string => {
    return `Rp ${val.toLocaleString('id-ID')}`;
};
</script>

<template>
    <div class="mx-auto max-w-7xl space-y-6">
        <!-- Header Controls -->
        <div class="flex flex-wrap items-center justify-between gap-6">
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
                        @click="selectedProperty = prop.id as PropertyId">
                        {{ prop.id }}
                    </button>
                </div>
            </div>
        </div>

        <!-- 1. KPI Cards Row -->
        <div class="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div class="rounded-xl border border-mist-800 bg-mist-900 p-5">
                <span class="text-xs font-medium text-mist-400">Total Payout Revenue</span>
                <h3 class="mt-2 text-xl font-bold font-mono text-lime-400">
                    {{ formatIDR(totalRevenue) }}
                </h3>
                <p class="mt-1 text-[11px] text-mist-500">
                    {{ financeBookings.length }} valid reservations
                </p>
            </div>

            <div class="rounded-xl border border-mist-800 bg-mist-900 p-5">
                <span class="text-xs font-medium text-mist-400">Average Daily Rate (ADR)</span>
                <h3 class="mt-2 text-xl font-bold font-mono text-mist-100">
                    {{ formatIDR(averageDailyRate) }}
                </h3>
                <p class="mt-1 text-[11px] text-mist-500">Across {{ totalNights }} total nights</p>
            </div>

            <div class="rounded-xl border border-mist-800 bg-mist-900 p-5">
                <span class="text-xs font-medium text-mist-400">Total Booked Nights</span>
                <h3 class="mt-2 text-xl font-bold font-mono text-blue-400">
                    {{ totalNights }} Nights
                </h3>
                <p class="mt-1 text-[11px] text-mist-500">
                    Avg {{ (totalNights / (financeBookings.length || 1)).toFixed(1) }} nights/stay
                </p>
            </div>
        </div>

        <!-- 2. Monthly Revenue Comparison & Breakdown Grid -->
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <!-- Monthly Revenue Comparison Chart Bars -->
            <div class="lg:col-span-2 rounded-xl border border-mist-800 bg-mist-900 p-5 space-y-4">
                <div class="flex items-center justify-between border-b border-mist-800 pb-3">
                    <div>
                        <h2 class="text-base font-bold text-mist-100">
                            Monthly Revenue Comparison
                        </h2>
                        <p class="text-xs text-mist-400">
                            Monthly payout performance for {{ selectedYear }}
                        </p>
                    </div>
                </div>

                <div class="space-y-3 pt-2">
                    <div
                        v-for="m in monthlyRevenueData"
                        :key="m.monthKey"
                        class="space-y-1.5">
                        <div class="flex items-center justify-between text-xs">
                            <span class="font-bold text-mist-300 w-10">{{ m.label }}</span>
                            <span class="font-mono text-mist-400">{{ formatIDR(m.total) }}</span>
                        </div>

                        <!-- Progress Bar Bar Stack -->
                        <div class="h-3 w-full rounded-full bg-mist-950 overflow-hidden flex">
                            <div
                                v-for="prop in sortedProperties"
                                :key="prop.id"
                                :style="{
                                    width: `${((m.byProperty[prop.id] || 0) / maxMonthlyTotal) * 100}%`,
                                    backgroundColor: prop.color || '#10b981',
                                }"
                                class="h-full transition-all duration-300"
                                :title="`${prop.name}: ${formatIDR(m.byProperty[prop.id] || 0)}`"></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 3. Channel Distribution Breakdown -->
            <div class="rounded-xl border border-mist-800 bg-mist-900 p-5 space-y-4">
                <div class="border-b border-mist-800 pb-3">
                    <h2 class="text-base font-bold text-mist-100">Channel Distribution</h2>
                    <p class="text-xs text-mist-400">Revenue share by booking channel</p>
                </div>

                <div class="space-y-4 pt-2">
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
