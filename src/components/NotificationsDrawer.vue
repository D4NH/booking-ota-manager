<script setup lang="ts">
import { computed } from 'vue';
import { formatIDR } from '@/utils/money';
import { getPropertyStyle } from '@/config/properties';
import type { Booking, StagedBooking } from '@/types/booking';

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
    <div class="bg-mist-900 border-t border-mist-800 overflow-hidden">
        <div
            class="cursor-pointer flex items-center justify-between px-4 py-3 bg-mist-950/50"
            :class="{ 'border-b border-mist-800': !isCollapsed }"
            @click="emit('close')">
            <div class="flex items-center gap-2">
                <fa-icon
                    icon="bell"
                    class="text-mist-400 text-sm" />
                <span class="font-semibold text-sm text-mist-100">Notifications</span>
            </div>
            <span
                v-if="totalCount > 0"
                class="rounded-md bg-lime-500/20 px-2 py-0.5 text-[10px] font-semibold text-lime-400 border border-lime-500/30">
                {{ totalCount }} New
            </span>
        </div>

        <div
            v-if="!isCollapsed"
            class="divide-y divide-mist-800/60 p-2 space-y-1 overflow-y-auto max-h-[70vh]">
            <!-- Empty State -->
            <div
                v-if="totalCount === 0"
                class="py-10 text-center text-xs text-mist-500 space-y-1">
                <fa-icon
                    icon="circle-check"
                    class="text-xl text-lime-500/40 mb-1" />
                <p class="font-medium text-mist-400">All caught up!</p>
                <p>No incoming bookings, pending payments, or unsettled payouts.</p>
            </div>

            <!-- Incoming Bookings Awaiting Approval -->
            <div
                v-for="staged in stagedBookings"
                :key="staged.id || staged.bookingId"
                class="rounded-xs border-l-2 border-l-purple-500 border-b-0 p-3 bg-purple-950/10 hover:bg-mist-800/50 transition group">
                <div class="flex items-center justify-between gap-2 mb-1.5">
                    <span
                        class="flex items-center gap-1.5 text-[11px] font-semibold text-purple-400">
                        <span class="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse"></span>
                        New Booking Staged
                    </span>
                    <span
                        class="capitalize rounded-md px-1.5 py-0.2 text-[10px] font-semibold"
                        :class="getPropertyStyle(staged.propertyId)">
                        {{ staged.propertyId }}
                    </span>
                </div>

                <div class="flex flex-col items-start justify-between gap-1">
                    <p class="text-sm font-semibold text-mist-100 leading-tight">
                        {{ staged.guestName }}
                    </p>
                    <p class="text-xs text-mist-400 font-mono">
                        {{ staged.checkIn }} &bull; {{ staged.nights }} night(s)
                    </p>
                    <p class="text-xs text-mist-400">
                        {{ staged.listing }} &bull;
                        <span class="font-mono text-mist-500">Ref: {{ staged.bookingId }}</span>
                    </p>
                </div>

                <div
                    class="mt-2.5 flex items-center justify-between border-t border-mist-800/80 pt-2">
                    <span class="text-xs font-mono font-bold text-lime-400 shrink-0">
                        {{ formatIDR(staged.payout) }}
                    </span>
                    <button
                        type="button"
                        class="bg-lime-400 hover:bg-lime-300 text-mist-950 text-[11px] font-bold px-2.5 py-1 rounded transition shadow-sm cursor-pointer flex items-center gap-1"
                        title="Review and approve booking"
                        @click.stop="emit('open-staging', staged)">
                        <span>Review</span>
                        <span class="font-mono">&rarr;</span>
                    </button>
                </div>
            </div>

            <!-- Pending Payments -->
            <div
                v-for="b in pendingPayments"
                :key="b.id || b.bookingId"
                class="rounded-xs border-l-2 border-l-amber-500 border-b-0 p-3 hover:bg-mist-800/40 transition group"
                @click="emit('edit', b)">
                <div class="flex items-center justify-between gap-2 mb-1.5">
                    <span
                        class="flex items-center gap-1.5 text-[11px] font-semibold text-amber-400">
                        Payment Pending
                    </span>
                    <span
                        class="capitalize rounded-md px-1.5 py-0.2 text-[10px] font-semibold"
                        :class="getPropertyStyle(b.propertyId)">
                        {{ b.propertyId }}
                    </span>
                </div>
                <div class="flex flex-col items-start justify-between gap-1">
                    <p class="text-sm font-semibold text-mist-100 leading-tight">
                        {{ b.guestName }}
                    </p>
                    <p class="text-xs text-mist-400 font-mono">
                        {{ b.checkIn }} &bull; {{ b.nights }} night(s)
                    </p>
                    <p class="text-xs text-mist-400">
                        {{ b.listing }}
                    </p>
                </div>
                <div class="mt-2.5 flex items-center justify-between border-t border-mist-800 pt-2">
                    <span class="text-xs font-mono font-semibold shrink-0">
                        {{ formatIDR(b.payout) }}
                    </span>
                    <div class="flex items-center gap-2">
                        <button
                            type="button"
                            class="cursor-pointer text-xs text-mist-400 hover:text-mist-200"
                            title="Edit booking details"
                            @click.stop="emit('edit', b)">
                            <fa-icon icon="pen-to-square" />
                        </button>
                    </div>
                </div>
            </div>

            <!-- Pending Payouts -->
            <div
                v-for="b in pendingPayouts"
                :key="'payout-' + (b.id || b.bookingId)"
                class="rounded-xs border-l-2 border-l-sky-500 border-b-0 p-3 hover:bg-mist-800/40 transition group">
                <div class="flex items-center justify-between gap-2 mb-1.5">
                    <span class="flex items-center gap-1.5 text-[11px] font-semibold text-sky-400">
                        Payout Pending
                    </span>
                    <span
                        class="capitalize rounded-md px-1.5 py-0.2 text-[10px] font-semibold"
                        :class="getPropertyStyle(b.propertyId)">
                        {{ b.propertyId }}
                    </span>
                </div>

                <div class="flex flex-col items-start justify-between gap-1">
                    <p class="text-sm font-semibold text-mist-100 leading-tight">
                        {{ b.guestName }}
                    </p>
                    <p class="text-xs text-mist-400 font-mono">
                        {{ b.checkIn }} &bull; {{ b.nights }} night(s)
                    </p>
                    <p class="text-xs text-mist-400">
                        {{ b.listing }}
                    </p>
                </div>

                <div
                    class="mt-2.5 flex items-center justify-between gap-2 border-t border-mist-800/60 pt-2">
                    <span class="text-xs font-mono font-semibold text-mist-200 shrink-0">
                        {{ formatIDR(b.payout) }}
                    </span>
                    <div class="flex items-center gap-2">
                        <button
                            type="button"
                            class="cursor-pointer text-mist-400 hover:text-mist-100"
                            @click.stop="emit('edit', b)">
                            <fa-icon icon="pen-to-square" />
                        </button>
                        <span class="text-mist-700">|</span>
                        <button
                            type="button"
                            class="cursor-pointer text-mist-400 hover:text-mist-100"
                            @click.stop="emit('mark-complete', b)">
                            <fa-icon icon="clipboard-check" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
