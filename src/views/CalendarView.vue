<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useBookingSync } from '@/composables/useBookingSync';
import { getPropertyTheme } from '@/config/properties';
import { MONTH_NAMES } from '@/config/constants';
import { useBookingStore } from '@/stores/useBookingStore';
import { useModalStore } from '@/stores/useModalStore';
import { usePropertyStore } from '@/stores/usePropertyStore';
import type { Booking } from '@/types/booking';
import type { CalendarDay } from '@/types/calendar';
import type { PropertyId } from '@/types/property';
import { getCurrentDate } from '@/utils/date';

const route = useRoute();

const bookingStore = useBookingStore();
const { bookings } = storeToRefs(bookingStore);
const modalStore = useModalStore();
const propertyStore = usePropertyStore();
const { sortedProperties } = storeToRefs(propertyStore);

const { syncStatus } = useBookingSync();

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

    // Shift Day index
    const rawDayIndex = firstDayOfMonth.getDay();
    const startingDayOfWeek = (rawDayIndex + 6) % 7;
    const totalDaysInMonth = lastDayOfMonth.getDate();

    // Format today's date string in local time
    const now = new Date();
    const days: CalendarDay[] = [];
    const today = getCurrentDate(now);

    // Previous month padding days
    const prevMonthLastDay = new Date(year, month, 0).getDate();

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
const getBookingsForDate = (dateStr: string): Booking[] =>
    filteredBookings.value.filter((b) => dateStr >= b.checkIn && dateStr < b.checkOut);
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
const selectProperty = (id: string) => {
    selectedProperty.value = id as PropertyId;
};
</script>

<template>
    <div class="space-y-4">
        <!-- Header Bar -->
        <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
                <h1 class="text-xl font-bold text-mist-100">Calendar</h1>
                <p class="text-xs text-mist-400">Monthly schedule and room availability</p>
            </div>
            <!-- Property Selector -->
            <div class="flex items-center gap-1 rounded-lg border border-mist-800 bg-mist-900 p-1">
                <button
                    type="button"
                    class="cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition"
                    :class="[
                        selectedProperty === 'all'
                            ? 'bg-mist-800 text-lime-400 shadow-sm'
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
                            ? 'bg-mist-800 text-lime-400 shadow-sm'
                            : 'text-mist-400 hover:text-mist-200',
                    ]"
                    @click="selectProperty(prop.id)">
                    <span class="capitalize">{{ prop.id }}</span>
                </button>
            </div>
        </div>

        <!-- Sync Alert Message -->
        <div
            v-if="syncStatus"
            class="rounded-lg border border-lime-500/30 bg-lime-500/10 p-3 text-xs text-lime-300">
            {{ syncStatus }}
        </div>

        <!-- Month Navigation Controls -->
        <div
            class="flex items-center justify-between rounded-lg border border-mist-800 bg-mist-900 p-4">
            <div class="flex items-center gap-2">
                <button
                    type="button"
                    class="cursor-pointer rounded-lg border border-mist-700 bg-mist-800 px-3 py-1.5 text-xs font-semibold text-mist-200 hover:bg-mist-700"
                    @click="goToToday">
                    Today
                </button>
                <button
                    type="button"
                    class="cursor-pointer rounded-lg border border-mist-700 bg-mist-900/50 px-3 py-1.5 text-xs text-mist-300 hover:bg-mist-800"
                    @click="prevMonth">
                    <fa-icon icon="chevron-left" />
                </button>
                <button
                    type="button"
                    class="cursor-pointer rounded-lg border border-mist-700 bg-mist-900/50 px-3 py-1.5 text-xs text-mist-300 hover:bg-mist-800"
                    @click="nextMonth">
                    <fa-icon icon="chevron-right" />
                </button>
            </div>
            <div class="flex items-center justify-center gap-2 text-mist-300 font-bold">
                <select
                    name="month-selector"
                    :value="selectedMonth"
                    class="appearance-none cursor-pointer rounded-lg outline-none w-30 text-right"
                    @change="handleMonthChange">
                    <option
                        v-for="(name, index) in MONTH_NAMES"
                        :key="index"
                        :value="index">
                        {{ name }}
                    </option>
                </select>
                <select
                    name="year-selector"
                    :value="selectedYear"
                    class="appearance-none cursor-pointer rounded-lg outline-none w-30 ml-2"
                    @change="handleYearChange">
                    <option
                        v-for="year in yearOptions"
                        :key="year"
                        :value="year">
                        {{ year }}
                    </option>
                </select>
            </div>
            <button
                type="button"
                class="self-end rounded-lg bg-lime-500 px-4 py-2 text-xs font-semibold text-mist-950 hover:bg-lime-400"
                @click="handleAddBooking">
                <fa-icon
                    class="text-xs"
                    icon="plus" />
                Add Booking
            </button>
        </div>

        <!-- Calendar Grid Table -->
        <div class="rounded-lg border border-mist-800 bg-mist-900 shadow-lg">
            <div
                class="grid grid-cols-7 border-b border-mist-800 bg-mist-950/60 text-center text-xs font-semibold uppercase text-mist-400">
                <div class="py-2.5">Mon</div>
                <div class="py-2.5">Tue</div>
                <div class="py-2.5">Wed</div>
                <div class="py-2.5">Thu</div>
                <div class="py-2.5">Fri</div>
                <div class="py-2.5">Sat</div>
                <div class="py-2.5">Sun</div>
            </div>
            <div class="grid grid-cols-7 divide-x divide-y divide-mist-800/60 bg-mist-900">
                <div
                    v-for="day in calendarDays"
                    :key="day.dateStr"
                    :class="[
                        'min-h-[110px] p-2 transition cursor-pointer flex flex-col justify-between hover:bg-mist-800/40',
                        !day.isCurrentMonth ? 'bg-mist-950/40 opacity-40' : '',
                        day.isToday ? 'bg-lime-500/5 ring-1 ring-inset ring-lime-500/30' : '',
                    ]"
                    @click="handleCellClick(day)">
                    <!-- Day Number Badge -->
                    <div class="flex items-center justify-between">
                        <span
                            :class="[
                                'text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center',
                                day.isToday ? 'bg-lime-500 text-mist-950' : 'text-mist-400',
                            ]">
                            {{ day.dayNumber }}
                        </span>
                    </div>
                    <!-- Bookings -->
                    <div class="space-y-1 mt-1">
                        <div
                            v-for="b in getBookingsForDate(day.dateStr)"
                            :key="b.id || b.bookingId"
                            class="group relative">
                            <!-- Calendar Event Badge -->
                            <div
                                :title="`${b.guestName} (${b.checkIn} to ${b.checkOut})`"
                                class="rounded px-1.5 py-1 text-xs font-medium truncate border transition shadow-sm cursor-pointer"
                                :class="[
                                    b.status === 'Booked'
                                        ? 'border-mist-500/40 bg-mist-500/20 text-mist-300 hover:bg-mist-500/50'
                                        : b.status === 'Waiting for payment'
                                          ? 'border-amber-500/40 bg-amber-500/20 text-amber-300 hover:bg-amber-500/70'
                                          : b.status === 'Unavailable'
                                            ? 'border-rose-500/40 bg-rose-500/20 text-rose-300 hover:bg-rose-500/70'
                                            : 'border-mist-700 bg-mist-800 text-mist-300',
                                ]"
                                @click="handleBookingClick(b, $event)">
                                <div class="flex items-center justify-between">
                                    <span class="font-semibold text-sm text-mist-200 truncate">
                                        {{ b.guestName }}
                                    </span>
                                    <RouterLink
                                        v-if="
                                            b.status !== 'Unavailable' && selectedProperty === 'all'
                                        "
                                        :to="{
                                            name: 'property-detail',
                                            params: { id: b.propertyId },
                                        }"
                                        class="capitalize rounded px-1.5 py-0.5 text-xs font-bold"
                                        :class="[
                                            getPropertyTheme(b.propertyId).bg,
                                            getPropertyTheme(b.propertyId).text,
                                        ]">
                                        {{ b.propertyId }}
                                    </RouterLink>
                                </div>
                                <div
                                    v-if="b.status !== 'Unavailable'"
                                    class="text-xs text-mist-400">
                                    {{ b.listing }}
                                </div>
                            </div>

                            <!-- Popover -->
                            <div
                                v-if="day.isCurrentMonth"
                                class="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 w-60 -translate-x-1/2 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100">
                                <div
                                    class="rounded-lg border border-mist-700 bg-mist-900 p-2.5 text-xs text-mist-100 shadow-xl">
                                    <div
                                        class="flex items-center justify-between border-b border-mist-800 pb-1.5 mb-1.5">
                                        <span class="font-bold text-mist-200">
                                            {{ b.guestName }}
                                        </span>
                                        <span class="text-[10px] text-mist-400">
                                            {{ b.checkIn }} → {{ b.checkOut }}
                                        </span>
                                    </div>
                                    <!-- Payment Pending Alert -->
                                    <div
                                        v-if="b.status === 'Waiting for payment'"
                                        class="mb-1.5 rounded bg-amber-500/10 border border-amber-500/20 p-1.5 text-amber-300 font-medium">
                                        WhatsApp payment follow-up pending
                                    </div>
                                    <!-- Notes -->
                                    <div
                                        v-if="b.notes"
                                        class="text-mist-300">
                                        <span class="font-semibold text-mist-400">Notes:</span>
                                        <p class="mt-0.5 whitespace-pre-wrap italic">
                                            {{ b.notes }}
                                        </p>
                                    </div>
                                    <div
                                        v-else
                                        class="text-mist-500 italic">
                                        No notes added
                                    </div>

                                    <!-- Arrow -->
                                    <div
                                        class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-mist-900"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
