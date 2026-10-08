<script setup lang="ts">
import { computed } from 'vue';
import { getPropertyStyle } from '@/config/properties';
import { getStatusStyle } from '@/config/status';
import type { Booking } from '@/types/booking';
import { formatIDR } from '@/utils/money';
import { formatDate, getCurrentDate } from '@/utils/date';

import CardTitle from '@/components/CardTitle.vue';

interface MonthSection {
    key: string;
    label: string;
    items: Booking[];
}

interface Props {
    bookings: Booking[];
    limit?: number;
    showMonthHeaders?: boolean;
    showProperty?: boolean;
}

const { bookings, limit = 5, showMonthHeaders = false, showProperty = true } = defineProps<Props>();
const emit = defineEmits<{
    'edit-booking': [booking: Booking];
}>();

const sortedUpcomingBookings = computed<Booking[]>(() => {
    const today = getCurrentDate();

    return bookings
        .filter((b) => b.status !== 'Unavailable' && b.checkIn >= today)
        .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
        .slice(0, limit);
});
const displaySections = computed<MonthSection[]>(() => {
    const list = sortedUpcomingBookings.value;

    if (!showMonthHeaders) {
        return [{ key: 'all', label: '', items: list }];
    }

    const groups = new Map<string, Booking[]>();
    for (const b of list) {
        const monthKey = b.checkIn.slice(0, 7);
        const existing = groups.get(monthKey) ?? [];
        existing.push(b);
        groups.set(monthKey, existing);
    }

    return Array.from(groups.entries()).map(([key, items]) => ({
        key,
        label: formatDate(key, { monthHeader: true }),
        items,
    }));
});
</script>

<template>
    <div class="flex h-full min-h-0 flex-col overflow-y-auto">
        <CardTitle>
            <template #title>Upcoming Bookings</template>
            <template #subtitle>Next confirmed reservations across all units</template>
        </CardTitle>

        <div
            class="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-md border border-mist-800 bg-mist-900 shadow-md">
            <div
                v-if="sortedUpcomingBookings.length === 0"
                class="flex flex-1 flex-col items-center justify-center p-8 text-xs text-mist-400">
                <fa-icon
                    icon="receipt"
                    class="mb-2 text-xl text-mist-600" />
                <p>No upcoming reservations scheduled</p>
            </div>
            <div
                v-else
                class="flex flex-col">
                <template
                    v-for="section in displaySections"
                    :key="section.key">
                    <!-- Month Header -->
                    <div
                        v-if="showMonthHeaders && section.label"
                        class="sticky top-0 z-10 shrink-0 border-y border-mist-800 bg-mist-950/50 px-4 py-2.5 text-xs font-semibold tracking-wider text-mist-400 uppercase backdrop-blur-sm">
                        {{ section.label }}
                    </div>
                    <div class="flex flex-1 flex-col divide-y divide-mist-800">
                        <div
                            v-for="b in section.items"
                            :key="b.id || b.bookingId"
                            class="group flex cursor-pointer items-center justify-between px-3 py-3 transition hover:bg-mist-800/40"
                            @click="emit('edit-booking', b)">
                            <!-- Guest Info & Property -->
                            <div class="flex min-w-0 items-center gap-3">
                                <div
                                    class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-mist-800 text-xs font-semibold text-mist-300">
                                    {{ b.guestName.charAt(0).toUpperCase() }}
                                </div>
                                <div class="truncate">
                                    <div class="flex items-center gap-2">
                                        <span
                                            class="truncate text-sm font-medium transition group-hover:text-lime-400">
                                            {{ b.guestName }}
                                        </span>
                                        <span
                                            v-if="showProperty"
                                            class="shrink-0 rounded-sm px-1.5 py-0.5 text-xs font-medium capitalize"
                                            :class="getPropertyStyle(b.propertyId)">
                                            {{ b.propertyId }}
                                        </span>
                                    </div>
                                    <p class="mt-1 text-[11px] text-mist-400">
                                        {{
                                            formatDate(b.checkIn, {
                                                shortWeekday: true,
                                                shortMonth: true,
                                                relativeDay: true,
                                            })
                                        }}
                                        &bull; {{ b.nights }} night{{ b.nights > 1 ? 's' : '' }} via
                                        <span class="font-medium text-mist-300">
                                            {{ b.listing }}
                                        </span>
                                    </p>
                                </div>
                            </div>
                            <!-- Payout & Status -->
                            <div class="shrink-0 text-right">
                                <span
                                    class="mr-0.5 block font-mono text-xs font-semibold text-mist-300">
                                    {{ formatIDR(b.payout) }}
                                </span>
                                <span
                                    class="mt-1 inline-block text-xs"
                                    :class="getStatusStyle(b.status)">
                                    {{ b.status }}
                                </span>
                            </div>
                        </div>
                    </div>
                </template>
            </div>
        </div>
    </div>
</template>
