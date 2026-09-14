<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { storeToRefs } from 'pinia';
import { MONTH_NAMES } from '@/config/constants';
import { getPropertyTheme } from '@/config/properties';
import { getStatusStyle } from '@/config/status';
import { useBookingStore } from '@/stores/useBookingStore';
import { useModalStore } from '@/stores/useModalStore';
import { usePropertyStore } from '@/stores/usePropertyStore';
import type { Booking } from '@/types/booking';
import type { CalendarDay } from '@/types/calendar';
import type { PropertyId } from '@/types/property';
import { getCurrentDate, getOffsetDate } from '@/utils/date';

import PageTitle from '@/components/PageTitle.vue';

const route = useRoute();
const bookingStore = useBookingStore();
const { bookings } = storeToRefs(bookingStore);
const modalStore = useModalStore();
const propertyStore = usePropertyStore();
const { sortedProperties } = storeToRefs(propertyStore);

const selectedProperty = ref<PropertyId | 'all'>((route.params.id as PropertyId) || 'all');
const selectedCheckInDate = ref<string>('');
const currentDate = ref<Date>(new Date());
const selectedMonth = ref<number>(currentDate.value.getMonth());
const selectedYear = ref<number>(currentDate.value.getFullYear());

const currentMonth = computed(() => currentDate.value.getMonth());
const currentYear = computed(() => currentDate.value.getFullYear());
const calendarDays = computed<CalendarDay[]>(() => {
    const year = currentYear.value;
    const month = currentMonth.value;

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Shift day index
    const rawDayIndex = firstDayOfMonth.getDay();
    const startingDayOfWeek = (rawDayIndex + 6) % 7; // Mon = 0, Sun = 6
    const totalDaysInMonth = lastDayOfMonth.getDate();

    const now = new Date();
    const days: CalendarDay[] = [];
    const today = getCurrentDate(now);

    const prevMonthLastDay = new Date(year, month, 0).getDate();

    // Previous month padding days
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
        const prevDate = new Date(year, month - 1, prevMonthLastDay - i);
        const dateStr = getCurrentDate(prevDate);

        days.push({
            dateStr,
            dayNumber: prevMonthLastDay - i,
            isCurrentMonth: false,
            isToday: dateStr === today,
        });
    }

    // Current month days
    for (let day = 1; day <= totalDaysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        days.push({
            dateStr,
            dayNumber: day,
            isCurrentMonth: true,
            isToday: dateStr === today,
        });
    }

    // Next month padding days
    const remainingCells = 42 - days.length;
    for (let day = 1; day <= remainingCells; day++) {
        const nextDate = new Date(year, month + 1, day);
        const dateStr = getCurrentDate(nextDate);

        days.push({
            dateStr,
            dayNumber: day,
            isCurrentMonth: false,
            isToday: dateStr === today,
        });
    }

    return days;
});
const yearOptions = computed(() => {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let y = currentYear - 2; y <= currentYear + 3; y++) {
        years.push(y);
    }
    return years;
});
const filteredBookings = computed(() =>
    bookings.value.filter((b) =>
        selectedProperty.value !== 'all' && b.propertyId !== selectedProperty.value
            ? false
            : b.status
    )
);

const getStaysForDate = (dateStr: string): Booking[] =>
    filteredBookings.value
        .filter((b) => dateStr >= b.checkIn && dateStr < b.checkOut)
        .sort((a, b) => {
            const aIsMulti = a.nights > 1 ? 1 : 0;
            const bIsMulti = b.nights > 1 ? 1 : 0;

            if (aIsMulti !== bIsMulti) return bIsMulti - aIsMulti;
            if (a.checkIn !== b.checkIn) return a.checkIn.localeCompare(b.checkIn);
            if (a.nights !== b.nights) return b.nights - a.nights;

            return (a.id || a.bookingId).localeCompare(b.id || b.bookingId);
        });
const multiDayStyling = (b: Booking, dateStr: string, dayIndex: number) => {
    const dayOfWeek = dayIndex % 7; // 0 = Mon, 6 = Sun
    const isCheckIn = b.checkIn === dateStr;
    const lastNight = getOffsetDate(b.checkOut, -1);
    const isLastNight = lastNight === dateStr;
    const isSingleNight = b.nights === 1 || (isCheckIn && isLastNight);

    if (isSingleNight) {
        return 'rounded-md mx-0 border';
    }

    const classes: string[] = ['border-y'];

    // Left edge
    if (isCheckIn || dayOfWeek === 0) {
        classes.push('rounded-l-md ml-0 border-l');
    } else {
        classes.push('rounded-l-none -ml-2 border-l-0 pl-3');
    }

    // Right edge
    if (isLastNight || dayOfWeek === 6) {
        classes.push('rounded-r-md mr-0 border-r');
    } else {
        classes.push('rounded-r-none -mr-2 border-r-0 pr-3');
    }

    return classes.join(' ');
};
const prevMonth = (): void => {
    currentDate.value = new Date(
        currentDate.value.getFullYear(),
        currentDate.value.getMonth() - 1,
        1
    );
};
const nextMonth = (): void => {
    currentDate.value = new Date(
        currentDate.value.getFullYear(),
        currentDate.value.getMonth() + 1,
        1
    );
};
const handleMonthChange = (e: Event): void => {
    const newMonth = Number((e.target as HTMLSelectElement).value);
    currentDate.value = new Date(currentDate.value.getFullYear(), newMonth, 1);
};
const handleYearChange = (e: Event): void => {
    const newYear = Number((e.target as HTMLSelectElement).value);
    currentDate.value = new Date(newYear, currentDate.value.getMonth(), 1);
};
const goToToday = (): void => {
    currentDate.value = new Date();
};
const handleAddBooking = () => {
    modalStore.openBookingModal();
};
const handleCellClick = (day: CalendarDay) => {
    selectedCheckInDate.value = day.dateStr;
    modalStore.openBookingModal({
        checkInDate: selectedCheckInDate.value,
        propertyId: selectedProperty.value,
    });
};
const handleBookingClick = (booking: Booking, event: Event) => {
    event.stopPropagation();
    modalStore.openBookingModal({ booking });
};
// TODO: make linkable via URL
const selectProperty = (id: string) => {
    selectedProperty.value = id as PropertyId;
};

watch(
    () => route.params.id,
    (newId) => {
        selectedProperty.value = (newId as PropertyId) || 'all';
    }
);
watch(
    currentDate,
    (newDate) => {
        selectedMonth.value = newDate.getMonth();
        selectedYear.value = newDate.getFullYear();
    },
    { immediate: true }
);
</script>

<template>
    <div class="flex flex-col h-full min-h-0 gap-4">
        <PageTitle>
            <template #title> Calendar </template>
            <template #subtitle> Monthly schedule and room availability </template>
            <!-- Property Selector -->
            <div class="flex items-center gap-1 rounded-md border border-mist-800 bg-mist-900 p-1">
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
                    v-for="prop in sortedProperties"
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
        </PageTitle>

        <!-- Month Navigation Controls -->
        <div
            class="flex shrink-0 items-center justify-between rounded-md border border-mist-800 bg-mist-900 p-4">
            <div class="flex items-center gap-2">
                <button
                    type="button"
                    class="cursor-pointer rounded-md border border-mist-700 bg-mist-800 px-3 py-1.5 text-xs font-semibold text-mist-200 hover:bg-mist-700"
                    @click="goToToday">
                    Today
                </button>
                <button
                    type="button"
                    class="cursor-pointer rounded-md border border-mist-700 bg-mist-900/50 px-3 py-1.5 text-xs text-mist-300 hover:bg-mist-800"
                    @click="prevMonth">
                    <fa-icon icon="chevron-left" />
                </button>
                <button
                    type="button"
                    class="cursor-pointer rounded-md border border-mist-700 bg-mist-900/50 px-3 py-1.5 text-xs text-mist-300 hover:bg-mist-800"
                    @click="nextMonth">
                    <fa-icon icon="chevron-right" />
                </button>
            </div>
            <div class="flex items-center justify-center gap-2 text-mist-300 font-bold">
                <select
                    name="month-selector"
                    :value="selectedMonth"
                    class="appearance-none cursor-pointer rounded-md outline-none w-30 text-right text-mist-200"
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
                    class="appearance-none cursor-pointer rounded-md outline-none w-24 ml-2 text-mist-200"
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
                class="self-end rounded-md bg-lime-500 px-4 py-2 text-xs font-semibold text-mist-950 hover:bg-lime-400"
                @click="handleAddBooking">
                <fa-icon
                    class="text-xs"
                    icon="plus" />
                Add Booking
            </button>
        </div>

        <!-- Calendar Grid -->
        <div
            class="flex-1 min-h-0 flex flex-col rounded-md border border-mist-800 bg-mist-900 shadow-md overflow-hidden mb-4">
            <div
                class="shrink-0 grid grid-cols-7 border-b border-mist-800 bg-mist-950/60 text-center text-xs font-semibold uppercase text-mist-400">
                <div class="py-2.5">Mon</div>
                <div class="py-2.5">Tue</div>
                <div class="py-2.5">Wed</div>
                <div class="py-2.5">Thu</div>
                <div class="py-2.5">Fri</div>
                <div class="py-2.5">Sat</div>
                <div class="py-2.5">Sun</div>
            </div>

            <div
                class="flex-1 min-h-0 overflow-y-auto grid grid-cols-7 divide-x divide-y divide-mist-800/60 bg-mist-900">
                <div
                    v-for="(day, dayIndex) in calendarDays"
                    :key="day.dateStr"
                    :class="[
                        'min-h-30 p-2 transition cursor-pointer flex flex-col justify-between hover:bg-mist-800/40',
                        !day.isCurrentMonth ? 'bg-mist-950/40 opacity-40' : '',
                        day.isToday ? 'bg-lime-500/5 ring-1 ring-inset ring-lime-500/30' : '',
                    ]"
                    @click="handleCellClick(day)">
                    <!-- Day Number Header -->
                    <div class="flex items-center justify-between mb-1">
                        <span
                            :class="[
                                'text-xs font-bold rounded-md h-6 w-6 flex items-center justify-center',
                                day.isToday
                                    ? 'bg-lime-500 text-mist-950 shadow-sm'
                                    : 'text-mist-400',
                            ]">
                            {{ day.dayNumber }}
                        </span>
                    </div>

                    <!-- Bookings Area -->
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
                                <!-- Start of multi-day stay -->
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

                                <!-- Continuation bar label -->
                                <div
                                    v-else
                                    class="text-xs text-mist-400 font-medium truncate flex items-start gap-1 opacity-75 h-10">
                                    <span class="truncate">{{ b.guestName }}</span>
                                </div>
                            </div>

                            <!-- Popover for Stay Details -->
                            <div
                                v-if="day.isCurrentMonth"
                                class="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 w-50 -translate-x-1/2 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100">
                                <div
                                    class="rounded-md border border-mist-700 bg-mist-900 p-2.5 text-xs text-mist-100 shadow-xl">
                                    <div class="border-b border-mist-800 pb-1.5 mb-1.5">
                                        <span class="font-bold text-mist-200">
                                            {{ b.guestName }}
                                        </span>
                                        <span class="block mt-1 text-[10px] text-mist-400">
                                            {{ b.checkIn }} → {{ b.checkOut }}
                                        </span>
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
                                        <p class="mt-1 whitespace-pre-wrap italic">
                                            {{ b.notes }}
                                        </p>
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
