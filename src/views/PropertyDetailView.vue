<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useBookingSync } from '@/composables/useBookingSync';
import { useDailyOperations } from '@/composables/useDailyOperations';
import { useDateKeys } from '@/composables/useDateKeys';
import { getStatusStyle } from '@/config/status';
import { useBookingStore } from '@/stores/useBookingStore';
import { useModalStore } from '@/stores/useModalStore';
import { usePropertyStore } from '@/stores/usePropertyStore';
import type { Booking } from '@/types/booking';
import type { Property, PropertyId } from '@/types/property';
import { formatDate, getCurrentMonth } from '@/utils/date';
import { getActiveLockboxBooking, generatePinForBooking } from '@/utils/lockbox';
import { getCurrentYear, getCurrentDate } from '@/utils/date';
import { formatIDR } from '@/utils/money';

import CardTitle from '@/components/CardTitle.vue';
import PageTitle from '@/components/PageTitle.vue';
import OccupiedTag from '@/components/OccupiedTag.vue';
import PropertyLocationMap from '@/components/PropertyLocationMap.vue';

const { id } = defineProps<{
    id: PropertyId | 'all';
}>();

const router = useRouter();
const bookingStore = useBookingStore();
const { bookings } = storeToRefs(bookingStore);
const modalStore = useModalStore();
const propertyStore = usePropertyStore();
const { properties, sortedProperties } = storeToRefs(propertyStore);

const { deleteBooking } = useBookingSync();
const { currentStays, todaysArrivals, todaysDepartures, isOccupied, staySections } =
    useDailyOperations(bookings, {
        propertyId: () => id,
    });
const { currentDay, currentHour } = useDateKeys();

const hiddenStatuses = ref<Booking['status'][]>([]);
const collapsedMonths = ref<string[]>([]);

const selectedProperty = computed<Property | undefined>(() =>
    properties.value.find((p) => p.id === id)
);
const unitBookings = computed(() =>
    bookings.value
        .filter((b) => b.propertyId === id && b.status !== 'Unavailable')
        .sort((a, b) => b.checkIn.localeCompare(a.checkIn))
);
const totalRevenue = computed(() => unitBookings.value.reduce((sum, b) => sum + b.payout, 0));
const totalNights = computed(() =>
    unitBookings.value
        .filter((b) => b.status !== 'Unavailable')
        .reduce((sum, b) => sum + b.nights, 0)
);
const adr = computed(() =>
    totalNights.value > 0 ? Math.round(totalRevenue.value / totalNights.value) : 0
);
const annualOccupancy = computed(() => Math.round((totalNights.value / 365) * 100));
const currentMonth = computed(() => formatDate(getCurrentMonth(new Date()), { monthHeader: true }));
const filteredBookings = computed(() => {
    const prop = id;
    const hidden = hiddenStatuses.value;

    return bookings.value
        .filter((b) => {
            if (prop !== 'all' && b.propertyId !== prop) return false;
            if (hidden.includes(b.status)) return false;
            // Only include bookings with checkIn >= current month start
            if (b.checkIn < getCurrentMonth()) return false;

            return true;
        })
        .sort((a, b) => a.checkIn.localeCompare(b.checkIn));
});
const groupedBookings = computed(() => {
    const groups: Record<string, Booking[]> = {};

    filteredBookings.value.forEach((b) => {
        const monthKey = b.checkIn.substring(0, 7);

        if (!groups[monthKey]) groups[monthKey] = [];
        groups[monthKey].push(b);
    });

    return Object.keys(groups)
        .sort((a, b) => a.localeCompare(b))
        .map((key) => ({
            key,
            label: formatDate(key, { monthHeader: true }),
            count: groups[key]?.length,
            bookings: groups[key],
        }));
});
const lockboxInfo = computed(() =>
    getActiveLockboxBooking({
        today: currentDay.value,
        currentHour: currentHour.value,
        currentStays: currentStays.value,
        todaysArrivals: todaysArrivals.value,
        todaysDepartures: todaysDepartures.value,
    })
);

const lockboxPin = computed(() => generatePinForBooking(lockboxInfo.value.booking));
const nextUpcoming = computed(
    () =>
        unitBookings.value
            .filter((b) => b.checkIn > getCurrentDate())
            .sort((a, b) => a.checkIn.localeCompare(b.checkIn))[0]
);

const isCurrentBooking = (checkIn: string, checkOut: string, status: string): boolean =>
    currentDay.value >= checkIn && currentDay.value <= checkOut && status !== 'Waiting for payout';
const toggleMonth = (monthKey: string) => {
    const index = collapsedMonths.value.indexOf(monthKey);

    if (index > -1) {
        collapsedMonths.value.splice(index, 1);
    } else {
        collapsedMonths.value.push(monthKey);
    }
};
const handleAddBooking = (propertyId: PropertyId) => modalStore.openBookingModal({ propertyId });
const handleEditBooking = (booking: Booking) => modalStore.openBookingModal({ booking });
const handleDeleteBooking = async (booking: Booking): Promise<void> =>
    void (await deleteBooking(booking));
const handleEditProperty = () => modalStore.openPropertyModal({ property: selectedProperty.value });

const navigateToDetail = (propertyId: PropertyId | 'all') =>
    propertyId === 'all'
        ? router.push({ name: 'properties' })
        : router.push({ name: 'property-detail', params: { id: propertyId } });

watch(
    () => sortedProperties.value,
    (loadedProperties) => {
        if (loadedProperties.length > 0) {
            const exists = loadedProperties.some((p) => p.id === id);
            if (!exists) {
                console.warn(`Property ${id} does not exist. Redirecting...`);
                router.replace({ name: 'properties' });
            }
        }
    },
    { immediate: true }
);
</script>

<template>
    <div
        v-if="!selectedProperty"
        class="h-full overflow-hidden flex flex-col space-y-4 p-4">
        <div class="flex items-center gap-2 text-mist-400 text-sm font-medium">
            <fa-icon
                icon="spinner"
                class="animate-spin text-lime-400" />
            <span>Loading details...</span>
        </div>
    </div>
    <div
        v-else
        class="flex flex-col h-full overflow-hidden space-y-4 p-4">
        <PageTitle>
            <template #title>
                <span class="capitalize">{{ selectedProperty.id }}</span>
            </template>
            <template #subtitle> Portfolio health, listing settings and unit comparisons </template>
            <!-- Property Selector -->
            <div class="flex items-center gap-1 rounded-md border border-mist-800 bg-mist-900 p-1">
                <button
                    type="button"
                    class="cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
                    :class="[
                        id === 'all'
                            ? 'bg-mist-800 text-lime-400 shadow-md'
                            : 'text-mist-400 hover:text-mist-200',
                    ]"
                    @click="navigateToDetail('all')">
                    All
                </button>
                <button
                    v-for="prop in sortedProperties"
                    :key="prop.id"
                    type="button"
                    class="capitalize rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
                    :class="[
                        id === prop.id
                            ? 'bg-mist-800 text-lime-400 shadow-md'
                            : 'text-mist-400 hover:text-mist-200',
                    ]"
                    @click="navigateToDetail(prop.id)">
                    {{ prop.id }}
                </button>
            </div>
        </PageTitle>
        <!-- Photo & Property Specs -->
        <div class="grid grid-cols-1 lg:grid-cols-4 space-y-4 lg:space-y-0 lg:gap-4">
            <div
                class="col-span-3 overflow-hidden rounded-md border border-mist-800 bg-mist-900 shadow-xl grid grid-cols-1 lg:grid-cols-12">
                <div
                    class="relative lg:col-span-8 flex flex-col justify-between p-4 overflow-hidden">
                    <!-- Photo -->
                    <img
                        :src="`/images/${id}.jpg`"
                        :alt="selectedProperty.name"
                        class="mask-b-from-25% mask-b-to-95% absolute inset-0 h-full w-full object-cover pointer-events-none" />
                    <!-- Status Badge & Price -->
                    <div class="relative z-10 flex items-center justify-end">
                        <OccupiedTag :is-occupied="isOccupied" />
                    </div>
                    <!-- Title, Address & Specs -->
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
                                class="flex items-center gap-4 text-xs font-semibold text-mist-200 pt-2 border-t border-mist-700/40">
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
                <!-- Live Operations -->
                <div
                    class="lg:col-span-4 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-mist-800 bg-mist-900/95 p-4 space-y-4">
                    <div class="flex items-center justify-between border-b border-mist-800 pb-3">
                        <span class="text-xs font-bold uppercase tracking-wider text-mist-400">
                            Daily Operations
                        </span>
                    </div>
                    <!-- In-House Guest / Active Stay Spotlight -->
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
                                            {{ formatDate(b.checkIn, { shortMonth: true }) }}
                                            &rarr;
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
                    <!-- Guest Access & Wi-Fi -->
                    <div
                        class="grid grid-cols-2 divide-x divide-mist-800 border-t border-mist-800 pt-3 text-center">
                        <div class="px-1">
                            <span class="text-xs font-semibold text-mist-500 block">
                                Lockbox Code
                            </span>
                            <span class="font-mono text-sm font-bold text-mist-100">
                                {{ lockboxPin ? `${lockboxPin}` : '----' }}
                            </span>
                        </div>
                        <div class="px-1">
                            <span class="text-xs font-semibold text-mist-500 block">
                                SSID:
                                {{ selectedProperty.wifi?.ssid }}
                            </span>
                            <span class="font-mono text-sm font-bold text-mist-100">
                                {{
                                    selectedProperty.wifi?.pwd
                                        ? `${selectedProperty.wifi?.pwd}`
                                        : '----'
                                }}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <PropertyLocationMap :property="selectedProperty" />
        </div>

        <!-- Unit Performance Stat Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md space-y-1">
                <h3 class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                    Unit Revenue
                </h3>
                <p class="font-mono text-lg font-bold text-white">
                    {{ formatIDR(totalRevenue) }}
                </p>
                <p class="flex items-center gap-1 text-xs text-mist-500">
                    Total earnings in {{ getCurrentYear() }}
                </p>
            </div>

            <div class="rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md space-y-1">
                <h3 class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                    Average Daily Rate
                </h3>
                <p class="font-mono text-lg font-bold text-white">
                    {{ formatIDR(adr) }}
                </p>
                <p class="flex items-center gap-1 text-xs text-mist-500">Per booked night</p>
            </div>

            <div class="rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md space-y-1">
                <h3 class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                    Occupancy Rate
                </h3>
                <p class="font-mono text-lg font-bold text-white">{{ annualOccupancy }}%</p>
                <p class="flex items-center gap-1 text-xs text-mist-500">
                    {{ totalNights }} / 365 nights
                </p>
            </div>

            <div class="rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md space-y-1">
                <h3 class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                    Total Bookings
                </h3>
                <p class="font-mono text-lg font-bold text-white">
                    {{ unitBookings.length }}
                </p>
                <p class="flex items-center gap-1 text-xs text-mist-500">Completed & upcoming</p>
            </div>
        </div>

        <!-- Upcoming Bookings -->
        <div class="flex flex-col h-full overflow-hidden">
            <div class="flex items-center justify-between shrink-0">
                <CardTitle>
                    <template #title>Upcoming Bookings</template>
                    <template #subtitle> Starting from {{ currentMonth }} </template>
                </CardTitle>
                <button
                    type="button"
                    class="rounded-md bg-lime-500 px-4 py-2 text-xs font-semibold text-mist-950 hover:bg-lime-400"
                    @click="handleAddBooking(id as PropertyId)">
                    <fa-icon icon="plus" /> Add Booking
                </button>
            </div>
            <!-- Bookings Table -->
            <div
                v-if="groupedBookings.length === 0"
                class="flex flex-1 flex-col items-center justify-center rounded-md border border-mist-800 shadow-md text-xs text-mist-400 p-4">
                <fa-icon
                    icon="house"
                    class="text-xl" />
                <p class="mt-2">No bookings found</p>
            </div>
            <div
                v-else
                class="min-h-0 overflow-x-auto rounded-md border border-mist-800 bg-mist-900 shadow-md">
                <table class="w-full text-left text-sm text-mist-300 table-fixed">
                    <thead
                        class="sticky top-0 z-20 border-b border-mist-800 bg-mist-950 text-xs font-semibold uppercase text-mist-400">
                        <tr>
                            <th class="w-40 px-4 py-2.5">ID</th>
                            <th class="w-32 px-4 py-2.5 text-center">Channel</th>
                            <th class="px-4 py-2.5">Guest</th>
                            <th class="w-50 px-4 py-2.5 text-center">Stay Date</th>
                            <th class="w-28 px-4 py-2.5 text-center">Nights</th>
                            <th class="w-38 px-4 py-2.5 text-right">Payout</th>
                            <th class="w-40 px-4 py-2.5 text-center">Status</th>
                            <th class="w-28 px-4 py-2.5 text-right">Actions</th>
                        </tr>
                    </thead>
                    <template
                        v-for="group in groupedBookings"
                        :key="group.key">
                        <tbody class="border-t border-mist-800 bg-mist-950/40">
                            <tr>
                                <td
                                    colspan="8"
                                    class="p-0">
                                    <button
                                        type="button"
                                        class="flex w-full items-center justify-between px-4 py-2.5 font-bold text-mist-200 hover:bg-mist-800/40"
                                        @click="toggleMonth(group.key)">
                                        <span class="flex items-center gap-2">
                                            <span class="text-xs text-mist-400">
                                                {{
                                                    collapsedMonths.includes(group.key) ? '▶' : '▼'
                                                }}
                                            </span>
                                            {{ group.label }}
                                        </span>
                                        <span
                                            class="rounded-md bg-mist-800 px-2.5 py-0.5 text-xs font-normal text-mist-400">
                                            {{ group.count }}
                                        </span>
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                        <tbody
                            v-show="!collapsedMonths.includes(group.key)"
                            class="divide-y divide-mist-800/60">
                            <tr
                                v-for="b in group.bookings"
                                :key="b.id || b.bookingId"
                                :class="[
                                    'transition',
                                    isCurrentBooking(b.checkIn, b.checkOut, b.status)
                                        ? // ? 'bg-mist-800 font-medium ring-1 ring-inset ring-mist-500/40 hover:bg-mist-900/30'
                                          'text-lime-400 bg-lime-500/10 '
                                        : 'hover:bg-mist-800/30',
                                ]">
                                <td class="px-4 py-3 font-mono text-lime-400 truncate text-xs">
                                    {{ b.status === 'Unavailable' ? '-' : b.bookingId }}
                                </td>
                                <td class="px-4 py-3 text-center text-nowrap">
                                    <span
                                        class="rounded-md bg-mist-800 px-2 py-0.5 text-xs text-mist-300 text-nowrap">
                                        {{ b.listing }}
                                    </span>
                                </td>
                                <td class="px-4 py-3 font-medium text-mist-100 truncate">
                                    {{ b.guestName }}
                                </td>
                                <td class="px-4 py-3 text-center">
                                    {{ formatDate(b.checkIn, { shortMonth: true }) }}
                                    &rarr;
                                    {{ formatDate(b.checkOut, { shortMonth: true }) }}
                                </td>
                                <td class="px-4 py-3 font-mono text-center">{{ b.nights }}</td>

                                <td
                                    class="px-4 py-3 font-mono text-right text-nowrap group relative"
                                    :class="{ 'cursor-zoom-in': b.payout !== 0 }">
                                    {{ formatIDR(b.payout) }}
                                    <div
                                        v-if="b.payout !== 0"
                                        class="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 w-50 -translate-x-1/2 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100">
                                        <div
                                            class="rounded-md border border-mist-700 bg-mist-900 p-2.5 text-xs text-mist-100 shadow-xl">
                                            <div class="flex items-center justify-between">
                                                <span class="font-bold text-mist-400">
                                                    Payout 15%
                                                </span>
                                                <span class="font-semibold text-mist-200">
                                                    {{ formatIDR(b.payout * 0.15) }}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td class="px-4 py-3 text-center text-nowrap">
                                    <span :class="getStatusStyle(b.status)">
                                        {{ b.status }}
                                    </span>
                                </td>
                                <td class="px-4 py-3 text-right">
                                    <div class="flex items-center justify-end gap-2">
                                        <button
                                            type="button"
                                            class="cursor-pointer text-mist-400 hover:text-mist-100"
                                            @click="handleEditBooking(b)">
                                            <fa-icon icon="pen-to-square" />
                                        </button>
                                        <span class="text-mist-700">|</span>
                                        <button
                                            type="button"
                                            class="cursor-pointer text-rose-400 hover:text-rose-300"
                                            @click="handleDeleteBooking(b)">
                                            <fa-icon icon="trash-can" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </template>
                </table>
            </div>
        </div>
    </div>
</template>
