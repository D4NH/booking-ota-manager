<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { getPropertyStyle } from '@/config/properties';
import { getStatusStyle } from '@/config/status';
import type { Booking } from '@/types/booking';
import { formatDate } from '@/utils/date';
import { formatIDR } from '@/utils/money';

export interface BookingGroup {
    key: string;
    label: string;
    count: number;
    bookings: Booking[];
}

interface Props {
    groups: BookingGroup[];
    collapsedMonths?: string[];
    showPropertyColumn?: boolean;
    currentMonthKey?: string;
    currentDateKey?: string;
}

interface Emits {
    (e: 'update:collapsedMonths', value: string[]): void;
    (e: 'edit', booking: Booking): void;
    (e: 'delete', booking: Booking): void;
}

const {
    groups,
    collapsedMonths = [],
    showPropertyColumn = false,
    currentMonthKey = '',
    currentDateKey = '',
} = defineProps<Props>();

const emit = defineEmits<Emits>();

const colSpan = computed(() => (showPropertyColumn ? 8 : 7));

const toggleMonth = (key: string): void => {
    const next = collapsedMonths.includes(key)
        ? collapsedMonths.filter((m) => m !== key)
        : [...collapsedMonths, key];
    emit('update:collapsedMonths', next);
};

const isCurrentBooking = (b: Booking): boolean => {
    if (!currentDateKey) return false;
    return (
        currentDateKey >= b.checkIn &&
        currentDateKey <= b.checkOut &&
        b.status !== 'Waiting for payout'
    );
};
</script>

<template>
    <div class="min-h-0 overflow-auto rounded-md border border-mist-800 bg-mist-900 shadow-md">
        <table class="w-full text-left text-sm text-mist-300 table-fixed">
            <thead
                class="sticky top-0 z-20 border-b border-mist-800 bg-mist-950 text-xs font-semibold uppercase text-mist-400">
                <tr>
                    <th class="w-45 px-4 py-2.5">ID- Listing</th>
                    <th
                        v-if="showPropertyColumn"
                        class="w-35 px-4 py-2.5 text-center">
                        Property
                    </th>
                    <th class="px-4 py-2.5">Guest</th>
                    <th class="w-50 px-4 py-2.5 text-center">Stay Date</th>
                    <th class="w-24 px-4 py-2.5 text-center">Nights</th>
                    <th class="w-36 px-4 py-2.5 text-right">Payout</th>
                    <th class="w-40 px-4 py-2.5 text-center">Status</th>
                    <th class="w-24 px-4 py-2.5 text-right">Actions</th>
                </tr>
            </thead>

            <template
                v-for="group in groups"
                :key="group.key">
                <tbody
                    :data-month-key="group.key"
                    class="border-t border-b border-mist-800/50 bg-mist-950/40 scroll-mt-10">
                    <tr>
                        <td
                            :colspan="colSpan"
                            class="p-0">
                            <button
                                type="button"
                                class="cursor-pointer flex w-full items-center justify-between px-4 py-2.5 font-bold text-mist-200 hover:bg-mist-800/40"
                                @click="toggleMonth(group.key)">
                                <span class="flex items-center gap-2">
                                    <span class="text-xs text-mist-400">
                                        {{ collapsedMonths.includes(group.key) ? '▶' : '▼' }}
                                    </span>
                                    {{ group.label }}
                                    <span
                                        v-if="group.key === currentMonthKey"
                                        class="rounded-md bg-lime-500/10 px-1.5 py-0.5 text-[10px] font-medium text-lime-400">
                                        Current
                                    </span>
                                </span>
                                <span
                                    class="rounded-md bg-mist-800 px-2.5 py-0.5 text-xs font-normal text-mist-400">
                                    {{ group.count }}
                                </span>
                            </button>
                        </td>
                    </tr>
                </tbody>

                <tbody
                    v-show="!collapsedMonths.includes(group.key)"
                    class="divide-y divide-mist-800/60">
                    <tr
                        v-for="b in group.bookings"
                        :key="b.id || b.bookingId"
                        class="transition cursor-pointer"
                        :class="[
                            isCurrentBooking(b)
                                ? 'text-lime-400 bg-lime-500/5 hover:bg-lime-500/15 ring-1 ring-lime-500/30'
                                : 'hover:bg-mist-800/40',
                        ]"
                        @click="emit('edit', b)">
                        <td class="px-4 py-2">
                            <div class="flex flex-col">
                                <span class="text-sm font-mono text-mist-300 truncate">
                                    {{ b.bookingId.includes('UNAVAILABLE') ? '-' : b.bookingId }}
                                </span>
                                <span
                                    v-if="!b.bookingId.includes('UNAVAILABLE')"
                                    class="text-xs text-mist-400 text-nowrap">
                                    {{ b.listing }}
                                </span>
                            </div>
                        </td>
                        <td
                            v-if="showPropertyColumn"
                            class="px-4 py-2 text-center">
                            <RouterLink
                                :to="{ name: 'property-detail', params: { id: b.propertyId } }"
                                :class="getPropertyStyle(b.propertyId)">
                                {{ b.propertyId }}
                            </RouterLink>
                        </td>
                        <td class="px-4 py-2 font-medium text-mist-100 truncate">
                            {{ b.guestName }}
                        </td>
                        <td class="px-4 py-2 text-center text-nowrap">
                            {{ formatDate(b.checkIn, { shortMonth: true }) }} &rarr;
                            {{ formatDate(b.checkOut, { shortMonth: true }) }}
                        </td>
                        <td class="px-4 py-2 font-mono text-center">{{ b.nights }}</td>
                        <td
                            class="px-4 py-2 font-mono text-right text-nowrap group relative"
                            :class="{ 'cursor-zoom-in': b.payout !== 0 }">
                            {{ formatIDR(b.payout) }}
                            <div
                                v-if="b.payout !== 0"
                                class="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 w-48 -translate-x-1/2 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100">
                                <div
                                    class="rounded-md border border-mist-800 bg-mist-900 p-2.5 text-xs text-mist-100 shadow-xl">
                                    <div class="flex items-center justify-between">
                                        <span class="font-bold text-mist-400">Payout 15%</span>
                                        <span class="font-semibold text-mist-200">
                                            {{ formatIDR(b.payout * 0.15) }}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </td>
                        <td class="px-4 py-2 text-center text-nowrap">
                            <span :class="getStatusStyle(b.status)">{{ b.status }}</span>
                        </td>
                        <td class="px-4 py-2 text-right text-nowrap">
                            <div class="flex items-center justify-end gap-2">
                                <div
                                    class="text-mist-400 hover:text-mist-100 transition"
                                    title="Edit Booking">
                                    <fa-icon icon="pen-to-square" />
                                </div>
                                <span class="text-mist-700">|</span>
                                <button
                                    type="button"
                                    class="cursor-pointer text-rose-400 hover:text-rose-300 transition"
                                    title="Delete Booking"
                                    @click.prevent="emit('delete', b)">
                                    <fa-icon icon="trash-can" />
                                </button>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </template>
        </table>
    </div>
</template>
