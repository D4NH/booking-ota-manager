<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { MONTH_NAMES } from '@/config/constants';
import { getPropertyStyle } from '@/config/properties';
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
                    class="rounded-md border border-mist-800 px-3 py-2 text-xs text-mist-300 font-semibold hover:bg-mist-800 transition shadow-sm cursor-pointer"
                    @click="goToToday">
                    Today
                </button>
                <button
                    type="button"
                    class="rounded-md border border-mist-800 px-3 py-2 text-xs text-mist-300 hover:bg-mist-800 transition shadow-sm cursor-pointer"
                    @click="prevMonth">
                    <fa-icon icon="chevron-left" />
                </button>
                <button
                    type="button"
                    class="rounded-md border border-mist-800 px-3 py-2 text-xs text-mist-300 hover:bg-mist-800 transition shadow-sm cursor-pointer"
                    @click="nextMonth">
                    <fa-icon icon="chevron-right" />
                </button>
            </div>
            <div class="flex items-center justify-center gap-2 text-mist-300 font-semibold">
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
                    <!-- Event -->
                    <div class="space-y-1.5 flex-1 flex flex-col justify-start">
                        <div
                            v-for="b in getStaysForDate(day.dateStr)"
                            :key="'stay-' + (b.id || b.bookingId)"
                            class="group relative z-10">
                            <div
                                :title="`${b.guestName} (${b.checkIn} to ${b.checkOut})`"
                                class="h-12 px-1.5 transition shadow-sm cursor-pointer flex flex-col justify-center"
                                :class="[
                                    multiDayStyling(b, day.dateStr, dayIndex),
                                    getStatusStyle(b.status, true),
                                ]"
                                @click="handleBookingClick(b, $event)">
                                <div class="flex items-center justify-between min-w-0">
                                    <span class="font-semibold text-xs text-mist-100 truncate">
                                        {{ b.guestName }}
                                    </span>
                                    <span
                                        v-if="
                                            (b.checkIn === day.dateStr ||
                                                dayIndex % 7 === 0 ||
                                                b.nights === 1) &&
                                            b.status !== 'Unavailable' &&
                                            selectedProperty === 'all'
                                        "
                                        class="capitalize rounded-sm px-1.5 py-0.5 text-xs shrink-0 ml-1"
                                        :class="getPropertyStyle(b.propertyId)">
                                        {{ b.propertyId }}
                                    </span>
                                </div>
                                <div
                                    v-if="
                                        (b.checkIn === day.dateStr ||
                                            dayIndex % 7 === 0 ||
                                            b.nights === 1) &&
                                        b.status !== 'Unavailable'
                                    "
                                    class="text-[10px] text-mist-400 truncate mt-1">
                                    {{ b.listing }}
                                </div>
                                <div
                                    v-else-if="b.nights > 1"
                                    class="text-[10px] text-mist-500 truncate opacity-60 mt-1">
                                    &bull;&bull;&bull;
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
