<script setup lang="ts">
import { computed } from 'vue';
import { getPropertyTheme } from '@/config/properties';
import { getStatusStyle } from '@/config/status';
import { useCalendarGrid } from '@/composables/useCalendarGrid';
import { usePropertyDetails } from '@/composables/usePropertyDetails';
import { useModalStore } from '@/stores/useModalStore';
import type { Booking } from '@/types/booking';
import type { PropertyId } from '@/types/property';
import { getCurrentDate, formatDate } from '@/utils/date';

interface Props {
    selectedProperty?: PropertyId | 'all';
    showHeader?: boolean;
}

const { selectedProperty = 'all', showHeader = true } = defineProps<Props>();

const modalStore = useModalStore();

const { unitBookings: filteredBookings } = usePropertyDetails(() => selectedProperty);

// Multi-day span styling & date stay assignment from calendar grid composable
const { getStaysForDate, multiDayStyling } = useCalendarGrid(filteredBookings);

// 7-day strip centered on today (-3 to +3 days)
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
            weekdayName: weekdayFormatter.format(d),
            monthName: monthFormatter.format(d),
            isToday: dateStr === todayStr,
        });
    }

    return days;
});
const weekRangeLabel = computed(() => {
    if (weekDays.value.length === 0) return '';
    const first = weekDays.value[0]!;
    const last = weekDays.value[weekDays.value.length - 1]!;
    return `${formatDate(first.dateStr, { shortMonth: true })} → ${formatDate(last.dateStr, { shortMonth: true })}`;
});

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
        <div
            v-if="showHeader"
            class="flex items-center justify-between px-4 py-2.5 border-b border-mist-800 bg-mist-950/40">
            <div class="flex items-center gap-2">
                <span class="text-xs font-bold uppercase tracking-wider text-mist-300">
                    Current Week
                </span>
            </div>
            <span class="font-mono text-xs text-mist-400">
                {{ weekRangeLabel }}
            </span>
        </div>

        <!-- 7-Day Column Headers -->
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
                class="min-h-32 p-2 transition cursor-pointer flex flex-col justify-between hover:bg-mist-800/40"
                :class="{ 'bg-lime-500/5 ring-1 ring-inset ring-lime-500/30': day.isToday }"
                @click="handleCellClick(day.dateStr)">
                <!-- Cell Header -->
                <div class="flex items-center justify-between mb-1.5">
                    <div class="flex items-center gap-1">
                        <span
                            class="text-xs font-bold rounded-md h-6 w-6 flex items-center justify-center">
                            {{ day.dayNumber }}
                        </span>
                        <span class="text-[10px] text-mist-500 font-medium">
                            {{ day.monthName }}
                        </span>
                    </div>
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
                            <!-- Initial Day or Left Cap of 7-Day Window -->
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

                            <!-- Continuation Strip -->
                            <div
                                v-else
                                class="text-xs text-mist-400 font-medium truncate flex items-start gap-1 opacity-75 min-h-9">
                                <span class="truncate">{{ b.guestName }}</span>
                            </div>
                        </div>

                        <!-- Hover Details Popover -->
                        <div
                            class="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 w-52 -translate-x-1/2 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100">
                            <div
                                class="rounded-md border border-mist-800 bg-mist-900 p-2.5 text-xs text-mist-100 shadow-xl">
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
