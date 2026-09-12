<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useBookingSync } from '@/composables/useBookingSync';
import { useDailyOperations } from '@/composables/useDailyOperations';
import { useDateKeys } from '@/composables/useDateKeys';
import { useBookingStore } from '@/stores/useBookingStore';
import { useModalStore } from '@/stores/useModalStore';
import { usePropertyStore } from '@/stores/usePropertyStore';
import type { Booking } from '@/types/booking';
import type { Property, PropertyId } from '@/types/property';
import { formatDate, getCurrentMonth } from '@/utils/date';
import { formatIDR } from '@/utils/money';

import OccupiedTag from '@/components/OccupiedTag.vue';
// import PropertyLocationMap from '@/components/PropertyLocationMap.vue';

const props = defineProps<{
    id: PropertyId | 'all';
}>();

const router = useRouter();
const bookingStore = useBookingStore();
const { bookings } = storeToRefs(bookingStore);
const modalStore = useModalStore();
const propertyStore = usePropertyStore();
const { sortedProperties } = storeToRefs(propertyStore);

const { deleteBooking } = useBookingSync();
const { currentDay } = useDateKeys();

const hiddenStatuses = ref<Booking['status'][]>([]);
const collapsedMonths = ref<string[]>([]);

const copiedField = ref<string | null>(null);
const copyText = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    copiedField.value = field;
    setTimeout(() => (copiedField.value = null), 2000);
};

const selectedProperty = computed<Property | undefined>(() => {
    return sortedProperties.value.find((p) => p.id === props.id);
});

const unitBookings = computed(() => {
    return bookings.value
        .filter((b) => b.propertyId === props.id && b.status !== 'Unavailable')
        .sort((a, b) => b.checkIn.localeCompare(a.checkIn));
});

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
    const prop = props.id;
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

const { isOccupied, todaysTurnover, staySections } = useDailyOperations(bookings, {
    propertyId: () => props.id,
});

const isCurrentBooking = (checkIn: string, checkOut: string, status: string): boolean =>
    currentDay.value >= checkIn &&
    currentDay.value <= checkOut &&
    status !== 'Waiting for payout' &&
    status !== 'Completed';

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
const handleDeleteBooking = async (booking: Booking): Promise<void> => {
    await deleteBooking(booking);
};
const handleEditProperty = () => {
    modalStore.openPropertyModal({ property: selectedProperty.value });
};
const navigateToDetail = (propertyId: PropertyId | 'all') =>
    propertyId === 'all'
        ? router.push({ name: 'properties' })
        : router.push({ name: 'property-detail', params: { id: propertyId } });

watch(
    () => sortedProperties.value,
    (loadedProperties) => {
        if (loadedProperties.length > 0) {
            const exists = loadedProperties.some((p) => p.id === props.id);
            if (!exists) {
                console.warn(`Property ${props.id} does not exist. Redirecting...`);
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
        class="flex h-full items-center justify-center">
        <div class="flex items-center gap-2 text-mist-400 text-sm font-medium">
            <fa-icon
                icon="spinner"
                class="animate-spin text-lime-400" />
            <span>Loading villa details...</span>
        </div>
    </div>

    <div
        v-else
        class="flex flex-col h-full min-h-0 gap-4 overflow-y-auto pb-4">
        <!-- Header Bar -->
        <div class="flex shrink-0 items-center justify-between my-4">
            <div>
                <h1 class="text-xl font-bold text-mist-100">Property Management</h1>
                <p class="text-xs text-mist-400">
                    Portfolio health, listing settings, and unit comparisons
                </p>
            </div>
            <!-- Property Filter Tabs -->
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
        </div>
        <!-- Essential Access Info Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div
                class="col-span-3 overflow-hidden rounded-md border border-mist-800 bg-mist-900 shadow-xl grid grid-cols-1 lg:grid-cols-12 min-h-80">
                <!-- Photo & Property Specs -->
                <div
                    class="relative lg:col-span-7 flex flex-col justify-between p-4 overflow-hidden min-h-65">
                    <!-- Cover Photo -->
                    <img
                        :src="`/images/${id}.jpg`"
                        alt="alttag"
                        class="absolute inset-0 h-full w-full object-cover pointer-events-none" />
                    <div
                        class="absolute inset-0 bg-linear-to-t from-mist-950 via-mist-950/60 to-mist-950/20 pointer-events-none" />

                    <!-- Status Badge & Price -->
                    <div class="relative z-10 flex items-center justify-between">
                        <OccupiedTag :is-occupied="isOccupied" />

                        <span
                            class="rounded-md bg-mist-950/80 px-3 py-1 font-mono text-sm font-bold text-mist-100 backdrop-blur-md border border-mist-800">
                            {{ formatIDR(selectedProperty.price) }}
                            <span class="text-xs font-normal text-mist-400">/ night</span>
                        </span>
                    </div>

                    <!-- Title, Address & Specs -->
                    <div class="relative z-10 space-y-2 mt-12">
                        <div>
                            <h1 class="text-2xl font-black text-mist-100 leading-tight">
                                {{ selectedProperty.name }}
                            </h1>
                            <p class="text-xs text-mist-300 mt-0.5 max-w-md truncate">
                                {{ selectedProperty.address }}
                            </p>
                        </div>

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
                    </div>
                </div>

                <!-- Live Operations -->
                <div
                    class="lg:col-span-5 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-mist-800 bg-mist-900/95 p-4 space-y-4">
                    <!-- Desk Header -->
                    <div class="flex items-center justify-between border-b border-mist-800 pb-3">
                        <span class="text-xs font-bold uppercase tracking-wider text-mist-400">
                            Daily Operations
                        </span>
                        <button
                            type="button"
                            class="flex items-center gap-1.5 rounded-md border border-mist-700 bg-mist-800 px-2.5 py-1 text-xs font-semibold text-mist-200 hover:bg-mist-700 transition"
                            @click="handleEditProperty">
                            <fa-icon
                                icon="pen-to-square"
                                class="text-[10px]" />
                            <span>Edit Listing</span>
                        </button>
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
                                    <div class="flex flex-col justify-between space-y-0.5">
                                        <div class="flex items-center justify-between">
                                            <span class="text-sm font-bold text-mist-100 truncate">
                                                {{ b.guestName }}
                                            </span>
                                            <span
                                                class="text-xs font-bold font-mono text-mist-100 whitespace-nowrap">
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
                        <div v-else>
                            <span class="mb-1.5 flex items-center gap-1.5 text-[11px]">
                                No active or upcoming stays
                            </span>
                        </div>
                    </div>

                    <!-- Compact Turnover Strip -->
                    <div
                        class="rounded-md bg-mist-950/80 p-2.5 border border-mist-800/60 flex items-center justify-between text-xs">
                        <span class="text-mist-400 font-medium">Today's Turnover:</span>

                        <div class="flex items-center gap-3 font-mono">
                            <span
                                :class="
                                    todaysTurnover.in ? 'text-lime-400 font-bold' : 'text-mist-500'
                                ">
                                &darr; {{ todaysTurnover.in }}
                            </span>
                            <span class="text-mist-700">|</span>
                            <span
                                :class="
                                    todaysTurnover.out
                                        ? 'text-amber-400 font-bold'
                                        : 'text-mist-500'
                                ">
                                &uarr; {{ todaysTurnover.out }}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Host Essentials -->
            <div
                class="rounded-md border border-mist-800 bg-mist-900 p-5 shadow-md flex flex-col justify-between space-y-4">
                <div>
                    <h3 class="text-sm font-bold text-mist-100 uppercase tracking-wider">
                        Guest Access & Essentials
                    </h3>
                    <p class="text-xs text-mist-400 mt-0.5">
                        Quick reference for guest communication
                    </p>
                </div>

                <div class="space-y-3 text-xs">
                    <!-- Smart Lock / PIN -->
                    <div
                        class="flex items-center justify-between rounded-lg border border-mist-800 bg-mist-950/60 p-2.5">
                        <div>
                            <span class="text-[10px] uppercase font-semibold text-mist-500 block">
                                Smart Lock PIN
                            </span>
                            <span class="font-mono text-sm font-bold text-mist-100">8492#</span>
                        </div>
                        <button
                            type="button"
                            class="text-mist-400 hover:text-lime-400 transition text-xs font-semibold"
                            @click="copyText('8492#', 'pin')">
                            {{ copiedField === 'pin' ? 'Copied!' : 'Copy' }}
                        </button>
                    </div>

                    <!-- Wi-Fi Network & Password -->
                    <div
                        class="flex items-center justify-between rounded-lg border border-mist-800 bg-mist-950/60 p-2.5">
                        <div>
                            <span class="text-[10px] uppercase font-semibold text-mist-500 block">
                                Wi-Fi: MaiHouse_Fast
                            </span>
                            <span class="font-mono text-sm font-bold text-mist-100">
                                jogjaistimewa
                            </span>
                        </div>
                        <button
                            type="button"
                            class="text-mist-400 hover:text-lime-400 transition text-xs font-semibold"
                            @click="copyText('jogjaistimewa', 'wifi')">
                            {{ copiedField === 'wifi' ? 'Copied!' : 'Copy' }}
                        </button>
                    </div>

                    <!-- Google Maps Pin Link -->
                    <a
                        href="https://maps.google.com"
                        target="_blank"
                        class="flex items-center justify-between rounded-lg border border-mist-800 bg-mist-950/60 p-2.5 text-mist-300 hover:text-lime-400 transition">
                        <span class="font-medium">Google Maps Location</span>
                        <fa-icon
                            icon="arrow-up-right-from-square"
                            class="text-xs" />
                    </a>
                </div>

                <div class="pt-2 border-t border-mist-800/80 text-[11px] text-mist-500 italic">
                    Cleaner: Ibu Sari (+62 812-3456-7890)
                </div>
            </div>

            <!-- <PropertyLocationMap :property="property" /> -->
        </div>

        <!-- Unit Performance Stat Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md">
                <span class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                    Unit Revenue
                </span>
                <div class="mt-1 font-mono text-lg font-bold text-white">
                    {{ formatIDR(totalRevenue) }}
                </div>
                <span class="text-xs text-mist-500 mt-0.5 block">2026 Earnings</span>
            </div>

            <div class="rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md">
                <span class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                    Average Daily Rate
                </span>
                <div class="mt-1 font-mono text-lg font-bold text-white">
                    {{ formatIDR(adr) }}
                </div>
                <span class="text-xs text-mist-500 mt-0.5 block">Per booked night</span>
            </div>

            <div class="rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md">
                <span class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                    Occupancy Rate
                </span>
                <div class="mt-1 font-mono text-lg font-bold text-white">
                    {{ annualOccupancy }}%
                </div>
                <span class="text-xs text-mist-500 mt-0.5 block">
                    {{ totalNights }} / 365 nights
                </span>
            </div>

            <div class="rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md">
                <span class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                    Total Bookings
                </span>
                <div class="mt-1 font-mono text-lg font-bold text-white">
                    {{ unitBookings.length }}
                </div>
                <span class="text-xs text-mist-500 mt-0.5 block">Completed & upcoming</span>
            </div>
        </div>

        <!-- Upcoming Bookings -->
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mt-4">
            <div>
                <h2 class="text-sm font-bold uppercase tracking-wider text-mist-100">
                    Upcoming Bookings
                </h2>
                <p class="mt-0.5 text-xs text-mist-400">Starting from {{ currentMonth }}</p>
            </div>

            <button
                type="button"
                class="rounded-md bg-lime-500 px-4 py-2 text-xs font-semibold text-mist-950 hover:bg-lime-400"
                @click="handleAddBooking(id as PropertyId)">
                <fa-icon icon="plus" /> Add Booking
            </button>
        </div>
        <div
            v-if="groupedBookings.length === 0"
            class="h-full rounded-md border border-dashed border-mist-800 p-12 text-center">
            <p class="text-sm text-mist-400">No reservations</p>
        </div>
        <div
            v-else
            class="rounded-md border border-mist-800 bg-mist-900 shadow-md">
            <table class="w-full text-left text-sm text-mist-300 table-fixed">
                <thead
                    class="border-b border-mist-800 bg-mist-950/60 text-[11px] uppercase text-mist-500">
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
                                            {{ collapsedMonths.includes(group.key) ? '▶' : '▼' }}
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
                                    ? 'bg-mist-800 font-medium ring-1 ring-inset ring-mist-500/40 hover:bg-mist-900/30'
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
                                            <span class="font-bold text-mist-200">
                                                Payout 15%
                                            </span>
                                            <span class="font-semibold text-mist-400">
                                                {{ formatIDR(b.payout * 0.15) }}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </td>
                            <td class="px-4 py-3 text-center text-nowrap">
                                <span
                                    :class="[
                                        'rounded-md px-2 py-0.5 text-xs text-nowrap',
                                        b.status === 'Booked'
                                            ? 'bg-lime-500/20 text-lime-400'
                                            : b.status === 'Checked-in'
                                              ? 'bg-blue-500/20 text-blue-400'
                                              : b.status === 'Waiting for payout'
                                                ? 'bg-sky-500/20 text-sky-400'
                                                : b.status === 'Waiting for payment'
                                                  ? 'bg-amber-500/20 text-amber-400'
                                                  : b.status === 'Unavailable'
                                                    ? 'bg-rose-500/20 text-rose-400'
                                                    : 'bg-mist-800 text-mist-400',
                                    ]">
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
</template>
