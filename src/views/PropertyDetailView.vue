<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useBookingSync } from '@/composables/useBookingSync';
import { useGroupedBookings } from '@/composables/useGroupedBookings';
import { usePropertyDetails } from '@/composables/usePropertyDetails';
import { useModalStore } from '@/stores/useModalStore';
import type { Booking } from '@/types/booking';
import type { PropertyId } from '@/types/property';
import { formatDate, getCurrentMonth, getCurrentYear } from '@/utils/date';
import { formatIDR } from '@/utils/money';

import CardTitle from '@/components/CardTitle.vue';
import PageTitle from '@/components/PageTitle.vue';
import OccupiedTag from '@/components/OccupiedTag.vue';
import PropertyLocationMap from '@/components/PropertyLocationMap.vue';
import PropertySelector from '@/components/PropertySelector.vue';
import BookingsTable from '@/components/BookingsTable.vue';

interface Props {
    id: PropertyId;
}

const { id } = defineProps<Props>();

const router = useRouter();
const modalStore = useModalStore();
const { deleteBooking } = useBookingSync();

const {
    selectedProperty,
    unitBookings,
    totalRevenue,
    totalNights,
    adr,
    annualOccupancy,
    nextUpcoming,
    lockboxPin,
    isOccupied,
    staySections,
    currentDay,
} = usePropertyDetails(() => id);

const upcomingUnitBookings = computed(() => {
    const currentMonth = getCurrentMonth(); // "2026-09"
    return unitBookings.value.filter((b) => b.checkIn >= currentMonth);
});

const { groupedBookings, collapsedMonths, currentMonthKey } = useGroupedBookings(
    upcomingUnitBookings,
    {
        autoCollapsePast: false,
    }
);

const currentMonthLabel = computed(() => formatDate(currentMonthKey.value, { monthHeader: true }));

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
            <template #subtitle> Portfolio health, listing settings and unit comparisons </template>
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

                <!-- Live Daily Operations -->
                <div
                    class="lg:col-span-4 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-mist-800 bg-mist-900/95 p-4 space-y-4">
                    <div class="flex items-center justify-between border-b border-mist-800 pb-3">
                        <span class="text-xs font-bold uppercase tracking-wider text-mist-400">
                            Daily Operations
                        </span>
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
                                    class="mb-2">
                                    <div class="flex flex-col space-y-0.5">
                                        <div class="flex items-center justify-between">
                                            <div>
                                                <span
                                                    class="text-sm font-bold text-mist-100 truncate">
                                                    {{ b.guestName }}
                                                </span>
                                                <button
                                                    type="button"
                                                    class="ml-1 cursor-pointer text-sm text-mist-400 hover:text-mist-100 transition"
                                                    @click="handleEditBooking(b)">
                                                    <fa-icon
                                                        icon="pen-to-square"
                                                        class="text-xs" />
                                                </button>
                                            </div>
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

        <!-- Metric Stat Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md space-y-1">
                <h3 class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                    Unit Revenue
                </h3>
                <p class="font-mono text-lg font-bold text-white">{{ formatIDR(totalRevenue) }}</p>
                <p class="text-xs text-mist-500">Total earnings in {{ getCurrentYear() }}</p>
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
                    Occupancy Rate
                </h3>
                <p class="font-mono text-lg font-bold text-white">{{ annualOccupancy }}%</p>
                <p class="text-xs text-mist-500">{{ totalNights }} / 365 nights</p>
            </div>

            <div class="rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md space-y-1">
                <h3 class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                    Total Bookings
                </h3>
                <p class="font-mono text-lg font-bold text-white">{{ unitBookings.length }}</p>
                <p class="text-xs text-mist-500">Completed & upcoming</p>
            </div>
        </div>

        <!-- Bookings Table -->
        <div class="grid grid-cols-1">
            <div class="flex items-center justify-between">
                <CardTitle>
                    <template #title>Upcoming Bookings</template>
                    <template #subtitle>Starting from {{ currentMonthLabel }}</template>
                </CardTitle>
                <button
                    type="button"
                    class="cursor-pointer rounded-md bg-lime-500 px-4 py-2 text-xs font-semibold text-mist-950 hover:bg-lime-400"
                    @click="handleAddBooking(id)">
                    <fa-icon icon="plus" /> Add Booking
                </button>
            </div>
            <div
                v-if="groupedBookings.length === 0"
                class="flex flex-col items-center justify-center rounded-md border border-mist-800 shadow-md text-xs text-mist-400 p-6">
                <fa-icon
                    icon="receipt"
                    class="text-xl" />
                <p class="mt-2">No upcoming bookings found</p>
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
