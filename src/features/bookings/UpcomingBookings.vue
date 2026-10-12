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
    showProperty?: boolean;
}

const { bookings, showProperty = true } = defineProps<Props>();
const emit = defineEmits<{
    'edit-booking': [booking: Booking];
}>();

const sortedUpcomingBookings = computed<Booking[]>(() => {
    const today = getCurrentDate();

    return bookings
        .filter((b) => b.status !== 'Unavailable' && b.checkIn >= today)
        .sort((a, b) => a.checkIn.localeCompare(b.checkIn));
});
const displaySections = computed<MonthSection[]>(() => {
    const list = sortedUpcomingBookings.value;

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
            class="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md">
            <div
                v-if="sortedUpcomingBookings.length === 0"
                class="flex flex-1 flex-col items-center justify-center p-8 text-xs text-mist-400">
                <fa-icon
                    icon="receipt"
                    class="mb-2 text-xl text-mist-600" />
                <p>No upcoming reservations scheduled</p>
            </div>

            <template
                v-for="section in displaySections"
                v-else
                :key="section.key">
                <div class="my-2 first:mt-0">
                    <h3 class="text-xs font-medium text-gray-500 uppercase dark:text-neutral-400">
                        {{ section.label }}
                    </h3>
                </div>

                <div
                    v-for="b in section.items"
                    :key="b.id || b.bookingId"
                    class="flex gap-x-3">
                    <div
                        class="relative after:absolute after:inset-s-3.5 after:top-7 after:bottom-0 after:translate-x-[-0.5px] after:border-s after:border-neutral-700 last:after:hidden">
                        <div class="relative z-10 flex size-7 items-center justify-center">
                            <div
                                class="flex size-7 items-center justify-center rounded-full bg-mist-800">
                                <fa-icon
                                    class="text-xs text-mist-300"
                                    icon="calendar-days" />
                            </div>
                        </div>
                    </div>
                    <div
                        class="group -mx-1 mb-4 flex grow cursor-pointer items-center justify-between p-1 transition hover:bg-mist-800/40"
                        @click="emit('edit-booking', b)">
                        <!-- Guest Info & Property -->
                        <div class="flex min-w-0 items-center gap-3">
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
                                    &bull; {{ b.nights }} night{{ b.nights > 1 ? 's' : '' }}
                                    via
                                    <span class="font-medium text-mist-300">
                                        {{ b.listing }}
                                    </span>
                                </p>
                            </div>
                        </div>
                        <!-- Payout & Status -->
                        <div class="shrink-0 text-right">
                            <span class="mr-0.5 block font-mono text-xs font-bold">
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
</template>
