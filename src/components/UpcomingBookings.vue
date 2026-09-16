<script setup lang="ts">
import { computed } from 'vue';
import { getPropertyStyle } from '@/config/properties';
import { getStatusStyle } from '@/config/status';
import type { Booking } from '@/types/booking';
import { formatIDR } from '@/utils/money';
import { formatDate, getCurrentDate } from '@/utils/date';

import CardTitle from '@/components/CardTitle.vue';

interface Props {
    bookings: Booking[];
    limit?: number;
    showMonthHeaders?: boolean;
    showProperty?: boolean;
}

interface Emits {
    (e: 'edit-booking', booking: Booking): void;
}

const { bookings, limit = 5, showMonthHeaders = false, showProperty = true } = defineProps<Props>();

const emit = defineEmits<Emits>();

interface MonthSection {
    key: string;
    label: string;
    items: Booking[];
}

const sortedUpcomingBookings = computed<Booking[]>(() => {
    const today = getCurrentDate(); // Evaluated ONCE per run

    return bookings
        .filter((b) => b.status !== 'Unavailable' && b.status !== 'No show' && b.checkIn >= today)
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
    <div class="flex flex-col h-full min-h-0">
        <CardTitle>
            <template #title>Upcoming Bookings</template>
            <template #subtitle>Next confirmed reservations across all units</template>
        </CardTitle>

        <div
            class="flex-1 min-h-0 overflow-y-auto flex flex-col rounded-md border border-mist-800 bg-mist-900 shadow-md">
            <div
                v-if="sortedUpcomingBookings.length === 0"
                class="flex flex-1 flex-col items-center justify-center p-8 text-xs text-mist-400">
                <fa-icon
                    icon="receipt"
                    class="text-xl text-mist-600 mb-2" />
                <p>No upcoming reservations scheduled</p>
            </div>
            <div
                v-else
                class="flex-1 flex flex-col">
                <template
                    v-for="section in displaySections"
                    :key="section.key">
                    <!-- Month Header -->
                    <div
                        v-if="showMonthHeaders && section.label"
                        class="sticky top-0 z-10 shrink-0 border-y border-mist-800/80 bg-mist-950/90 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-mist-400 backdrop-blur-xs">
                        {{ section.label }}
                    </div>
                    <div class="flex-1 flex flex-col divide-y divide-mist-800/60">
                        <div
                            v-for="b in section.items"
                            :key="b.id || b.bookingId"
                            class="flex grow items-center justify-between px-3 py-3 hover:bg-mist-800/40 transition cursor-pointer group"
                            @click="emit('edit-booking', b)">
                            <!-- Guest Info & Property -->
                            <div class="min-w-0 flex items-center gap-3">
                                <div
                                    class="h-8 w-8 rounded-full bg-mist-800 flex items-center justify-center text-xs font-bold text-mist-300 shrink-0">
                                    {{ b.guestName.charAt(0).toUpperCase() }}
                                </div>
                                <div class="truncate">
                                    <div class="flex items-center gap-2">
                                        <span
                                            class="font-bold text-sm text-mist-100 truncate group-hover:text-lime-400 transition">
                                            {{ b.guestName }}
                                        </span>
                                        <span
                                            v-if="showProperty"
                                            class="capitalize rounded-sm px-1.5 py-0.5 text-xs font-medium shrink-0"
                                            :class="getPropertyStyle(b.propertyId)">
                                            {{ b.propertyId }}
                                        </span>
                                    </div>
                                    <p class="text-[11px] text-mist-400 mt-1">
                                        {{
                                            formatDate(b.checkIn, {
                                                shortWeekday: true,
                                                shortMonth: true,
                                            })
                                        }}
                                        &bull; {{ b.nights }} night(s) via
                                        <span class="text-mist-300 font-medium">
                                            {{ b.listing }}
                                        </span>
                                    </p>
                                </div>
                            </div>
                            <!-- Payout & Status -->
                            <div class="text-right shrink-0">
                                <span class="font-mono text-xs font-bold text-mist-100 block">
                                    {{ formatIDR(b.payout) }}
                                </span>
                                <span
                                    class="text-xs inline-block mt-1"
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
