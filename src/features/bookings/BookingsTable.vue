<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { getPropertyStyle } from '@/config/properties';
import { getStatusStyle } from '@/config/status';
import type { Booking, BookingGroup } from '@/types/booking';
import { formatDate } from '@/utils/date';
import { formatIDR } from '@/utils/money';

import AppButton from '@/components/ui/AppButton.vue';

interface Props {
    groups: BookingGroup[];
    showPropertyColumn?: boolean;
    currentMonthKey?: string;
    currentDateKey?: string;
}

const {
    groups,
    showPropertyColumn = false,
    currentMonthKey = '',
    currentDateKey = '',
} = defineProps<Props>();
const emit = defineEmits<{
    'update:collapsedMonths': [value: string[]];
    edit: [booking: Booking];
    delete: [booking: Booking];
}>();

const collapsedMonths = defineModel<string[]>('collapsedMonths', { default: () => [] });
const collapsedSet = computed(() => new Set(collapsedMonths.value));
const colSpan = computed(() => (showPropertyColumn ? 6 : 6));

function toggleMonth(key: string): void {
    if (collapsedSet.value.has(key)) {
        collapsedMonths.value = collapsedMonths.value.filter((m) => m !== key);
    } else {
        collapsedMonths.value = [...collapsedMonths.value, key];
    }
}
function isCurrentBooking(b: Booking): boolean {
    if (!currentDateKey) return false;
    return (
        currentDateKey >= b.checkIn &&
        currentDateKey <= b.checkOut &&
        b.status !== 'Waiting for payout'
    );
}
</script>

<template>
    <div class="min-h-0 overflow-auto rounded-md border border-mist-800 bg-mist-900 shadow-md">
        <table class="w-full text-left text-sm text-mist-300">
            <thead
                class="sticky top-0 z-10 border-b border-mist-800 bg-mist-950/75 text-xs font-semibold text-mist-400 uppercase backdrop-blur-md">
                <tr>
                    <th class="w-36 px-4 py-2.5">Listing</th>
                    <th class="px-4 py-2.5">Guest</th>
                    <th class="w-60 px-4 py-2.5 text-center">Stay Date</th>
                    <th class="w-10 px-4 py-2.5 text-center">Nights</th>
                    <th class="w-40 px-4 py-2.5 text-right">Payout</th>
                    <th class="w-26 px-4 py-2.5 text-right">Actions</th>
                </tr>
            </thead>
            <template
                v-for="group in groups"
                :key="group.key">
                <!-- Group Header -->
                <tbody
                    :data-month-key="group.key"
                    class="scroll-mt-10 border-t border-b border-mist-800 bg-mist-950/40">
                    <tr>
                        <td :colspan="colSpan">
                            <button
                                type="button"
                                class="flex w-full cursor-pointer items-center justify-between px-4 py-2.5 font-semibold text-mist-200 hover:bg-mist-800/40 focus:outline-none focus-visible:ring-1 focus-visible:ring-lime-500"
                                @click="toggleMonth(group.key)">
                                <span class="flex items-center gap-2">
                                    <span class="text-xs text-mist-400">
                                        {{ collapsedSet.has(group.key) ? '▶' : '▼' }}
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

                <!-- Booking Item -->
                <tbody
                    v-show="!collapsedSet.has(group.key)"
                    class="divide-y divide-mist-800/60">
                    <tr
                        v-for="b in group.bookings"
                        :key="b.id || b.bookingId"
                        class="h-18 cursor-pointer transition"
                        :class="[
                            isCurrentBooking(b) && b.status === 'Booked'
                                ? 'bg-lime-500/5 text-lime-400 ring-1 ring-lime-500/30 hover:bg-lime-500/15'
                                : 'hover:bg-mist-800/40',
                        ]"
                        @click="emit('edit', b)">
                        <td class="px-4 py-0 align-middle">
                            <div class="flex flex-col items-start justify-center gap-1">
                                <span class="ml-1 leading-none text-mist-200">
                                    {{ b.listing }}
                                </span>
                                <div v-if="showPropertyColumn">
                                    <span
                                        v-if="b.bookingId.includes('UNAVAILABLE')"
                                        class="text-mist-500">
                                        -
                                    </span>
                                    <RouterLink
                                        v-else
                                        :to="{
                                            name: 'property-detail',
                                            params: { id: b.propertyId },
                                        }"
                                        :class="getPropertyStyle(b.propertyId)">
                                        {{ b.propertyId }}
                                    </RouterLink>
                                </div>
                            </div>
                        </td>
                        <td class="px-4 py-0 align-middle">
                            <div class="flex flex-col justify-center gap-2.5">
                                <span class="leading-none font-medium text-mist-100">
                                    {{ b.guestName }}
                                </span>
                                <span class="font-mono text-xs leading-none text-mist-400">
                                    {{ b.bookingId.includes('UNAVAILABLE') ? '-' : b.bookingId }}
                                </span>
                            </div>
                        </td>
                        <td class="px-4 py-0 align-middle">
                            <div
                                class="flex items-center justify-center font-mono leading-none font-medium text-mist-300">
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
                            </div>
                        </td>
                        <td class="px-4 py-0 text-center align-middle">
                            <span class="font-mono text-xs leading-none text-mist-300">
                                {{ b.nights }}
                            </span>
                        </td>
                        <td class="px-4 py-0 text-right align-middle">
                            <div class="group relative">
                                <div class="flex flex-col items-end justify-center gap-1">
                                    <div class="font-mono text-sm leading-none text-mist-100">
                                        {{ formatIDR(b.payout) }}
                                    </div>
                                    <span :class="getStatusStyle(b.status)">
                                        {{ b.status }}
                                    </span>
                                </div>
                                <div
                                    v-if="b.payout !== 0"
                                    class="pointer-events-none absolute top-1 bottom-full -left-50 z-30 mb-1.5 w-48 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100">
                                    <div
                                        class="rounded-md border border-mist-800 bg-mist-900 p-2.5 text-xs text-mist-100 shadow-xl">
                                        <div class="flex items-center justify-between font-mono">
                                            <span class="font-medium text-mist-400">
                                                Payout 15%
                                            </span>
                                            <span class="font-semibold text-mist-200">
                                                {{ formatIDR(b.payout * 0.15) }}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </td>
                        <td class="px-2 py-0 text-right align-middle">
                            <div class="flex items-center justify-end">
                                <AppButton
                                    variant="icon"
                                    @click="emit('edit', b)">
                                    <template #icon>
                                        <fa-icon icon="pen-to-square" />
                                    </template>
                                </AppButton>
                                <span class="text-mist-700">|</span>
                                <AppButton
                                    variant="icon"
                                    color="rose"
                                    @click.stop="emit('delete', b)">
                                    <template #icon>
                                        <fa-icon icon="trash-can" />
                                    </template>
                                </AppButton>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </template>
        </table>
    </div>
</template>
