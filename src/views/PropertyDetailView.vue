<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useBookingSync } from '@/composables/useBookingSync';
import { useGroupedBookings } from '@/composables/useGroupedBookings';
import { useMonthlyMetrics } from '@/composables/useMonthlyMetrics';
import { usePropertyDetails } from '@/composables/usePropertyDetails';
import { bookingStatuses } from '@/config/status';
import { useBookingStore } from '@/stores/useBookingStore';
import { useModalStore } from '@/stores/useModalStore';
import type { Booking } from '@/types/booking';
import type { PropertyId } from '@/types/property';
import { formatDate, getCurrentMonth, getCurrentYear, getCurrentWeekNumber } from '@/utils/date';
import { formatIDR } from '@/utils/money';

import CardTitle from '@/components/CardTitle.vue';
import PageTitle from '@/components/PageTitle.vue';
import OccupiedTag from '@/components/OccupiedTag.vue';
import PropertyLocationMap from '@/components/PropertyLocationMap.vue';
import PropertySelector from '@/components/PropertySelector.vue';
import BookingsTable from '@/components/BookingsTable.vue';
import CurrentWeekView from '@/components/CurrentWeekView.vue';

import MonthlyRevenuePacing from '@/components/MonthlyRevenuePacing.vue';
import ForwardBookingHorizon from '@/components/ForwardBookingHorizon.vue';

interface Props {
    id: PropertyId;
}

const { id } = defineProps<Props>();

const router = useRouter();
const bookingStore = useBookingStore();
const { bookings } = storeToRefs(bookingStore);
const modalStore = useModalStore();
const { deleteBooking } = useBookingSync();
const { totalPayout, revenueGrowthPercent } = useMonthlyMetrics(() => bookings.value, {
    propertyId: () => id,
});
const {
    selectedProperty,
    unitBookings,
    totalRevenue,
    adr,
    totalNights,
    annualOccupancy,
    nextUpcoming,
    lockboxPin,
    isOccupied,
    staySections,
    todayTurnover,
    currentDay,
} = usePropertyDetails(() => id);

const hiddenStatuses = ref<Booking['status'][]>(['Completed']);
const toggleFilters = ref<boolean>(false);

const upcomingUnitBookings = computed<Booking[]>(() => {
    const currentMonth = getCurrentMonth();
    const hidden = hiddenStatuses.value;

    return unitBookings.value.filter((b) => {
        if (hidden.includes(b.status)) return false;
        return b.checkIn >= currentMonth;
    });
});

const { groupedBookings, collapsedMonths, currentMonthKey } = useGroupedBookings(
    upcomingUnitBookings,
    {
        autoCollapsePast: false,
    }
);

const currentMonthLabel = computed(() => formatDate(currentMonthKey.value, { monthHeader: true }));

const toggleStatusVisibility = (status: Booking['status']): void => {
    const idx = hiddenStatuses.value.indexOf(status);
    if (idx > -1) {
        hiddenStatuses.value.splice(idx, 1);
    } else {
        hiddenStatuses.value.push(status);
    }
};
const handleAddBooking = (propertyId: PropertyId) => modalStore.openBookingModal({ propertyId });
const handleEditBooking = (booking: Booking) => modalStore.openBookingModal({ booking });
const handleDeleteBooking = async (booking: Booking): Promise<void> =>
    void (await deleteBooking(booking));
const handleEditProperty = () => modalStore.openPropertyModal({ property: selectedProperty.value });
const handleNavigate = (target: PropertyId | 'all'): void => {
    if (target === 'all') router.push({ name: 'properties' });
    else router.push({ name: 'property-detail', params: { id: target } });
};
</script>

<template>
    <div
        v-if="!selectedProperty"
        class="h-full flex flex-col justify-center items-center space-y-4 p-4">
        <div class="flex items-center gap-2 text-mist-400 text-sm font-medium">
            <fa-icon
                icon="spinner"
                class="animate-spin text-lime-400" />
            <span>Loading details...</span>
        </div>
    </div>

    <div
        v-else
        class="h-full overflow-y-auto space-y-4 p-4">
        <PageTitle>
            <template #title>
                <span class="capitalize">{{ selectedProperty.id }}</span>
            </template>
            <template #subtitle>Portfolio health, listing settings and unit operations</template>

            <PropertySelector
                :model-value="id"
                @change="handleNavigate" />
        </PageTitle>

        <!-- Photo & Property Specs -->
        <div class="grid grid-cols-1 lg:grid-cols-4 space-y-4 lg:space-y-0 lg:gap-4">
            <div
                class="col-span-3 overflow-hidden rounded-md border border-mist-800 bg-mist-900 shadow-xl grid grid-cols-1 lg:grid-cols-12">
                <div
                    class="relative lg:col-span-8 flex flex-col justify-between p-4 overflow-hidden">
                    <img
                        :src="`/images/${id}.jpg`"
                        :alt="selectedProperty.name"
                        class="mask-b-from-25% mask-b-to-95% absolute inset-0 h-full w-full object-cover pointer-events-none" />

                    <div class="relative z-10 flex items-center justify-end">
                        <OccupiedTag :is-occupied="isOccupied" />
                    </div>

                    <div class="relative z-10 space-y-2 mt-12">
                        <div>
                            <div class="flex gap-2">
                                <h1 class="text-xl font-bold text-mist-100">
                                    {{ selectedProperty.name }}
                                </h1>
                                <button
                                    type="button"
                                    class="cursor-pointer hover:text-mist-300"
                                    @click="handleEditProperty">
                                    <fa-icon icon="pen-to-square" />
                                </button>
                            </div>
                            <p class="text-xs text-mist-300 mt-1 max-w-md truncate">
                                {{ selectedProperty.address }}
                            </p>
                        </div>

                        <div class="flex items-center justify-between">
                            <div
                                class="flex items-center gap-4 text-xs font-semibold text-mist-200 pt-2 border-t border-mist-800/40">
                                <span>
                                    <fa-icon
                                        icon="bed"
                                        class="text-mist-400 mr-1" />
                                    {{ selectedProperty.bedrooms }} Bedrooms
                                </span>
                                <span>&bull;</span>
                                <span>
                                    <fa-icon
                                        icon="bath"
                                        class="text-mist-400 mr-1" />
                                    {{ selectedProperty.bathrooms }} Bathrooms
                                </span>
                                <span>&bull;</span>
                                <span>
                                    <fa-icon
                                        icon="ruler-combined"
                                        class="text-mist-400 mr-1" />
                                    {{ selectedProperty.plotSize }} m²
                                </span>
                            </div>

                            <div>
                                <span class="text-sm font-bold font-mono text-mist-100">
                                    {{ formatIDR(selectedProperty.price) }}
                                </span>
                                <span class="text-[11px] text-mist-500"> / night</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Live Operations Sidebar -->
                <div
                    class="lg:col-span-4 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-mist-800 bg-mist-900/95 p-4 space-y-4">
                    <div class="flex items-center justify-between border-b border-mist-800 pb-3">
                        <span class="text-xs font-bold uppercase tracking-wider text-mist-400">
                            Daily Operations
                        </span>
                    </div>

                    <!-- Same-Day Turnover Alert Badge -->
                    <div
                        v-if="todayTurnover"
                        class="rounded border border-amber-500/30 bg-amber-500/10 p-2 text-xs space-y-0.5">
                        <div
                            class="flex items-center gap-1.5 font-bold text-amber-400 text-[11px] uppercase">
                            <fa-icon icon="bolt" />
                            <span>Same-Day Turnover Today</span>
                        </div>
                        <p class="text-mist-300 text-[11px]">
                            {{ todayTurnover.departing }} (Out 11 AM) &rarr;
                            {{ todayTurnover.arriving }} (In 2 PM)
                        </p>
                    </div>

                    <div class="flex-1 flex flex-col justify-center">
                        <div
                            v-if="staySections.length"
                            class="space-y-4">
                            <div
                                v-for="section in staySections"
                                :key="section.label">
                                <span
                                    class="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold"
                                    :class="[
                                        section.label === 'Arriving Today'
                                            ? 'text-lime-400'
                                            : 'text-amber-400',
                                    ]">
                                    {{ section.label }}
                                </span>

                                <div
                                    v-for="b in section.items"
                                    :key="b.id || b.bookingId"
                                    class="rounded-md hover:bg-mist-800/40 -mx-2 -mt-0.5 -mb-1 px-2 pt-0.5 pb-1 transition cursor-pointer"
                                    @click="handleEditBooking(b)">
                                    <div class="flex flex-col space-y-0.5">
                                        <div class="flex items-center justify-between">
                                            <span class="text-sm font-bold text-mist-100 truncate">
                                                {{ b.guestName }}
                                            </span>
                                            <span
                                                class="text-xs font-bold font-mono text-lime-400 whitespace-nowrap">
                                                {{ formatIDR(b.payout) }}
                                            </span>
                                        </div>
                                        <span class="text-xs text-mist-400">
                                            {{ formatDate(b.checkIn, { shortMonth: true }) }} &rarr;
                                            {{ formatDate(b.checkOut, { shortMonth: true }) }}
                                            &bull; {{ b.nights }} night(s)
                                        </span>
                                        <span class="text-[10px] text-mist-500 font-medium">
                                            via {{ b.listing }}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div
                            v-else
                            class="text-center text-xs text-mist-500">
                            <fa-icon
                                icon="house-circle-check"
                                class="text-xl text-mist-700" />
                            <span class="ml-2 font-medium text-mist-400">
                                No active in-house guest
                            </span>
                            <p
                                v-if="nextUpcoming"
                                class="text-[11px] mt-1">
                                Next: {{ formatDate(nextUpcoming.checkIn) }} -
                                {{ nextUpcoming.guestName }}
                            </p>
                            <p
                                v-else
                                class="text-[11px] mt-1">
                                Unit is vacant and ready for check-in
                            </p>
                        </div>
                    </div>

                    <!-- Lockbox & Wi-Fi Access -->
                    <div
                        class="grid grid-cols-2 divide-x divide-mist-800 border-t border-mist-800 pt-3 text-center">
                        <div class="px-1">
                            <span class="text-xs font-semibold text-mist-500 block">
                                Lockbox Code
                            </span>
                            <span class="font-mono text-sm font-bold text-mist-100">
                                {{ lockboxPin || '----' }}
                            </span>
                        </div>
                        <div class="px-1">
                            <span class="text-xs font-semibold text-mist-500 block">
                                SSID: {{ selectedProperty.wifi?.ssid }}
                            </span>
                            <span class="font-mono text-sm font-bold text-mist-100">
                                {{ selectedProperty.wifi?.pwd || '----' }}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <PropertyLocationMap :property="selectedProperty" />
        </div>

        <!-- Metric Stats -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md space-y-1">
                <h3 class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                    Annual Revenue
                </h3>
                <p class="font-mono text-lg font-bold text-white">
                    {{ formatIDR(totalRevenue) }}
                </p>
                <p class="text-xs text-mist-500">Total earnings in {{ getCurrentYear() }}</p>
            </div>

            <div class="rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md space-y-1">
                <h3 class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                    Monthly Revenue
                </h3>
                <p class="font-mono text-lg font-bold text-mist-100">
                    {{ formatIDR(totalPayout) }}
                </p>
                <p class="flex items-center gap-1 text-xs">
                    <span
                        class="font-medium"
                        :class="revenueGrowthPercent >= 0 ? 'text-lime-400' : 'text-rose-400'">
                        {{ revenueGrowthPercent >= 0 ? '+' : '' }}{{ revenueGrowthPercent }}%
                    </span>
                    <span class="text-mist-500">vs last month</span>
                </p>
            </div>

            <div class="rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md space-y-1">
                <h3 class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                    Average Daily Rate
                </h3>
                <p class="font-mono text-lg font-bold text-white">{{ formatIDR(adr) }}</p>
                <p class="text-xs text-mist-500">Per booked night</p>
            </div>

            <div class="rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md space-y-1">
                <h3 class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                    Annual Occupancy
                </h3>
                <p class="font-mono text-lg font-bold text-lime-400">{{ annualOccupancy }}%</p>
                <p class="text-xs text-mist-500">{{ totalNights }} / 365 nights booked</p>
            </div>
        </div>

        <!-- Weekly Overview -->
        <div class="grid grid-cols-1">
            <CardTitle>
                <template #title>Weekly Overview</template>
                <template #subtitle>Starting from week {{ getCurrentWeekNumber() }}</template>
            </CardTitle>
            <CurrentWeekView
                :selected-property="id"
                :show-header="false"
                class="shrink-0" />
        </div>

        <!-- Property Analytics -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <MonthlyRevenuePacing
                :current-revenue="totalPayout"
                :property="selectedProperty" />

            <ForwardBookingHorizon
                :bookings="unitBookings"
                :property="selectedProperty" />
        </div>

        <!-- Bookings Table -->
        <div class="grid grid-cols-1">
            <div class="flex items-center justify-between">
                <CardTitle>
                    <template #title>Upcoming Bookings</template>
                    <template #subtitle>Starting from {{ currentMonthLabel }}</template>
                </CardTitle>
                <div class="flex gap-3">
                    <!-- Status Filters -->
                    <button
                        type="button"
                        class="cursor-pointer rounded-md border border-mist-800 bg-mist-800 px-3 py-1.5 text-xs font-semibold text-mist-200 hover:bg-mist-700 transition"
                        title="Filter by Status"
                        @click="toggleFilters = !toggleFilters">
                        <fa-icon
                            class="text-xs"
                            icon="filter" />
                    </button>
                    <div
                        v-if="toggleFilters"
                        class="flex flex-wrap items-center gap-1.5 ml-1">
                        <button
                            v-for="status in bookingStatuses"
                            :key="status"
                            type="button"
                            :class="[
                                'cursor-pointer rounded-md px-2.5 py-1 text-xs border transition',
                                hiddenStatuses.includes(status)
                                    ? 'border-rose-500/40 bg-rose-500/10 text-rose-400 line-through'
                                    : 'border-mist-800 bg-mist-800 text-mist-300 hover:border-mist-600',
                            ]"
                            @click="toggleStatusVisibility(status)">
                            {{ status }}
                        </button>
                    </div>
                    <button
                        type="button"
                        class="cursor-pointer rounded-md bg-lime-500 px-4 py-2 text-xs font-semibold text-mist-950 hover:bg-lime-400 transition"
                        @click="handleAddBooking(id)">
                        <fa-icon icon="plus" /> Add Booking
                    </button>
                </div>
            </div>

            <div
                v-if="groupedBookings.length === 0"
                class="flex flex-col items-center justify-center rounded-md border border-mist-800 shadow-md text-xs text-mist-400 p-6">
                <fa-icon
                    icon="house"
                    class="text-xl" />
                <p class="mt-2">No upcoming reservations found</p>
            </div>

            <BookingsTable
                v-else
                v-model:collapsed-months="collapsedMonths"
                :groups="groupedBookings"
                :current-month-key="currentMonthKey"
                :current-date-key="currentDay"
                @edit="handleEditBooking"
                @delete="handleDeleteBooking" />
        </div>
    </div>
</template>
