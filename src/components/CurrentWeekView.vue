<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { getPropertyTheme } from '@/config/properties';
import { getStatusStyle } from '@/config/status';
import { useBookingStore } from '@/stores/useBookingStore';
import { useModalStore } from '@/stores/useModalStore';
import type { Booking } from '@/types/booking';
import type { PropertyId } from '@/types/property';
import { getCurrentDate, getOffsetDate, formatDate } from '@/utils/date';

const { selectedProperty = 'all', showHeader = true } = defineProps<{
    selectedProperty?: PropertyId | 'all';
    showHeader?: boolean;
}>();

const bookingStore = useBookingStore();
const { bookings } = storeToRefs(bookingStore);
const modalStore = useModalStore();

const weekDays = computed(() => {
    const now = new Date();
    const todayStr = getCurrentDate(now);
    const days = [];
    const weekdayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
    const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short' });

    for (let offset = -3; offset <= 3; offset++) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
        const dateStr = getCurrentDate(d);

        days.push({
            dateStr,
            dayNumber: d.getDate(),
            weekdayName: weekdayFormatter.format(d), // "Thu", "Fri", etc.
            monthName: monthFormatter.format(d), // "Sep"
            isToday: dateStr === todayStr,
        });
    }

    return days;
});
// Date range label for header (e.g. "10 Sep → 16 Sep 2026")
const weekRangeLabel = computed(() => {
    if (weekDays.value.length === 0) return '';
    const first = weekDays.value[0]!;
    const last = weekDays.value[weekDays.value.length - 1]!;
    return `${formatDate(first.dateStr, { shortMonth: true })} → ${formatDate(last.dateStr, { shortMonth: true })}`;
});
const filteredBookings = computed(() =>
    bookings.value.filter((b) =>
        selectedProperty !== 'all' && b.propertyId !== selectedProperty ? false : b.status
    )
);

// Get overnight stays for a date
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
    const isCheckIn = b.checkIn === dateStr;
    const lastNight = getOffsetDate(b.checkOut, -1);
    const isLastNight = lastNight === dateStr;
    const isSingleNight = b.nights === 1 || (isCheckIn && isLastNight);

    if (isSingleNight) {
        return 'rounded-md mx-0 border';
    }

    const classes: string[] = ['border-y'];

    // Left edge (cap at index 0 of the visible strip or on check-in day)
    if (isCheckIn || dayIndex === 0) {
        classes.push('rounded-l-md ml-0 border-l');
    } else {
        classes.push('rounded-l-none -ml-2 border-l-0 pl-3');
    }

    // Right edge (cap at index 6 of the visible strip or on last night)
    if (isLastNight || dayIndex === 6) {
        classes.push('rounded-r-md mr-0 border-r');
    } else {
        classes.push('rounded-r-none -mr-2 border-r-0 pr-3');
    }

    return classes.join(' ');
};
const handleCellClick = (dateStr: string) =>
    modalStore.openBookingModal({
        checkInDate: dateStr,
        propertyId: selectedProperty !== 'all' ? selectedProperty : undefined,
    });
const handleBookingClick = (booking: Booking, event: Event) => {
    event.stopPropagation();
    modalStore.openBookingModal({ booking });
};
</script>

<template>
    <div class="rounded-md border border-mist-800 bg-mist-900 shadow-md overflow-hidden">
        <!-- Header Sub-Bar: Title & Range -->
        <div
            v-if="showHeader"
            class="flex items-center justify-between px-4 py-2.5 border-b border-mist-800 bg-mist-950/40">
            <div class="flex items-center gap-2">
                <span class="text-xs font-bold uppercase tracking-wider text-mist-300">
                    Current Week
                </span>
                <span
                    class="rounded bg-lime-500/10 px-2 py-0.5 text-[10px] font-semibold text-lime-400 border border-lime-500/20">
                    Live Schedule
                </span>
            </div>
            <span class="font-mono text-xs text-mist-400">
                {{ weekRangeLabel }}
            </span>
        </div>

        <!-- 7-Day Columns Header -->
        <div
            class="shrink-0 grid grid-cols-7 border-b border-mist-800 bg-mist-950 text-center text-xs font-semibold uppercase">
            <div
                v-for="day in weekDays"
                :key="day.dateStr"
                class="py-2.5"
                :class="day.isToday ? 'text-lime-400 font-bold' : 'text-mist-400'">
                {{ day.weekdayName }}
            </div>
        </div>

        <!-- 7-Day Grid Cells -->
        <div class="grid grid-cols-7 divide-x divide-mist-800/60 bg-mist-900">
            <div
                v-for="(day, dayIndex) in weekDays"
                :key="day.dateStr"
                :class="[
                    'min-h-32 p-2 transition cursor-pointer flex flex-col justify-between hover:bg-mist-800/40',
                    day.isToday ? 'bg-lime-500/5 ring-1 ring-inset ring-lime-500/30' : '',
                ]"
                @click="handleCellClick(day.dateStr)">
                <div class="flex items-center justify-between mb-1.5">
                    <div class="flex items-center gap-1">
                        <span
                            :class="[
                                'text-xs font-bold rounded-md h-6 w-6 flex items-center justify-center',
                                day.isToday
                                    ? 'bg-lime-500 text-mist-950 shadow-sm'
                                    : 'text-mist-400',
                            ]">
                            {{ day.dayNumber }}
                        </span>
                        <span class="text-[10px] text-mist-500 font-medium">
                            {{ day.monthName }}
                        </span>
                    </div>
                    <span
                        v-if="day.isToday"
                        class="text-[9px] uppercase font-bold text-lime-400 bg-lime-500/10 px-1 py-0.2 rounded border border-lime-500/20">
                        Today
                    </span>
                </div>

                <div class="space-y-1.5 flex-1 flex flex-col justify-start">
                    <div
                        v-for="b in getStaysForDate(day.dateStr)"
                        :key="'stay-' + (b.id || b.bookingId)"
                        class="group relative z-10">
                        <!-- Multi-day booking -->
                        <div
                            :title="`${b.guestName} (${b.checkIn} to ${b.checkOut})`"
                            :class="[
                                'py-1 px-1.5 text-xs transition shadow-sm cursor-pointer',
                                multiDayStyling(b, day.dateStr, dayIndex),
                                getStatusStyle(b.status, true),
                            ]"
                            @click="handleBookingClick(b, $event)">
                            <!-- Start of Stay OR Left edge of the strip (dayIndex === 0) -->
                            <div
                                v-if="b.checkIn === day.dateStr || dayIndex === 0 || b.nights === 1"
                                class="flex flex-col gap-1 min-h-9">
                                <div class="flex justify-between items-start">
                                    <span class="font-semibold text-xs text-mist-100 truncate">
                                        {{ b.guestName }}
                                    </span>
                                    <span
                                        v-if="
                                            b.status !== 'Unavailable' && selectedProperty === 'all'
                                        "
                                        class="capitalize rounded px-1 py-0.2 text-[10px] font-bold shrink-0"
                                        :class="[
                                            getPropertyTheme(b.propertyId).bg,
                                            getPropertyTheme(b.propertyId).text,
                                        ]">
                                        {{ b.propertyId }}
                                    </span>
                                </div>
                                <div
                                    v-if="b.status !== 'Unavailable'"
                                    class="text-[11px] text-mist-400">
                                    {{ b.listing }}
                                </div>
                            </div>
                            <div
                                v-else
                                class="text-xs text-mist-400 font-medium truncate flex items-start gap-1 opacity-75 min-h-9">
                                <span class="truncate">{{ b.guestName }}</span>
                            </div>
                        </div>

                        <!-- Hover Popover -->
                        <div
                            class="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 w-52 -translate-x-1/2 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100">
                            <div
                                class="rounded-md border border-mist-700 bg-mist-900 p-2.5 text-xs text-mist-100 shadow-xl">
                                <div class="border-b border-mist-800 pb-1.5 mb-1.5">
                                    <span class="font-bold text-mist-200 block">
                                        {{ b.guestName }}
                                    </span>
                                    <span class="text-[10px] text-mist-400">
                                        {{ b.checkIn }} &rarr; {{ b.checkOut }}
                                    </span>
                                </div>
                                <div
                                    v-if="b.status === 'Waiting for payment'"
                                    class="mb-1 rounded bg-amber-500/10 p-1 text-amber-300 text-[10px]">
                                    Payment pending
                                </div>
                                <div
                                    v-if="b.notes"
                                    class="text-mist-300 text-[10px] italic">
                                    {{ b.notes }}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
