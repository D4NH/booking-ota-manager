<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useGoogleSheets } from '@/composables/useGoogleSheets';
import { useBookingStore } from '@/stores/useBookingStore';
import { usePropertyStore } from '@/stores/usePropertyStore';
import type { Booking } from '@/db';
import { PROPERTY_THEMES, type PropertyId } from '@/config/properties';

interface CalendarDay {
    dateStr: string; // 'YYYY-MM-DD'
    dayNumber: number;
    isCurrentMonth: boolean;
    isToday: boolean;
}

import AddBookingModal from '@/components/AddBookingModal.vue';

const route = useRoute();
const { appendSheetRow, updateSheetRowByBookingId } = useGoogleSheets();
const bookingStore = useBookingStore();
const { bookings } = storeToRefs(bookingStore);
const propertyStore = usePropertyStore();
const { sortedProperties } = storeToRefs(propertyStore);

const routePropertyId = route.params.id as PropertyId | undefined;

const selectedProperty = ref<PropertyId | 'all'>(routePropertyId || 'all');
const selectedCheckInDate = ref<string>('');
const currentDate = ref<Date>(new Date());
const isBookingModalOpen = ref<boolean>(false);
const bookingToEdit = ref<Booking | null>(null);
const syncStatus = ref<string>('');

const currentYear = computed(() => currentDate.value.getFullYear());
const currentMonth = computed(() => currentDate.value.getMonth());
const formattedMonthYear = computed(() =>
    currentDate.value.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
);
const calendarDays = computed<CalendarDay[]>(() => {
    const year = currentYear.value;
    const month = currentMonth.value;

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Shift Day index: Sun(0)->6, Mon(1)->0, Tue(2)->1, etc.
    const rawDayIndex = firstDayOfMonth.getDay();
    const startingDayOfWeek = (rawDayIndex + 6) % 7;

    const totalDaysInMonth = lastDayOfMonth.getDate();

    // Format today's date string in local time
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const days: CalendarDay[] = [];

    // Helper to build local YYYY-MM-DD string without UTC offset issues
    const formatLocalDateStr = (d: Date): string => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dayNum = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${dayNum}`;
    };

    // 1. Previous month padding days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
        const prevDate = new Date(year, month - 1, prevMonthLastDay - i);
        const dateStr = formatLocalDateStr(prevDate);
        days.push({
            dateStr,
            dayNumber: prevMonthLastDay - i,
            isCurrentMonth: false,
            isToday: dateStr === todayStr,
        });
    }

    // 2. Current month days
    for (let day = 1; day <= totalDaysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        days.push({
            dateStr,
            dayNumber: day,
            isCurrentMonth: true,
            isToday: dateStr === todayStr,
        });
    }

    // 3. Next month padding days to complete 42 cells (6 rows)
    const remainingCells = 42 - days.length;
    for (let day = 1; day <= remainingCells; day++) {
        const nextDate = new Date(year, month + 1, day);
        const dateStr = formatLocalDateStr(nextDate);
        days.push({
            dateStr,
            dayNumber: day,
            isCurrentMonth: false,
            isToday: dateStr === todayStr,
        });
    }

    return days;
});
const filteredBookings = computed(() =>
    bookings.value.filter((b) => {
        if (selectedProperty.value !== 'all' && b.propertyId !== selectedProperty.value) {
            return false;
        }
        return b.status;
    })
);

watch(
    () => route.params.id,
    (newId) => {
        selectedProperty.value = (newId as PropertyId) || 'all';
    }
);

const prevMonth = (): void => {
    currentDate.value = new Date(currentYear.value, currentMonth.value - 1, 1);
};
const nextMonth = (): void => {
    currentDate.value = new Date(currentYear.value, currentMonth.value + 1, 1);
};
const goToToday = (): void => {
    currentDate.value = new Date();
};
const getBookingsForDate = (dateStr: string): Booking[] =>
    filteredBookings.value.filter((b) => dateStr >= b.checkIn && dateStr < b.checkOut);
const handleCellClick = (day: CalendarDay): void => {
    selectedCheckInDate.value = day.dateStr;
    bookingToEdit.value = null;
    isBookingModalOpen.value = true;
};
const handleBookingClick = (booking: Booking, event: Event): void => {
    event.stopPropagation();
    bookingToEdit.value = booking;
    isBookingModalOpen.value = true;
};
const handleSaveBooking = async (payload: Omit<Booking, 'id' | 'createdAt'>): Promise<void> => {
    try {
        if (bookingToEdit.value) {
            syncStatus.value = 'Syncing edit to Google Sheets...';
            await bookingStore.updateBookingWithRemoteSync(
                { ...bookingToEdit.value, ...payload },
                { updateSheetRowByBookingId }
            );
            syncStatus.value = 'Booking updated in Google Sheets & local database.';
        } else {
            syncStatus.value = 'Syncing new booking to Google Sheets...';
            await bookingStore.addBookingWithRemoteSync(payload, { appendSheetRow });
            syncStatus.value = 'Booking saved to Google Sheets & local database.';
        }
        isBookingModalOpen.value = false;
    } catch (err: unknown) {
        console.error('Save failed:', err);
        const msg = err instanceof Error ? err.message : 'Google Sheets sync failed.';
        syncStatus.value = `Save failed: ${msg}`;
    } finally {
        setTimeout(() => (syncStatus.value = ''), 5000);
    }
};
const selectProperty = (id: string): void => {
    selectedProperty.value = id as PropertyId;
};
const getPropertyTheme = (id: PropertyId | string) =>
    PROPERTY_THEMES[id as PropertyId] || PROPERTY_THEMES.piyungan;
</script>

<template>
    <div class="space-y-6">
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
                            ? 'bg-mist-800 text-mist-100'
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
                            ? 'bg-mist-800 text-mist-100'
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
            class="grid grid-cols-3 items-center rounded-xl border border-mist-800 bg-mist-900 p-4">
            <!-- Left Column: Controls -->
            <div class="flex items-center gap-2">
                <button
                    type="button"
                    class="cursor-pointer rounded-lg border border-mist-700 bg-mist-800 px-3 py-1.5 text-xs font-semibold text-mist-200 hover:bg-mist-700"
                    @click="goToToday">
                    Today
                </button>
                <button
                    type="button"
                    class="cursor-pointer rounded-lg border border-mist-700 bg-mist-950 px-3 py-1.5 text-xs text-mist-300 hover:bg-mist-800"
                    @click="prevMonth">
                    <fa-icon icon="chevron-left" />
                </button>
                <button
                    type="button"
                    class="cursor-pointer rounded-lg border border-mist-700 bg-mist-950 px-3 py-1.5 text-xs text-mist-300 hover:bg-mist-800"
                    @click="nextMonth">
                    <fa-icon icon="chevron-right" />
                </button>
            </div>

            <!-- Middle Column: Centered Month Title -->
            <h2 class="text-center font-bold text-mist-100">{{ formattedMonthYear }}</h2>
        </div>

        <!-- Calendar Grid Table -->
        <div class="overflow-hidden rounded-xl border border-mist-800 bg-mist-900 shadow-lg">
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

            <!-- 42 Day Grid -->
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

                    <!-- Reservations -->
                    <div class="space-y-1 mt-1">
                        <div
                            v-for="b in getBookingsForDate(day.dateStr)"
                            :key="b.id || b.bookingId"
                            :title="`${b.guestName} (${b.checkIn} to ${b.checkOut})`"
                            class="rounded px-1.5 py-1 text-xs font-medium truncate border transition shadow-sm"
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
                                    v-if="b.status !== 'Unavailable' && selectedProperty === 'all'"
                                    :to="{ name: 'property', params: { id: b.propertyId } }"
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
                    </div>
                </div>
            </div>
        </div>

        <AddBookingModal
            v-if="isBookingModalOpen"
            :booking-to-edit="bookingToEdit"
            :initial-check-in-date="selectedCheckInDate"
            :current-property="selectedProperty"
            @close="isBookingModalOpen = false"
            @save="handleSaveBooking" />
    </div>
</template>
