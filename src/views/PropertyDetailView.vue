<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useMonthlyMetrics } from '@/composables/useMonthlyMetrics';
import { usePropertyDetails } from '@/composables/usePropertyDetails';
import { getStatusStyle } from '@/config/status';
import { useBookingStore } from '@/stores/useBookingStore';
import { useModalStore } from '@/stores/useModalStore';
import type { Booking } from '@/types/booking';
import type { PropertyId } from '@/types/property';
import { formatDate, getCurrentWeekNumber } from '@/utils/date';
import { formatIDR } from '@/utils/money';

import CardTitle from '@/components/CardTitle.vue';
import PageTitle from '@/components/PageTitle.vue';
import PropertySelector from '@/components/PropertySelector.vue';
import OccupiedTag from '@/components/OccupiedTag.vue';
import UpcomingBookings from '@/features/bookings/UpcomingBookings.vue';
import CurrentWeekView from '@/features/bookings/CurrentWeekView.vue';
import PropertyLocationMap from '@/features/properties/PropertyLocationMap.vue';
import MonthlyRevenuePacing from '@/features/properties/MonthlyRevenuePacing.vue';
import ForwardBookingHorizon from '@/features/properties/ForwardBookingHorizon.vue';

interface Props {
    id: PropertyId;
}

const { id } = defineProps<Props>();

const router = useRouter();
const bookingStore = useBookingStore();
const { bookings } = storeToRefs(bookingStore);
const modalStore = useModalStore();

const {
    totalPayout,
    revenueGrowthPercent,
    occupancyPercentage,
    totalCapacityNights,
    occupiedNights,
} = useMonthlyMetrics(() => bookings.value, {
    propertyId: () => id,
});

const {
    selectedProperty,
    unitBookings,
    totalYearRevenue,
    adr,
    nextUpcoming,
    isOccupied,
    staySections,
} = usePropertyDetails(() => id);

const customPin = ref<string>('');

watch(
    () => id,
    (newId) => {
        loadPin(newId);
    },
    { immediate: true }
);

function loadPin(propertyId: PropertyId): void {
    customPin.value = localStorage.getItem(`lockbox_pin_${propertyId}`) || '';
}
function handlePinInput(): void {
    if (customPin.value.trim()) {
        localStorage.setItem(`lockbox_pin_${id}`, customPin.value.trim());
    } else {
        localStorage.removeItem(`lockbox_pin_${id}`);
    }
}
function handleAddBooking(propertyId: PropertyId): void {
    modalStore.openBookingModal({ propertyId });
}
function handleEditBooking(booking: Booking): void {
    modalStore.openBookingModal({ booking });
}
function handleEditProperty(): void {
    modalStore.openPropertyModal({ property: selectedProperty.value });
}
function handleNavigate(target: PropertyId | 'all'): void {
    if (target === 'all') router.push({ name: 'properties' });
    else router.push({ name: 'property-detail', params: { id: target } });
}
</script>

<template>
    <div
        v-if="!selectedProperty"
        class="flex h-full flex-col items-center justify-center space-y-4 p-4">
        <div class="flex items-center gap-2 text-sm font-medium text-mist-400">
            <fa-icon
                icon="spinner"
                class="animate-spin text-lime-400" />
            <span>Loading details...</span>
        </div>
    </div>

    <div
        v-else
        class="h-full space-y-4 overflow-y-auto p-4">
        <PageTitle>
            <template #title>
                <span class="capitalize">{{ selectedProperty.id }}</span>
            </template>
            <template #subtitle>Portfolio health, listing settings and unit operations</template>

            <PropertySelector
                :model-value="id"
                @change="handleNavigate" />
        </PageTitle>

        <!-- Metric Stats -->
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div class="space-y-1 rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md">
                <h3 class="text-xs font-semibold tracking-wider text-mist-400 uppercase">
                    Annual Revenue
                </h3>
                <p class="font-mono text-lg font-semibold text-mist-100">
                    {{ formatIDR(totalYearRevenue) }}
                </p>
                <p class="flex items-center gap-1 text-xs">
                    <span
                        v-if="totalPayout !== 0"
                        class="font-medium"
                        :class="
                            totalPayout > 0
                                ? 'text-emerald-400'
                                : totalPayout < 0
                                  ? 'text-rose-400'
                                  : 'text-mist-400'
                        ">
                        {{ totalPayout >= 0 ? '+' : '-' }}{{ formatIDR(totalPayout) }}
                    </span>
                    <span
                        v-else
                        class="font-medium text-mist-500">
                        No payout
                    </span>
                    <span class="text-mist-500">this month</span>
                </p>
            </div>
            <div class="space-y-1 rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md">
                <h3 class="text-xs font-semibold tracking-wider text-mist-400 uppercase">
                    Monthly Revenue
                </h3>
                <p class="font-mono text-lg font-semibold text-mist-100">
                    {{ formatIDR(totalPayout) }}
                </p>
                <p class="flex items-center gap-1 text-xs">
                    <span
                        v-if="revenueGrowthPercent !== 0"
                        class="font-medium"
                        :class="
                            revenueGrowthPercent > 0
                                ? 'text-emerald-400'
                                : revenueGrowthPercent < 0
                                  ? 'text-rose-400'
                                  : 'text-mist-400'
                        ">
                        <fa-icon
                            :icon="
                                revenueGrowthPercent >= 0 ? 'arrow-trend-up' : 'arrow-trend-down'
                            " />
                        {{ Math.abs(revenueGrowthPercent) }}%
                    </span>
                    <span
                        v-else
                        class="font-medium text-mist-500">
                        No data for last month
                    </span>
                    <span
                        v-if="revenueGrowthPercent !== 0"
                        class="text-mist-500">
                        vs last month
                    </span>
                </p>
            </div>
            <div class="space-y-1 rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md">
                <h3 class="text-xs font-semibold tracking-wider text-mist-400 uppercase">
                    Average Daily Rate
                </h3>
                <p class="font-mono text-lg font-semibold text-mist-100">{{ formatIDR(adr) }}</p>
                <p class="text-xs text-mist-500">Per booked night</p>
            </div>

            <div class="space-y-1 rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md">
                <h3 class="text-xs font-semibold tracking-wider text-mist-400 uppercase">
                    Monthly Occupancy
                </h3>
                <p class="font-mono text-lg font-semibold text-lime-400">
                    {{ occupancyPercentage }}%
                </p>
                <p class="text-xs text-mist-500">
                    {{ occupiedNights }} / {{ totalCapacityNights }} nights booked
                </p>
            </div>
        </div>

        <div class="grid grid-cols-1 space-y-4 lg:grid-cols-4 lg:gap-4 lg:space-y-0">
            <!-- Live Operations Sidebar -->
            <div
                class="flex flex-col space-y-4 rounded-md border border-mist-800 bg-mist-900 p-4 shadow-xl">
                <div class="flex items-center justify-between border-b border-mist-800 pb-3">
                    <span class="text-xs font-semibold tracking-wider text-mist-400 uppercase">
                        Daily Operations
                    </span>
                </div>

                <div class="flex flex-1 flex-col justify-center">
                    <div
                        v-if="staySections.length"
                        class="space-y-4">
                        <div
                            v-for="section in staySections"
                            :key="section.label">
                            <span
                                class="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold"
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
                                class="-mx-2 -mt-0.5 -mb-1 cursor-pointer rounded-md px-2 pt-0.5 pb-1 transition hover:bg-mist-800/40"
                                @click="handleEditBooking(b)">
                                <div class="flex justify-between space-y-1">
                                    <div class="flex flex-col items-start space-y-1">
                                        <span class="truncate text-sm font-semibold text-mist-100">
                                            {{ b.guestName }}
                                        </span>
                                        <span class="text-xs text-mist-400">
                                            {{
                                                formatDate(b.checkIn, {
                                                    shortWeekday: true,
                                                    shortMonth: true,
                                                })
                                            }}
                                            &rarr;
                                            {{
                                                formatDate(b.checkOut, {
                                                    shortWeekday: true,
                                                    shortMonth: true,
                                                })
                                            }}
                                            &bull; {{ b.nights }} night(s)
                                        </span>
                                        <span class="text-xs font-medium text-mist-500">
                                            via {{ b.listing }}
                                        </span>
                                    </div>
                                    <div class="flex flex-col items-end space-y-1">
                                        <span
                                            class="font-mono text-xs font-semibold text-nowrap text-mist-100">
                                            {{ formatIDR(b.payout) }}
                                        </span>
                                        <span
                                            class="mt-0.5 text-xs"
                                            :class="getStatusStyle(b.status)">
                                            {{ b.status }}
                                        </span>
                                    </div>
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
                            class="mt-1 text-[11px]">
                            Next: {{ formatDate(nextUpcoming.checkIn) }} -
                            {{ nextUpcoming.guestName }}
                        </p>
                        <p
                            v-else
                            class="mt-1 text-[11px]">
                            Unit is vacant and ready for check-in
                        </p>
                    </div>
                </div>

                <!-- Editable Lockbox PIN & Wi-Fi Access -->
                <div
                    class="grid grid-cols-2 divide-x divide-mist-800 border-t border-mist-800 pt-3 text-center">
                    <div class="flex flex-col items-center px-1">
                        <label
                            :for="`lockbox-${id}`"
                            class="block cursor-pointer text-xs font-semibold tracking-wider text-mist-500 uppercase">
                            <fa-icon
                                icon="key"
                                class="text-xs" />
                            Lockbox
                        </label>
                        <input
                            :id="`lockbox-${id}`"
                            v-model="customPin"
                            type="text"
                            inputmode="numeric"
                            placeholder="----"
                            class="mt-0.5 w-24 rounded border border-transparent bg-transparent py-0.5 text-center font-mono text-sm font-semibold text-mist-100 transition placeholder:text-mist-600 hover:border-mist-700 hover:bg-mist-800/60 focus:border-lime-400 focus:bg-mist-800 focus:ring-1 focus:ring-lime-400 focus:outline-none"
                            @input="handlePinInput" />
                    </div>
                    <div class="px-1">
                        <span
                            class="block text-xs font-semibold tracking-wider text-mist-500 uppercase">
                            <fa-icon
                                icon="wifi"
                                class="text-xs" />
                            {{ selectedProperty.wifi?.ssid }}
                        </span>
                        <span class="font-mono text-sm font-semibold text-mist-100">
                            {{ selectedProperty.wifi?.pwd || '----' }}
                        </span>
                    </div>
                </div>
            </div>

            <!-- Photo & Property Specs -->
            <div
                class="col-span-2 overflow-hidden rounded-md border border-mist-800 bg-mist-900 shadow-xl">
                <div class="relative flex h-full flex-col justify-between overflow-hidden p-4">
                    <img
                        :src="`/images/${id}.jpg`"
                        :alt="selectedProperty.name"
                        class="pointer-events-none absolute inset-0 h-full w-full mask-b-from-15% mask-b-to-95% object-cover" />

                    <div class="relative z-10 flex items-center">
                        <OccupiedTag :is-occupied="isOccupied" />
                    </div>

                    <div class="relative z-10 mt-12 space-y-2">
                        <div class="border-b border-mist-600/50 pb-3">
                            <div class="flex gap-2">
                                <h3 class="truncate text-lg font-semibold text-mist-100">
                                    {{ selectedProperty.name }}
                                </h3>
                                <button
                                    type="button"
                                    class="cursor-pointer hover:text-mist-300"
                                    @click="handleEditProperty">
                                    <fa-icon icon="pen-to-square" />
                                </button>
                            </div>
                            <p class="mt-1 max-w-md truncate text-xs leading-relaxed text-mist-300">
                                <fa-icon
                                    icon="location-dot"
                                    class="shrink-0 text-[10px] text-mist-400" />
                                {{ selectedProperty.address }}
                            </p>
                        </div>

                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-4 text-xs font-medium text-mist-200">
                                <span>
                                    <fa-icon
                                        icon="bed"
                                        class="mr-1 text-mist-400" />
                                    {{ selectedProperty.bedrooms }} Bedrooms
                                </span>
                                <span>&bull;</span>
                                <span>
                                    <fa-icon
                                        icon="bath"
                                        class="mr-1 text-mist-400" />
                                    {{ selectedProperty.bathrooms }} Bathrooms
                                </span>
                                <span>&bull;</span>
                                <span>
                                    <fa-icon
                                        icon="ruler-combined"
                                        class="mr-1 text-mist-400" />
                                    {{ selectedProperty.plotSize }} m²
                                </span>
                            </div>
                            <div>
                                <span class="font-mono text-sm font-semibold text-mist-100">
                                    {{ formatIDR(selectedProperty.price) }}
                                </span>
                                <span class="text-[11px] text-mist-500"> / night</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <PropertyLocationMap :property="selectedProperty" />
        </div>

        <!-- Weekly Overview -->
        <div class="grid grid-cols-1">
            <div class="flex items-center justify-between">
                <CardTitle>
                    <template #title>Weekly Overview</template>
                    <template #subtitle>Starting from week {{ getCurrentWeekNumber() }}</template>
                </CardTitle>
                <button
                    type="button"
                    class="cursor-pointer rounded-md bg-lime-500 px-4 py-2 text-xs font-semibold text-mist-950 transition hover:bg-lime-400"
                    @click="handleAddBooking(id)">
                    <fa-icon icon="plus" /> Add Booking
                </button>
            </div>

            <CurrentWeekView
                :selected-property="id"
                :show-header="false"
                class="shrink-0" />
        </div>

        <div class="grid grid-cols-2 grid-rows-2 gap-4">
            <!-- Property Analytics -->
            <MonthlyRevenuePacing
                class="col-start-1"
                :current-revenue="totalPayout"
                :property="selectedProperty" />

            <ForwardBookingHorizon
                class="row-start-2"
                :bookings="unitBookings"
                :property="selectedProperty" />

            <div class="col-start-2 row-span-2 h-170 overflow-y-scroll">
                <UpcomingBookings
                    :limit="15"
                    :bookings="unitBookings"
                    :show-month-headers="true"
                    :show-property="false"
                    @edit-booking="handleEditBooking" />
            </div>
        </div>
    </div>
</template>
