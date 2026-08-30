<script setup lang="ts">
import { ref, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useRoute, useRouter } from 'vue-router';
import { useBookingStore } from '@/stores/useBookingStore';
import { useDateKeys } from '@/composables/useDateKeys';
import { PROPERTY_LIST } from '@/config/properties';
import type { Booking } from '@/types/booking';
import { formatIDR } from '@/utils/money';

const route = useRoute();
const router = useRouter();
const bookingStore = useBookingStore();
const { bookings } = storeToRefs(bookingStore);
const { todayStr, currentMonthKey, lastMonthKey, currentHour } = useDateKeys();

const bookingToEdit = ref<Booking | null>(null);
const isBookingModalOpen = ref<boolean>(false);

const activeTab = computed(() =>
    (route.params.id as string) ? route.name === 'property-detail' && route.params.id : 'all'
);
const propertyBookings = computed(() =>
    activeTab.value === 'all'
        ? bookings.value
        : bookings.value.filter((b) => b.propertyId === activeTab.value)
);
const propertyName = computed(() =>
    activeTab.value === 'all'
        ? 'All Properties'
        : PROPERTY_LIST.find((prop) => prop.id === activeTab.value)?.name
);
const currentMonthRevenue = computed<number>(() =>
    propertyBookings.value
        .filter((b) => b.checkIn.startsWith(currentMonthKey.value))
        .reduce((acc, b) => acc + (b.payout || 0), 0)
);
const lastMonthRevenue = computed<number>(() =>
    propertyBookings.value
        .filter((b) => b.checkIn.startsWith(lastMonthKey.value))
        .reduce((acc, b) => acc + (b.payout || 0), 0)
);
const revenueGrowthPercent = computed<number>(() => {
    return lastMonthRevenue.value === 0
        ? 0
        : Math.round(
              ((currentMonthRevenue.value - lastMonthRevenue.value) / lastMonthRevenue.value) * 100
          );
});
const upcomingCheckIns = computed(() =>
    propertyBookings.value.filter((b) => b.checkIn === todayStr.value)
);
const upcomingCheckOuts = computed(() =>
    propertyBookings.value.filter((b) => b.checkOut === todayStr.value)
);
const monthlyStats = computed(() => {
    const targetMonth = currentMonthKey.value;
    const bookings = propertyBookings.value;

    let monthlyPayout = 0;
    let totalNightsBooked = 0;
    let totalBookings = 0;

    for (const b of bookings) {
        if (b && b.status !== 'Unavailable' && b.checkIn.startsWith(targetMonth)) {
            monthlyPayout += b.payout || 0;
            totalNightsBooked += b.nights || 0;
            totalBookings++;
        }
    }

    const [yearStr = '2026', monthStr = '1'] = targetMonth.split('-');
    const daysInMonth = new Date(Number(yearStr), Number(monthStr), 0).getDate();

    const activePropertyCount = activeTab.value === 'all' ? PROPERTY_LIST.length : 1;

    const totalCapacityNights = daysInMonth * activePropertyCount;

    const occupancyRate =
        totalCapacityNights > 0
            ? Math.min(100, Math.round((totalNightsBooked / totalCapacityNights) * 100))
            : 0;

    return {
        monthlyPayout,
        totalNightsBooked,
        occupancyRate,
        totalBookings,
        capacityNights: totalCapacityNights,
        percentage: occupancyRate,
    };
});
const todaysArrivals = computed(() => {
    if (currentHour.value >= 15) return [];

    const today = todayStr.value;
    return propertyBookings.value.filter((b) => b.checkIn === today && b.status !== 'Unavailable');
});
const currentStays = computed(() => {
    const today = todayStr.value;
    const hour = currentHour.value;

    return propertyBookings.value.filter((b) => {
        if (b.status === 'Unavailable' || b.status === 'Waiting for payout') return false;

        // Mid-stay guests
        if (b.checkIn < today && b.checkOut > today) return true;

        // Arrivals show here after 15:00
        if (b.checkIn === today) return hour >= 15;

        // Currently Staying until 12:00
        if (b.checkOut === today) return hour < 12;

        return false;
    });
});
const todaysDepartures = computed(() => {
    if (currentHour.value >= 13) return [];

    const today = todayStr.value;
    return propertyBookings.value.filter((b) => b.checkOut === today && b.status !== 'Unavailable');
});

const handleTabChange = (tabId: string) => {
    if (tabId === 'all') {
        router.push({ name: 'properties' });
    } else {
        router.push({ name: 'property-detail', params: { id: tabId } });
    }
};
const openEditModal = (booking: Booking): void => {
    bookingToEdit.value = booking;
    isBookingModalOpen.value = true;
};
</script>

<template>
    <div class="mx-auto max-w-7xl space-y-6">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <h1 class="text-xl font-bold text-mist-100">
                    {{ propertyName }}
                </h1>
                <p class="text-xs text-mist-400">
                    Manage all properties or inspect single performance metrics.
                </p>
            </div>
            <!-- Switcher Tabs -->
            <div class="flex items-center gap-1 rounded-lg border border-mist-800 bg-mist-900 p-1">
                <button
                    type="button"
                    class="cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
                    :class="[
                        activeTab === 'all'
                            ? 'bg-mist-800 text-lime-400 shadow-sm'
                            : 'text-mist-400 hover:text-mist-200',
                    ]"
                    @click="handleTabChange('all')">
                    All
                </button>
                <button
                    v-for="prop in PROPERTY_LIST"
                    :key="prop.id"
                    type="button"
                    class="capitalize rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
                    :class="[
                        activeTab === prop.id
                            ? 'bg-mist-800 text-lime-400 shadow-sm'
                            : 'text-mist-400 hover:text-mist-200',
                    ]"
                    @click="handleTabChange(prop.id)">
                    {{ prop.id }}
                </button>
            </div>
        </div>

        <!-- Monthly Summary Cards -->
        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div class="rounded-lg border border-mist-800 bg-mist-900 p-4">
                <p class="text-xs uppercase font-bold text-mist-400">Monthly Revenue</p>
                <p class="mt-1 font-mono text-lg font-bold text-white">
                    {{ formatIDR(monthlyStats.monthlyPayout) }}
                </p>
                <div class="flex items-center gap-1 text-xs mt-1">
                    <span
                        class="font-medium"
                        :class="revenueGrowthPercent >= 0 ? 'text-lime-400' : 'text-rose-400'">
                        {{ revenueGrowthPercent >= 0 ? '+' : '' }}{{ revenueGrowthPercent }}%
                    </span>
                    <span class="text-mist-500">vs last month</span>
                </div>
            </div>
            <div class="rounded-lg border border-mist-800 bg-mist-900 p-4">
                <p class="text-xs uppercase font-bold text-mist-400">Occupancy Rate</p>
                <p class="text-lg font-bold text-mist-100 mt-1">
                    {{ monthlyStats.occupancyRate }}%
                </p>
                <div class="w-full bg-mist-800 h-1.5 rounded-full overflow-hidden my-2">
                    <div
                        class="bg-lime-500 h-full transition-all duration-300"
                        :style="{ width: `${monthlyStats.percentage}%` }"></div>
                </div>
                <p class="text-xs text-mist-500 mt-1">
                    {{ monthlyStats.totalNightsBooked }} / {{ monthlyStats.capacityNights }} nights
                    booked
                </p>
            </div>
            <div class="rounded-lg border border-mist-800 bg-mist-900 p-4">
                <p class="text-[10px] uppercase font-bold text-mist-400">Total bookings</p>
                <p class="mt-1 text-xl font-bold text-mist-100">
                    {{ monthlyStats.totalBookings }}
                </p>
                <p class="mt-1 text-[10px] text-mist-500">Active bookings</p>
            </div>
            <div class="rounded-lg border border-mist-800 bg-mist-900 p-4">
                <p class="text-xs uppercase font-bold text-mist-400">Today's Turnover</p>
                <div class="text-lg font-bold text-mist-200 mt-1">
                    <span class="text-lime-400 mr-3">↓ {{ upcomingCheckIns.length }} In</span>
                    <span class="text-amber-400">↑ {{ upcomingCheckOuts.length }} Out</span>
                </div>
                <p class="text-xs text-mist-500 mt-1">Scheduled for today</p>
            </div>
        </div>

        <!-- Main Operational View -->
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div class="space-y-4 rounded-lg border border-mist-800 bg-mist-900 p-4">
                <div class="flex items-center justify-between border-b border-mist-800 pb-4 mb-4">
                    <h2 class="text-xs font-bold uppercase text-mist-200">Arriving Today</h2>
                    <span
                        class="rounded bg-mist-500/20 px-2 py-0.5 text-[10px] font-bold text-mist-400">
                        {{ todaysArrivals.length }}
                    </span>
                </div>
                <div
                    v-if="todaysArrivals.length === 0"
                    class="py-12 text-center text-xs text-mist-500">
                    No arrivals scheduled for today.
                </div>
                <div v-else>
                    <div
                        v-for="b in todaysArrivals"
                        :key="b.id"
                        class="rounded-lg border border-mist-800 bg-mist-950 p-3 space-y-2">
                        <div class="flex items-center">
                            <span class="font-semibold text-sm text-mist-200">
                                {{ b.guestName }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between text-[12px] text-mist-400">
                            <span>{{ b.checkIn }} &rarr; {{ b.checkOut }} </span>
                            <span>{{ b.nights }} night(s)</span>
                        </div>
                        <div class="flex items-center justify-between text-[12px] text-mist-400">
                            <span>{{ b.listing }}</span>
                            <span class="font-mono text-lime-400">
                                {{ formatIDR(b.payout) }}
                            </span>
                        </div>
                        <div
                            class="flex items-center justify-end border-t border-mist-800 mt-3 pt-2">
                            <button
                                type="button"
                                class="cursor-pointer text-xs font-semibold text-mist-400 hover:text-lime-500"
                                @click="openEditModal(b)">
                                <fa-icon icon="pen-to-square" /> Edit
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="space-y-4 rounded-lg border border-mist-800 bg-mist-900 p-4">
                <div class="flex items-center justify-between border-b border-mist-800 pb-4 mb-4">
                    <div>
                        <h2 class="text-xs font-bold uppercase text-mist-300">Currently Staying</h2>
                    </div>
                    <span
                        class="rounded bg-mist-500/20 px-2 py-0.5 text-[10px] font-bold text-mist-400">
                        {{ currentStays.length }}
                    </span>
                </div>
                <div
                    v-if="currentStays.length === 0"
                    class="py-12 text-center text-xs text-mist-500">
                    No guests currently in-house.
                </div>
                <div v-else>
                    <div
                        v-for="b in currentStays"
                        :key="b.id"
                        class="rounded-lg border border-mist-800 bg-mist-950 p-4 space-y-2">
                        <div class="flex items-center">
                            <span class="font-semibold text-sm text-mist-200">
                                {{ b.guestName }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between text-[12px] text-mist-400">
                            <span>{{ b.checkIn }} &rarr; {{ b.checkOut }} </span>
                            <span>{{ b.nights }} night(s)</span>
                        </div>
                        <div class="flex items-center justify-between text-[12px] text-mist-400">
                            <span>{{ b.listing }}</span>
                            <span class="font-mono text-lime-400">
                                {{ formatIDR(b.payout) }}
                            </span>
                        </div>
                        <div
                            class="flex items-center justify-end border-t border-mist-800 mt-3 pt-2">
                            <button
                                type="button"
                                class="cursor-pointer text-xs font-semibold text-mist-400 hover:text-lime-500"
                                @click="openEditModal(b)">
                                <fa-icon icon="pen-to-square" /> Edit
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="space-y-4 rounded-lg border border-mist-800 bg-mist-900 p-4">
                <div class="flex items-center justify-between border-b border-mist-800 pb-4 mb-4">
                    <h2 class="text-xs font-bold uppercase text-mist-200">Today's Departures</h2>
                    <span
                        class="rounded bg-mist-500/20 px-2 py-0.5 text-[10px] font-bold text-mist-400">
                        {{ todaysDepartures.length }}
                    </span>
                </div>
                <div
                    v-if="todaysDepartures.length === 0"
                    class="py-12 text-center text-xs text-mist-500">
                    No departures scheduled for today.
                </div>
                <div v-else>
                    <div
                        v-for="b in todaysDepartures"
                        :key="b.id"
                        class="rounded-lg border border-mist-800 bg-mist-950 p-4 space-y-2">
                        <div class="flex items-center">
                            <span class="font-semibold text-sm text-mist-200">
                                {{ b.guestName }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between text-[12px] text-mist-400">
                            <span>{{ b.checkIn }} &rarr; {{ b.checkOut }} </span>
                            <span>{{ b.nights }} night(s)</span>
                        </div>
                        <div class="flex items-center justify-between text-[12px] text-mist-400">
                            <span>{{ b.listing }}</span>
                            <span class="font-mono text-lime-400">
                                {{ formatIDR(b.payout) }}
                            </span>
                        </div>
                        <div
                            class="flex items-center justify-end border-t border-mist-800 mt-3 pt-2">
                            <button
                                type="button"
                                class="cursor-pointer text-xs font-semibold text-mist-400 hover:text-lime-500"
                                @click="openEditModal(b)">
                                <fa-icon icon="pen-to-square" /> Edit
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div v-if="route.meta.isOverview">
            <div>table here</div>
        </div>

        <RouterView />
    </div>
</template>
