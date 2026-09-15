<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { MONTH_NAMES } from '@/config/constants';
import { getPropertyTheme } from '@/config/properties';
import { getStatusStyle } from '@/config/status';
import { useCalendarGrid } from '@/composables/useCalendarGrid';
import { usePropertyDetails } from '@/composables/usePropertyDetails';
import { useModalStore } from '@/stores/useModalStore';
import type { Booking } from '@/types/booking';
import type { CalendarDay } from '@/types/calendar';
import type { PropertyId } from '@/types/property';

import PageTitle from '@/components/PageTitle.vue';
import PropertySelector from '@/components/PropertySelector.vue';

const route = useRoute();
const modalStore = useModalStore();

const selectedProperty = ref<PropertyId | 'all'>((route.params.id as PropertyId) || 'all');
const selectedCheckInDate = ref<string>('');

const { unitBookings: filteredBookings } = usePropertyDetails(selectedProperty);

const {
    selectedMonth,
    selectedYear,
    calendarDays,
    yearOptions,
    getStaysForDate,
    multiDayStyling,
    prevMonth,
    nextMonth,
    goToToday,
    setMonth,
    setYear,
} = useCalendarGrid(filteredBookings);

const handleMonthChange = (e: Event): void =>
    setMonth(Number((e.target as HTMLSelectElement).value));
const handleYearChange = (e: Event): void => setYear(Number((e.target as HTMLSelectElement).value));
const handleAddBooking = (): void =>
    modalStore.openBookingModal({ propertyId: selectedProperty.value });
const handleCellClick = (day: CalendarDay): void => {
    selectedCheckInDate.value = day.dateStr;
    modalStore.openBookingModal({
        checkInDate: selectedCheckInDate.value,
        propertyId: selectedProperty.value,
    });
};
const handleBookingClick = (booking: Booking, event: Event): void => {
    event.stopPropagation();
    modalStore.openBookingModal({ booking });
};

watch(
    () => route.params.id,
    (newId) => {
        selectedProperty.value = (newId as PropertyId) || 'all';
    }
);
</script>

<template>
    <div class="h-full overflow-hidden flex flex-col space-y-4 p-4">
        <PageTitle>
            <template #title>Calendar</template>
            <template #subtitle>Monthly schedule and room availability</template>

            <PropertySelector v-model="selectedProperty" />
        </PageTitle>

        <!-- Month Navigation Controls -->
        <div
            class="flex shrink-0 items-center justify-between rounded-md border border-mist-800 bg-mist-900 p-4">
            <div class="flex items-center gap-2">
                <button
                    type="button"
                    class="cursor-pointer rounded-md border border-mist-800 bg-mist-800 px-3 py-1.5 text-xs font-semibold text-mist-200 hover:bg-mist-700 transition"
                    @click="goToToday">
                    Today
                </button>
                <button
                    type="button"
                    class="cursor-pointer rounded-md border border-mist-800 bg-mist-900/50 px-3 py-1.5 text-xs text-mist-300 hover:bg-mist-800 transition"
                    @click="prevMonth">
                    <fa-icon icon="chevron-left" />
                </button>
                <button
                    type="button"
                    class="cursor-pointer rounded-md border border-mist-800 bg-mist-900/50 px-3 py-1.5 text-xs text-mist-300 hover:bg-mist-800 transition"
                    @click="nextMonth">
                    <fa-icon icon="chevron-right" />
                </button>
            </div>
            <div class="flex items-center justify-center gap-2 text-mist-300 font-bold">
                <select
                    name="month-selector"
                    :value="selectedMonth"
                    class="appearance-none cursor-pointer outline-none w-32 text-right text-mist-200 bg-mist-900 text-lg"
                    @change="handleMonthChange">
                    <option
                        v-for="(name, index) in MONTH_NAMES"
                        :key="index"
                        :value="index"
                        class="bg-mist-900">
                        {{ name }}
                    </option>
                </select>
                <select
                    name="year-selector"
                    :value="selectedYear"
                    class="appearance-none cursor-pointer outline-none w-24 text-mist-200 bg-mist-900 text-lg"
                    @change="handleYearChange">
                    <option
                        v-for="year in yearOptions"
                        :key="year"
                        :value="year"
                        class="bg-mist-900">
                        {{ year }}
                    </option>
                </select>
            </div>
            <button
                type="button"
                class="cursor-pointer rounded-md bg-lime-500 px-4 py-2 text-xs font-semibold text-mist-950 hover:bg-lime-400 transition"
                @click="handleAddBooking">
                <fa-icon
                    class="text-xs mr-1"
                    icon="plus" />
                Add Booking
            </button>
        </div>

        <div
            class="flex-1 min-h-0 flex flex-col rounded-md border border-mist-800 bg-mist-900 shadow-md overflow-hidden">
            <!-- Weekday Header -->
            <div
                class="shrink-0 grid grid-cols-7 border-b border-mist-800 bg-mist-950 text-center text-xs font-semibold uppercase text-mist-400">
                <div class="px-4 py-2.5">Mon</div>
                <div class="px-4 py-2.5">Tue</div>
                <div class="px-4 py-2.5">Wed</div>
                <div class="px-4 py-2.5">Thu</div>
                <div class="px-4 py-2.5">Fri</div>
                <div class="px-4 py-2.5">Sat</div>
                <div class="px-4 py-2.5">Sun</div>
            </div>

            <!-- Cells Canvas -->
            <div
                class="flex-1 min-h-0 overflow-y-auto grid grid-cols-7 divide-x divide-y divide-mist-800/60 bg-mist-900">
                <div
                    v-for="(day, dayIndex) in calendarDays"
                    :key="day.dateStr"
                    :class="[
                        'min-h-28 p-2 transition cursor-pointer flex flex-col justify-between hover:bg-mist-800/40',
                        !day.isCurrentMonth ? 'bg-mist-950/40 opacity-40' : '',
                        day.isToday ? 'bg-lime-500/5 ring-1 ring-inset ring-lime-500/30' : '',
                    ]"
                    @click="handleCellClick(day)">
                    <!-- Date Header -->
                    <div class="flex items-center justify-between mb-1">
                        <span class="text-xs rounded-md h-6 w-6 flex items-center justify-center">
                            {{ day.dayNumber }}
                        </span>
                    </div>

                    <!-- Stays List -->
                    <div class="space-y-1.5 flex-1 flex flex-col justify-start">
                        <div
                            v-for="b in getStaysForDate(day.dateStr)"
                            :key="'stay-' + (b.id || b.bookingId)"
                            class="group relative z-10">
                            <div
                                :title="`${b.guestName} (${b.checkIn} to ${b.checkOut})`"
                                :class="[
                                    'py-1 px-1.5 text-xs transition shadow-sm cursor-pointer',
                                    multiDayStyling(b, day.dateStr, dayIndex),
                                    getStatusStyle(b.status, true),
                                ]"
                                @click="handleBookingClick(b, $event)">
                                <!-- Initial Day Content -->
                                <div
                                    v-if="
                                        b.checkIn === day.dateStr ||
                                        dayIndex % 7 === 0 ||
                                        b.nights === 1
                                    "
                                    class="flex flex-col gap-1 h-10">
                                    <div class="flex justify-between items-start">
                                        <span class="font-semibold text-xs text-mist-100 truncate">
                                            {{ b.guestName }}
                                        </span>
                                        <span
                                            v-if="
                                                b.status !== 'Unavailable' &&
                                                selectedProperty === 'all'
                                            "
                                            class="capitalize rounded-md px-1 py-0.2 text-[10px] font-bold shrink-0"
                                            :class="[
                                                getPropertyTheme(b.propertyId).bg,
                                                getPropertyTheme(b.propertyId).text,
                                            ]">
                                            {{ b.propertyId }}
                                        </span>
                                    </div>
                                    <div
                                        v-if="b.status !== 'Unavailable'"
                                        class="text-xs text-mist-400">
                                        {{ b.listing }}
                                    </div>
                                </div>

                                <!-- Continuation Bar -->
                                <div
                                    v-else
                                    class="text-xs text-mist-400 font-medium truncate flex items-start gap-1 opacity-75 h-10">
                                    <span class="truncate">{{ b.guestName }}</span>
                                </div>
                            </div>

                            <!-- Hover Popover Details -->
                            <div
                                v-if="day.isCurrentMonth"
                                class="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 w-52 -translate-x-1/2 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100">
                                <div
                                    class="rounded-md border border-mist-800 bg-mist-900 p-2.5 text-xs text-mist-100 shadow-xl">
                                    <div class="border-b border-mist-800 pb-1.5 mb-1.5">
                                        <span class="font-bold text-mist-200">{{
                                            b.guestName
                                        }}</span>
                                        <span class="block mt-1 text-[10px] text-mist-400"
                                            >{{ b.checkIn }} → {{ b.checkOut }}</span
                                        >
                                    </div>
                                    <div
                                        v-if="b.status === 'Waiting for payment'"
                                        class="mb-1.5 rounded-md bg-amber-500/10 border border-amber-500/20 p-1.5 text-amber-300 font-medium text-[11px]">
                                        Payment pending
                                    </div>
                                    <div
                                        v-if="b.status === 'Waiting for payout'"
                                        class="mb-1.5 rounded-md bg-sky-500/10 border border-sky-500/20 p-1.5 text-sky-300 font-medium text-[11px]">
                                        Payout pending
                                    </div>
                                    <div
                                        v-if="b.notes"
                                        class="text-mist-300 text-[11px]">
                                        <span class="font-semibold text-mist-400">Notes:</span>
                                        <p class="mt-1 whitespace-pre-wrap italic">{{ b.notes }}</p>
                                    </div>
                                    <div
                                        v-else
                                        class="text-mist-500 italic text-[11px]">
                                        No notes added
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
