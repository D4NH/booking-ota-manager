<script setup lang="ts">
import { computed } from 'vue';
import { formatIDR } from '@/utils/money';
import { getPropertyStyle } from '@/config/properties';
import type { Booking, StagedBooking } from '@/types/booking';
import { formatDate } from '@/utils/date';

import AppButton from '@/components/ui/AppButton.vue';

interface Props {
    isCollapsed: boolean;
    pendingPayments?: Booking[];
    pendingPayouts?: Booking[];
    stagedBookings?: StagedBooking[];
}

const {
    isCollapsed,
    pendingPayments = [],
    pendingPayouts = [],
    stagedBookings = [],
} = defineProps<Props>();
const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'mark-complete', booking: Booking): void;
    (e: 'edit', booking: Booking): void;
    (e: 'open-staging', booking?: StagedBooking): void;
}>();

const stagedCount = computed(() => stagedBookings.length);
const totalCount = computed(
    () => pendingPayments.length + pendingPayouts.length + stagedCount.value
);
</script>

<template>
    <div class="overflow-hidden border-t border-mist-800 bg-mist-900">
        <div
            class="flex cursor-pointer items-center justify-between bg-mist-950/50 px-4 py-3"
            :class="{ 'border-b border-mist-800': !isCollapsed }"
            @click="emit('close')">
            <div class="flex items-center gap-2">
                <fa-icon
                    icon="bell"
                    class="text-sm text-mist-400" />
                <span class="text-sm font-semibold text-mist-100">Notifications</span>
            </div>
            <span
                v-if="totalCount > 0"
                class="rounded-xs bg-lime-500/20 px-2 py-0.5 text-[10px] font-semibold text-lime-400">
                {{ totalCount }} New
            </span>
        </div>

        <div
            v-if="!isCollapsed"
            class="max-h-[70vh] space-y-1 divide-y divide-mist-800/60 overflow-y-auto p-2">
            <!-- Empty State -->
            <div
                v-if="totalCount === 0"
                class="space-y-1 py-10 text-center text-xs text-mist-500">
                <fa-icon
                    icon="circle-check"
                    class="mb-1 text-xl text-lime-500/40" />
                <p class="font-medium text-mist-400">All caught up!</p>
                <p>No incoming bookings, pending payments, or unsettled payouts.</p>
            </div>

            <!-- Incoming Bookings Approval -->
            <div
                v-for="staged in stagedBookings"
                :key="staged.id || staged.bookingId"
                class="group cursor-pointer rounded-xs border-b-0 border-l-2 border-l-purple-500 p-3 transition hover:bg-mist-800/40"
                @click.stop="emit('open-staging', staged)">
                <div class="mb-1.5 flex items-center justify-between gap-2">
                    <span
                        class="flex items-center gap-1.5 text-[11px] font-semibold text-purple-400">
                        <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-purple-400"></span>
                        New Booking
                    </span>
                    <span
                        class="py-0.2 rounded-md px-1.5 text-[10px] font-semibold capitalize"
                        :class="getPropertyStyle(staged.propertyId)">
                        {{ staged.propertyId }}
                    </span>
                </div>

                <div class="flex flex-col items-start justify-between gap-1">
                    <p class="text-sm leading-tight font-semibold text-mist-100">
                        {{ staged.guestName }}
                    </p>
                    <p class="font-mono text-xs text-mist-400">
                        {{ formatDate(staged.checkIn, { shortWeekday: true, shortMonth: true }) }}
                        &bull; {{ staged.nights }} night(s)
                    </p>
                    <p class="text-xs text-mist-400">
                        {{ staged.listing }} &bull;
                        <span class="font-mono text-mist-500">{{ staged.bookingId }}</span>
                    </p>
                </div>

                <div
                    class="mt-2.5 flex items-center justify-between border-t border-mist-800/80 pt-2">
                    <span class="shrink-0 font-mono text-xs font-bold text-mist-200">
                        {{ formatIDR(staged.payout) }}
                    </span>
                    <div class="flex items-center gap-1.5 text-xs text-mist-300">
                        <fa-icon icon="pen-to-square" />
                        <span>Review</span>
                    </div>
                </div>
            </div>

            <!-- Pending Payments -->
            <div
                v-for="b in pendingPayments"
                :key="b.id || b.bookingId"
                class="group cursor-pointer rounded-xs border-b-0 border-l-2 border-l-amber-500 p-3 transition hover:bg-mist-800/40"
                @click.stop="emit('edit', b)">
                <div class="mb-1.5 flex items-center justify-between gap-2">
                    <span
                        class="flex items-center gap-1.5 text-[11px] font-semibold text-amber-400">
                        Payment Pending
                    </span>
                    <span
                        class="py-0.2 rounded-md px-1.5 text-[10px] font-semibold capitalize"
                        :class="getPropertyStyle(b.propertyId)">
                        {{ b.propertyId }}
                    </span>
                </div>
                <div class="flex flex-col items-start justify-between gap-1">
                    <p class="text-sm leading-tight font-semibold text-mist-100">
                        {{ b.guestName }}
                    </p>
                    <p class="font-mono text-xs text-mist-400">
                        {{ formatDate(b.checkIn, { shortWeekday: true, shortMonth: true }) }} &bull;
                        {{ b.nights }} night(s)
                    </p>
                    <p class="text-xs text-mist-400">
                        {{ b.listing }}
                    </p>
                </div>
                <div class="mt-2.5 flex items-center justify-between border-t border-mist-800 pt-2">
                    <span class="shrink-0 font-mono text-xs font-semibold">
                        {{ formatIDR(b.payout) }}
                    </span>
                    <div class="flex items-center gap-1.5 text-xs text-mist-300">
                        <fa-icon icon="pen-to-square" />
                        <span>Review</span>
                    </div>
                </div>
            </div>

            <!-- Pending Payouts -->
            <div
                v-for="b in pendingPayouts"
                :key="'payout-' + (b.id || b.bookingId)"
                class="group rounded-xs border-b-0 border-l-2 border-l-sky-500 p-3 transition hover:bg-mist-800/40">
                <div class="mb-1.5 flex items-center justify-between gap-2">
                    <span class="flex items-center gap-1.5 text-[11px] font-semibold text-sky-400">
                        Payout Pending
                    </span>
                    <span
                        class="py-0.2 rounded-md px-1.5 text-[10px] font-semibold capitalize"
                        :class="getPropertyStyle(b.propertyId)">
                        {{ b.propertyId }}
                    </span>
                </div>

                <div class="flex flex-col items-start justify-between gap-1">
                    <p class="text-sm leading-tight font-semibold text-mist-100">
                        {{ b.guestName }}
                    </p>
                    <p class="font-mono text-xs text-mist-400">
                        {{ formatDate(b.checkIn, { shortWeekday: true, shortMonth: true }) }} &bull;
                        {{ b.nights }} night(s)
                    </p>
                    <p class="text-xs text-mist-400">
                        {{ b.listing }}
                    </p>
                </div>

                <div
                    class="mt-2.5 flex items-center justify-between gap-2 border-t border-mist-800/60 pt-2">
                    <div class="shrink-0">
                        <span
                            class="group relative z-10 font-mono text-xs font-semibold text-mist-200">
                            {{ formatIDR(b.payout) }}
                        </span>
                        <div
                            class="pointer-events-none absolute bottom-full left-1/2 z-50 mt-1.5 w-52 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100">
                            <div
                                class="rounded-md border border-mist-800 bg-mist-900 p-2.5 text-xs text-mist-100 shadow-xl">
                                <div>
                                    <span class="mb-1 block font-semibold text-mist-200">
                                        {{ b.guestName }}
                                    </span>
                                    <span class="text-xs text-mist-400">
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
                                    </span>
                                </div>
                                <div
                                    v-if="b.status === 'Waiting for payment'"
                                    class="mb-1 rounded bg-amber-500/10 p-1 text-xs text-amber-300">
                                    Payment pending
                                </div>
                                <div
                                    v-if="b.notes"
                                    class="mt-1.5 border-t border-mist-800 pt-1.5 text-xs text-mist-300">
                                    {{ b.notes }}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="-mr-2 flex items-center">
                        <AppButton
                            variant="icon"
                            @click="emit('edit', b)">
                            <template #icon>
                                <fa-icon icon="pen-to-square" />
                            </template>
                        </AppButton>
                        <span class="text-mist-700">|</span>
                        <AppButton
                            color="lime"
                            variant="icon"
                            @click="emit('mark-complete', b)">
                            <template #icon>
                                <fa-icon icon="clipboard-check" />
                            </template>
                        </AppButton>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
