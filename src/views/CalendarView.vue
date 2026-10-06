<script setup lang="ts">
import { ref, watch, computed } from 'vue';
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
import { formatDate, getCurrentMonth } from '@/utils/date';

import PageTitle from '@/components/PageTitle.vue';
import PropertySelector from '@/components/PropertySelector.vue';

const route = useRoute();
const modalStore = useModalStore();

const selectedProperty = ref<PropertyId | 'all'>((route.params.id as PropertyId) || 'all');
const selectedCheckInDate = ref<string>('');

const { unitBookings: filteredBookings } = usePropertyDetails(selectedProperty, {
    includeUnavailable: true,
});

const {
    isCurrentMonth,
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

console.log('currentDate', isCurrentMonth.value);

watch(
    () => route.params.id,
    (newId) => {
        selectedProperty.value = (newId as PropertyId) || 'all';
    }
);

function handleMonthChange(e: Event): void {
    setMonth(Number((e.target as HTMLSelectElement).value));
}
function handleYearChange(e: Event): void {
    setYear(Number((e.target as HTMLSelectElement).value));
}
function handleAddBooking(): void {
    modalStore.openBookingModal({ propertyId: selectedProperty.value });
}
function handleCellClick(day: CalendarDay): void {
    selectedCheckInDate.value = day.dateStr;
    modalStore.openBookingModal({
        checkInDate: selectedCheckInDate.value,
        propertyId: selectedProperty.value,
    });
}
function handleBookingClick(booking: Booking, event: Event): void {
    event.stopPropagation();
    modalStore.openBookingModal({ booking });
}
</script>

<template>
    <div class="flex h-full flex-col space-y-4 overflow-hidden p-4">
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
                    class="cursor-pointer rounded-md border border-mist-800 bg-mist-800 px-3 py-2 text-xs text-mist-300 shadow-sm transition-colors hover:border-mist-700"
                    :class="{ 'cursor-default bg-mist-900 text-mist-500': isCurrentMonth }"
                    @click="goToToday">
                    Today
                </button>
                <button
                    type="button"
                    class="cursor-pointer rounded-md border border-mist-800 bg-mist-800 px-3 py-2 text-xs text-mist-300 shadow-sm transition-colors hover:border-mist-700"
                    @click="prevMonth">
                    <fa-icon icon="chevron-left" />
                </button>
                <button
                    type="button"
                    class="cursor-pointer rounded-md border border-mist-800 bg-mist-800 px-3 py-2 text-xs text-mist-300 shadow-sm transition-colors hover:border-mist-700"
                    @click="nextMonth">
                    <fa-icon icon="chevron-right" />
                </button>
            </div>
            <div class="flex items-center justify-center gap-2 font-semibold">
                <select
                    name="month-selector"
                    :value="selectedMonth"
                    class="w-32 cursor-pointer appearance-none bg-mist-900 text-right text-lg text-mist-300 outline-none hover:text-mist-100"
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
                    class="w-24 cursor-pointer appearance-none bg-mist-900 text-lg text-mist-300 outline-none hover:text-mist-100"
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
                class="cursor-pointer rounded-md bg-lime-500 px-3 py-2 text-xs font-semibold text-mist-950 transition hover:bg-lime-400"
                @click="handleAddBooking">
                <fa-icon
                    class="-ml-1 text-xs"
                    icon="plus" />
                Add Booking
            </button>
        </div>

        <div
            class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-mist-800 bg-mist-900 shadow-md">
            <!-- Weekday Header -->
            <div
                class="grid shrink-0 grid-cols-7 border-b border-mist-800 bg-mist-950/50 text-center text-xs font-semibold text-mist-400 uppercase">
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
                class="grid min-h-0 flex-1 grid-cols-7 divide-x divide-y divide-mist-800/60 overflow-hidden bg-mist-900">
                <div
                    v-for="(day, dayIndex) in calendarDays"
                    :key="day.dateStr"
                    :class="[
                        'flex min-h-28 cursor-pointer flex-col justify-between p-2 transition hover:bg-mist-800/40',
                        !day.isCurrentMonth ? 'bg-mist-950/40 opacity-40' : '',
                        day.isToday ? 'bg-lime-500/5 ring-1 ring-lime-500/30 ring-inset' : '',
                    ]"
                    @click="handleCellClick(day)">
                    <!-- Date Header -->
                    <div class="mb-1 flex items-center justify-between">
                        <span class="flex h-6 w-6 items-center justify-center rounded-md text-xs">
                            {{ day.dayNumber }}
                        </span>
                    </div>
                    <!-- Event -->
                    <div class="flex flex-1 flex-col justify-start space-y-1.5">
                        <div
                            v-for="b in getStaysForDate(day.dateStr)"
                            :key="'stay-' + (b.id || b.bookingId)"
                            class="group relative z-10">
                            <div
                                class="flex h-12 cursor-pointer flex-col justify-center px-1.5 shadow-sm transition"
                                :class="[
                                    multiDayStyling(b, day.dateStr, dayIndex),
                                    getStatusStyle(b.status, true),
                                ]"
                                @click="handleBookingClick(b, $event)">
                                <div class="flex min-w-0 items-center justify-between">
                                    <span class="truncate text-xs font-semibold text-mist-100">
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
                                        class="py-0.2 shrink-0 rounded px-1 text-[10px] font-semibold capitalize"
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
                                    class="mt-1 truncate text-[10px] text-mist-400">
                                    {{ b.listing }}
                                </div>
                                <div
                                    v-else-if="b.nights > 1"
                                    class="mt-1 text-[10px] text-mist-500 opacity-60">
                                    &bull;&bull;&bull;
                                </div>
                            </div>
                            <!-- Hover Details Popover -->
                            <div
                                class="pointer-events-none absolute top-full left-1/2 z-50 mt-1.5 w-52 -translate-x-1/2 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100">
                                <div
                                    class="rounded-md border border-mist-800 bg-mist-900 p-2.5 text-xs text-mist-100 shadow-xl">
                                    <div>
                                        <span class="mb-1 block font-semibold text-mist-200">
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
                                        </span>
                                    </div>
                                    <div
                                        v-if="b.status === 'Waiting for payment'"
                                        class="mb-1 rounded bg-amber-500/10 p-1 text-xs text-amber-300">
                                        Payment pending
                                    </div>
                                    <div
                                        v-if="b.notes"
                                        class="mt-1.5 border-t border-mist-800 pt-1.5 text-xs text-mist-300">
                                        {{ b.notes }}
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
