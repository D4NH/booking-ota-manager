<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onActivated } from 'vue';
import { storeToRefs } from 'pinia';
import { useBookingSync } from '@/composables/useBookingSync';
import { useDateKeys } from '@/composables/useDateKeys';
import { useDailyOperations } from '@/composables/useDailyOperations';
import { PROPERTY_LIST, getPropertyTheme } from '@/config/properties';
import { bookingStatuses, getStatusStyle } from '@/config/status';
import { useBookingStore } from '@/stores/useBookingStore';
import { useModalStore } from '@/stores/useModalStore';
import type { Booking } from '@/types/booking';
import type { PropertyId } from '@/types/property';
import { formatIDR } from '@/utils/money';
import { formatDate, getCurrentMonth } from '@/utils/date';

import GoogleSyncButton from '@/components/GoogleSyncButton.vue';

const bookingStore = useBookingStore();
const { bookings } = storeToRefs(bookingStore);
const modalStore = useModalStore();

const { deleteBooking, clearAllLocalBookings } = useBookingSync();
const { currentDay } = useDateKeys();

const selectedProperty = ref<PropertyId | 'all'>('all');
const selectedMonth = ref<string>('all');
const searchQuery = ref<string>('');
const hiddenStatuses = ref<Booking['status'][]>([]);
const collapsedMonths = ref<string[]>([]);
const toggleFilters = ref<boolean>(false);
const hasAutoCollapsed = ref(false);
const currentMonthRef = ref<HTMLElement | null>(null);

const { todaysArrivals, currentStays, todaysDepartures } = useDailyOperations(bookings, {
    propertyId: () => selectedProperty.value,
});

const availableMonths = computed<string[]>(() => {
    const months = bookings.value.map((b) => b.checkIn.substring(0, 7));
    const uniqueMonths = months.filter((month, index) => months.indexOf(month) === index);
    return uniqueMonths.sort((a, b) => a.localeCompare(b));
});
const filteredBookings = computed<Booking[]>(() => {
    const query = searchQuery.value.trim().toLowerCase();
    const prop = selectedProperty.value;
    const month = selectedMonth.value;
    const hidden = hiddenStatuses.value;

    return bookings.value
        .filter((b) => {
            if (prop !== 'all' && b.propertyId !== prop) return false;
            if (month !== 'all' && !b.checkIn.startsWith(month)) return false;
            if (hidden.includes(b.status)) return false;
            if (query) {
                const nameMatch = b.guestName.toLowerCase().includes(query);
                if (nameMatch) return true;

                const idMatch = b.bookingId.toLowerCase().includes(query);
                if (idMatch) return true;

                const notesMatch = b.notes ? b.notes.toLowerCase().includes(query) : false;
                if (notesMatch) return true;

                return false;
            }

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
const currentMonthKey = computed<string>(() => {
    if (currentDay.value) return currentDay.value.substring(0, 7);

    return getCurrentMonth();
});

const toggleStatusVisibility = (status: Booking['status']): void => {
    if (hiddenStatuses.value.includes(status)) {
        hiddenStatuses.value = hiddenStatuses.value.filter((s) => s !== status);
    } else {
        hiddenStatuses.value.push(status);
    }
};
const collapsePastMonths = () => {
    const pastMonths = availableMonths.value.filter((mKey) => mKey < currentMonthKey.value);

    collapsedMonths.value = Array.from(new Set([...collapsedMonths.value, ...pastMonths]));
};
const toggleMonth = (monthKey: string) => {
    const index = collapsedMonths.value.indexOf(monthKey);

    if (index > -1) {
        collapsedMonths.value.splice(index, 1);
    } else {
        collapsedMonths.value.push(monthKey);
    }
};
const scrollToCurrentMonth = async () => {
    await nextTick();

    requestAnimationFrame(() => {
        if (currentMonthRef.value) {
            currentMonthRef.value.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
            });
        }
    });
};
const handleAddBooking = () => {
    modalStore.openBookingModal({
        propertyId: selectedProperty.value,
        checkInDate: currentDay.value,
    });
};
const handleEditBooking = (booking: Booking) => {
    modalStore.openBookingModal({ booking });
};
const handleDeleteBooking = async (booking: Booking): Promise<void> => {
    await deleteBooking(booking);
};
const handleClearAllLocal = async (): Promise<void> => {
    await clearAllLocalBookings();
};
const isCurrentBooking = (checkIn: string): boolean => currentDay.value === checkIn;
const selectProperty = (id: string) => {
    selectedProperty.value = id as PropertyId;
    scrollToCurrentMonth();
};

watch(
    availableMonths,
    (months) => {
        if (months.length > 0 && !hasAutoCollapsed.value) {
            collapsePastMonths();
            hasAutoCollapsed.value = true;
        }
    },
    { immediate: true }
);
watch(selectedMonth, (newMonth) => {
    if (newMonth !== 'all') {
        collapsedMonths.value = [];
    } else {
        collapsePastMonths();
    }
});
watch(
    availableMonths,
    (months) => {
        if (months.length > 0) {
            scrollToCurrentMonth();
        }
    },
    { once: true }
);

onMounted(() => {
    if (availableMonths.value.length > 0) {
        scrollToCurrentMonth();
    }
});

onActivated(() => {
    if (availableMonths.value.length > 0) {
        scrollToCurrentMonth();
    }
});
</script>

<template>
    <div class="flex flex-col h-full min-h-0 gap-4">
        <!-- Header -->
        <div class="flex shrink-0 items-center justify-between mt-4">
            <div>
                <h1 class="text-xl font-bold text-mist-100">Bookings</h1>
                <p class="mt-1 text-xs text-mist-400">
                    Showing {{ filteredBookings.length }} of {{ bookings.length }} total bookings
                </p>
            </div>

            <div class="flex items-center gap-3">
                <GoogleSyncButton :property-id="selectedProperty" />

                <!-- Property Selector -->
                <div
                    class="flex items-center gap-1 rounded-md border border-mist-800 bg-mist-900 p-1">
                    <button
                        type="button"
                        class="cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition"
                        :class="[
                            selectedProperty === 'all'
                                ? 'bg-mist-800 text-lime-400 shadow-md'
                                : 'text-mist-400 hover:text-mist-200',
                        ]"
                        @click="selectedProperty = 'all'">
                        All
                    </button>
                    <button
                        v-for="prop in PROPERTY_LIST"
                        :key="prop.id"
                        type="button"
                        class="cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition"
                        :class="[
                            selectedProperty === prop.id
                                ? 'bg-mist-800 text-lime-400 shadow-md'
                                : 'text-mist-400 hover:text-mist-200',
                        ]"
                        @click="selectProperty(prop.id)">
                        <span class="capitalize">{{ prop.id }}</span>
                    </button>
                </div>
            </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <!-- Arriving Today -->
            <div class="shadow-md">
                <div
                    class="h-full flex flex-col space-y-3 rounded-md border border-mist-800 bg-mist-900 p-4">
                    <div
                        class="flex items-center justify-between border-b border-mist-800 pb-4 mb-4">
                        <h3 class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                            Arriving Today
                        </h3>
                        <span
                            class="rounded-md bg-mist-500/20 px-2 py-0.5 text-[10px] font-bold text-mist-400">
                            {{ todaysArrivals.length }}
                        </span>
                    </div>
                    <div
                        v-if="todaysArrivals.length === 0"
                        class="flex flex-1 items-center justify-center text-center text-xs text-mist-500 min-h-10">
                        No arrivals scheduled for today.
                    </div>
                    <div
                        v-else
                        class="divide-y divide-mist-800">
                        <div
                            v-for="b in todaysArrivals"
                            :key="b.id"
                            class="space-y-2 py-4 first:pt-0 last:pb-0">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                    <span class="font-semibold text-sm text-mist-200">
                                        {{ b.guestName }}
                                    </span>
                                    <button
                                        type="button"
                                        class="cursor-pointer text-xs text-mist-400 hover:text-mist-100"
                                        @click="handleEditBooking(b)">
                                        <fa-icon icon="pen-to-square" />
                                    </button>
                                </div>
                                <RouterLink
                                    :to="{
                                        name: 'property-detail',
                                        params: { id: b.propertyId },
                                    }"
                                    class="capitalize rounded-sm px-2 py-0.5 text-xs font-medium"
                                    :class="[
                                        getPropertyTheme(b.propertyId).bg,
                                        getPropertyTheme(b.propertyId).text,
                                    ]">
                                    {{ b.propertyId }}
                                </RouterLink>
                            </div>
                            <div class="flex justify-between text-xs text-mist-400">
                                <span>
                                    {{ formatDate(b.checkIn, { shortMonth: true }) }}
                                    &rarr;
                                    {{ formatDate(b.checkOut, { shortMonth: true }) }} &bull;
                                    {{ b.nights }} night(s)
                                </span>
                                <span>{{ b.listing }}</span>
                            </div>
                            <div class="flex justify-end text-xs text-mist-400">
                                <span class="font-mono text-lime-400">
                                    {{ formatIDR(b.payout) }}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <!-- Current Stays -->
            <div class="shadow-md">
                <div
                    class="h-full flex flex-col space-y-3 rounded-md border border-mist-800 bg-mist-900 p-4">
                    <div
                        class="flex items-center justify-between border-b border-mist-800 pb-4 mb-4">
                        <h3 class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                            Currently Staying
                        </h3>
                        <span
                            class="rounded-md bg-mist-500/20 px-2 py-0.5 text-[10px] font-bold text-mist-400">
                            {{ currentStays.length }}
                        </span>
                    </div>
                    <div
                        v-if="currentStays.length === 0"
                        class="flex flex-1 items-center justify-center text-center text-xs text-mist-500">
                        No guests currently in-house.
                    </div>
                    <div
                        v-else
                        class="divide-y divide-mist-800">
                        <div
                            v-for="b in currentStays"
                            :key="b.id"
                            class="space-y-2 py-4 first:pt-0 last:pb-0">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                    <span class="font-semibold text-sm text-mist-200">
                                        {{ b.guestName }}
                                    </span>
                                    <button
                                        type="button"
                                        class="cursor-pointer text-xs text-mist-400 hover:text-mist-100"
                                        @click="handleEditBooking(b)">
                                        <fa-icon icon="pen-to-square" />
                                    </button>
                                </div>
                                <RouterLink
                                    :to="{
                                        name: 'property-detail',
                                        params: { id: b.propertyId },
                                    }"
                                    class="capitalize rounded-sm px-2 py-0.5 text-xs font-medium"
                                    :class="[
                                        getPropertyTheme(b.propertyId).bg,
                                        getPropertyTheme(b.propertyId).text,
                                    ]">
                                    {{ b.propertyId }}
                                </RouterLink>
                            </div>
                            <div class="flex justify-between text-xs text-mist-400">
                                <span>
                                    {{ formatDate(b.checkIn, { shortMonth: true }) }}
                                    &rarr;
                                    {{ formatDate(b.checkOut, { shortMonth: true }) }} &bull;
                                    {{ b.nights }} night(s)
                                </span>
                                <span>{{ b.listing }}</span>
                            </div>
                            <div class="flex justify-end text-xs text-mist-400">
                                <span class="font-mono text-lime-400">
                                    {{ formatIDR(b.payout) }}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <!-- Today's Departures -->
            <div class="shadow-md">
                <div
                    class="h-full flex flex-col space-y-3 rounded-md border border-mist-800 bg-mist-900 p-4">
                    <div
                        class="flex items-center justify-between border-b border-mist-800 pb-4 mb-4">
                        <h3 class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                            Today's Departures
                        </h3>
                        <span
                            class="rounded-md bg-mist-500/20 px-2 py-0.5 text-[10px] font-bold text-mist-400">
                            {{ todaysDepartures.length }}
                        </span>
                    </div>
                    <div
                        v-if="todaysDepartures.length === 0"
                        class="flex flex-1 items-center justify-center text-center text-xs text-mist-500">
                        No departures scheduled for today.
                    </div>
                    <div
                        v-else
                        class="divide-y divide-mist-800">
                        <div
                            v-for="b in todaysDepartures"
                            :key="b.id"
                            class="space-y-2 py-4 first:pt-0 last:pb-0">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                    <span class="font-semibold text-sm text-mist-200">
                                        {{ b.guestName }}
                                    </span>
                                    <button
                                        type="button"
                                        class="cursor-pointer text-xs text-mist-400 hover:text-mist-100"
                                        @click="handleEditBooking(b)">
                                        <fa-icon icon="pen-to-square" />
                                    </button>
                                </div>
                                <RouterLink
                                    :to="{
                                        name: 'property-detail',
                                        params: { id: b.propertyId },
                                    }"
                                    class="capitalize rounded-sm px-2 py-0.5 text-xs font-medium"
                                    :class="[
                                        getPropertyTheme(b.propertyId).bg,
                                        getPropertyTheme(b.propertyId).text,
                                    ]">
                                    {{ b.propertyId }}
                                </RouterLink>
                            </div>
                            <div class="flex justify-between text-xs text-mist-400">
                                <span>
                                    {{ formatDate(b.checkIn, { shortMonth: true }) }}
                                    &rarr;
                                    {{ formatDate(b.checkOut, { shortMonth: true }) }} &bull;
                                    {{ b.nights }} night(s)
                                </span>
                                <span>{{ b.listing }}</span>
                            </div>
                            <div class="flex justify-end text-xs text-mist-400">
                                <span class="font-mono text-lime-400">
                                    {{ formatIDR(b.payout) }}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Filter Bar -->
        <div
            class="flex shrink-0 items-center justify-between rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md">
            <div class="flex items-center gap-2">
                <div class="w-50">
                    <div class="relative w-full max-w-xs">
                        <div
                            class="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-mist-500">
                            <fa-icon
                                icon="magnifying-glass"
                                class="w-4 h-4" />
                        </div>
                        <input
                            v-model="searchQuery"
                            type="text"
                            placeholder="Search..."
                            class="w-full rounded-md bg-mist-950/50 border border-mist-700 py-1 pl-10 pr-4 text-sm text-mist-200 placeholder-mist-600 focus:border-lime-500 focus:outline-none transition-colors" />
                    </div>
                </div>
                <div class="relative w-50">
                    <select
                        v-model="selectedMonth"
                        class="w-full appearance-none rounded-md border border-mist-700 bg-mist-950/50 px-3 py-1 text-sm text-mist-200 focus:border-lime-500 focus:outline-none transition-colors">
                        <option value="all">All Months</option>
                        <option
                            v-for="mKey in availableMonths"
                            :key="mKey"
                            :value="mKey">
                            {{ formatDate(mKey, { monthOnly: true }) }}
                        </option>
                    </select>
                    <div
                        class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-mist-400">
                        <fa-icon
                            class="text-xs"
                            icon="angle-down" />
                    </div>
                </div>
                <button
                    type="button"
                    class="cursor-pointer rounded-md border border-mist-700 bg-mist-800 px-3 py-1.5 text-xs font-semibold text-mist-200 hover:bg-mist-700"
                    @click="toggleFilters = !toggleFilters">
                    <fa-icon
                        class="text-xs"
                        icon="filter" />
                </button>
                <div
                    v-if="toggleFilters"
                    class="flex flex-wrap items-center gap-2">
                    <button
                        v-for="status in bookingStatuses"
                        :key="status"
                        type="button"
                        :class="[
                            'rounded-md px-2.5 py-1 text-xs border transition',
                            hiddenStatuses.includes(status)
                                ? 'border-rose-500/40 bg-rose-500/10 text-rose-400 line-through'
                                : 'border-mist-700 bg-mist-800 text-mist-300 hover:border-mist-600',
                        ]"
                        @click="toggleStatusVisibility(status)">
                        {{ status }}
                    </button>
                </div>
            </div>
            <button
                type="button"
                class="cursor-pointer rounded-md bg-lime-500 hover:bg-lime-400 px-4 py-2 text-xs font-semibold text-mist-950"
                @click="handleAddBooking">
                <fa-icon
                    class="text-xs"
                    icon="plus" />
                Add Booking
            </button>
        </div>

        <!-- Bookings Table -->
        <div
            v-if="groupedBookings.length === 0"
            class="flex-1 rounded-md border border-dashed border-mist-800 p-12 text-center shadow-md">
            <p class="text-sm text-mist-400">No reservations matching current filters</p>
        </div>
        <div
            v-else
            class="flex-1 min-h-0 overflow-x-auto rounded-md border border-mist-800 bg-mist-900 shadow-md">
            <table class="w-full text-left text-sm text-mist-300 table-fixed">
                <thead
                    class="sticky top-0 z-20 border-b border-mist-800 bg-mist-950/60 text-xs font-semibold uppercase text-mist-400">
                    <tr>
                        <th class="w-40 px-4 py-2.5">ID</th>
                        <th class="w-32 px-4 py-2.5 text-center">Channel</th>
                        <th class="w-32 px-4 py-2.5 text-center">Property</th>
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
                    <tbody
                        :ref="
                            (el) => {
                                if (group.key === currentMonthKey && el)
                                    currentMonthRef = el as HTMLElement;
                            }
                        "
                        class="border-t border-mist-800 bg-mist-950/40 scroll-mt-10.25">
                        <tr>
                            <td
                                colspan="9"
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
                                        <span
                                            v-if="group.key === currentMonthKey"
                                            class="rounded-md bg-lime-500/10 px-1.5 py-0.2 text-[10px] font-medium text-lime-400">
                                            Current
                                        </span>
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
                                isCurrentBooking(b.checkIn)
                                    ? 'bg-mist-800 font-medium ring-1 ring-inset ring-mist-500/40 hover:bg-mist-900/30'
                                    : 'hover:bg-mist-800/30',
                            ]">
                            <td class="px-4 py-3 font-mono text-lime-400 truncate text-xs">
                                {{ b.bookingId.includes('UNAVAILABLE') ? '-' : b.bookingId }}
                            </td>
                            <td class="px-4 py-3 text-center">
                                <span
                                    class="rounded-sm bg-mist-800 px-2 py-0.5 text-xs text-mist-300 text-nowrap">
                                    {{ b.listing }}
                                </span>
                            </td>
                            <td class="px-4 py-3 text-center">
                                <RouterLink
                                    :to="{ name: 'property-detail', params: { id: b.propertyId } }"
                                    class="capitalize rounded-sm px-2 py-0.5 text-xs font-medium text-nowrap"
                                    :class="[
                                        getPropertyTheme(b.propertyId).bg,
                                        getPropertyTheme(b.propertyId).text,
                                    ]">
                                    {{ b.propertyId }}
                                </RouterLink>
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
                            <td class="px-4 py-3 text-center">
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

        <div class="flex shrink-0 justify-end mb-4">
            <button
                type="button"
                class="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/20"
                @click="handleClearAllLocal">
                Clear Local DB
            </button>
        </div>
    </div>
</template>
