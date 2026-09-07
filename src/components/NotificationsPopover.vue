<script setup lang="ts">
import { computed } from 'vue';
import { formatIDR } from '@/utils/money';
import { getPropertyTheme } from '@/config/properties';
import type { Booking } from '@/types/booking';

const props = defineProps<{
    isOpen: boolean;
    pendingPayments: Booking[];
    pendingPayouts: Booking[];
}>();

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'mark-paid', booking: Booking): void;
    (e: 'mark-payout-received', booking: Booking): void;
    (e: 'edit', booking: Booking): void;
}>();

const totalCount = computed(() => props.pendingPayments.length + props.pendingPayouts.length);
</script>
<template>
    <div class="bg-mist-900 border-t border-mist-800 overflow-hidden">
        <div
            class="cursor-pointer flex items-center justify-between px-4 py-3 bg-mist-950/60"
            :class="{ 'border-b border-mist-800': isOpen }"
            @click="emit('close')">
            <div class="flex items-center gap-2">
                <fa-icon
                    icon="bell"
                    class="text-mist-400 text-sm" />
                <span class="font-bold text-sm text-mist-100">Notifications</span>
            </div>
            <span
                v-if="totalCount > 0"
                class="rounded bg-lime-500/20 px-2 py-0.5 text-[10px] font-bold text-lime-400 border border-lime-500/30">
                {{ totalCount }} New
            </span>
        </div>

        <div
            v-if="isOpen"
            class="divide-y divide-mist-800/60 p-2 space-y-1">
            <div
                v-if="totalCount === 0"
                class="py-10 text-center text-xs text-mist-500 space-y-1">
                <fa-icon
                    icon="circle-check"
                    class="text-2xl text-lime-500/40 mb-1" />
                <p class="font-medium text-mist-400">All caught up!</p>
                <p>No pending payments or unsettled payouts.</p>
            </div>

            <div
                v-for="b in pendingPayments"
                :key="b.id || b.bookingId"
                class="rounded border-l-2 border-l-amber-500 border-b-0 p-3 hover:bg-mist-800/40 transition group"
                @click="emit('edit', b)">
                <div class="flex items-center justify-between gap-2 mb-1.5">
                    <span class="flex items-center gap-1.5 text-[11px] font-bold text-amber-400">
                        Payment Pending
                    </span>
                    <span
                        class="capitalize rounded px-1.5 py-0.2 text-[10px] font-semibold"
                        :class="[
                            getPropertyTheme(b.propertyId).bg,
                            getPropertyTheme(b.propertyId).text,
                        ]">
                        {{ b.propertyId }}
                    </span>
                </div>

                <div class="flex flex-col items-start justify-between gap-2">
                    <p class="text-sm font-bold text-mist-100 leading-tight">
                        {{ b.guestName }}
                    </p>
                    <p class="text-xs text-mist-400">
                        {{ b.checkIn }} &bull; {{ b.nights }} night(s)
                    </p>
                    <p class="text-xs text-mist-400">
                        {{ b.listing }}
                    </p>
                </div>

                <div
                    class="mt-2.5 flex items-center justify-between border-t border-mist-800/60 pt-2">
                    <span class="text-xs font-mono font-bold shrink-0">
                        {{ formatIDR(b.payout) }}
                    </span>

                    <div class="flex items-center gap-2">
                        <button
                            type="button"
                            class="cursor-pointer text-xs text-mist-400 hover:text-mist-200"
                            title="Edit booking details"
                            @click="emit('edit', b)">
                            <fa-icon icon="pen-to-square" />
                        </button>

                        <!-- <button
                            type="button"
                            class="rounded bg-lime-500 px-2.5 py-1 text-[11px] font-bold text-mist-950 hover:bg-lime-400 transition"
                            @click="emit('mark-paid', b)">
                            Mark Paid
                        </button> -->
                    </div>
                </div>
            </div>

            <div
                v-for="b in pendingPayouts"
                :key="'payout-' + (b.id || b.bookingId)"
                class="rounded border-l-2 border-l-sky-500 border-b-0 p-3 hover:bg-mist-800/40 transition group">
                <div class="flex items-center justify-between gap-2 mb-1.5">
                    <span class="flex items-center gap-1.5 text-[11px] font-bold text-sky-400">
                        Payout Pending
                    </span>

                    <span
                        class="capitalize rounded px-1.5 py-0.2 text-[10px] font-semibold"
                        :class="[
                            getPropertyTheme(b.propertyId).bg,
                            getPropertyTheme(b.propertyId).text,
                        ]">
                        {{ b.propertyId }}
                    </span>
                </div>

                <div class="flex flex-col items-start justify-between gap-2">
                    <p class="text-sm font-bold text-mist-100 leading-tight">
                        {{ b.guestName }}
                    </p>
                    <p class="text-xs text-mist-400">
                        {{ b.checkIn }} &bull; {{ b.nights }} night(s)
                    </p>
                    <p class="text-xs text-mist-400">
                        {{ b.listing }}
                    </p>
                </div>

                <!-- 1-Click Reconciliation Button -->
                <div
                    class="mt-2.5 flex items-center justify-between gap-2 border-t border-mist-800/60 pt-2">
                    <!-- <button
                        type="button"
                        class="text-xs text-mist-400 hover:text-mist-200 mr-auto"
                        @click="emit('edit', b)">
                        Details
                    </button> -->
                    <span class="text-xs font-mono font-bold text-mist-200 shrink-0">
                        {{ formatIDR(b.payout) }}
                    </span>
                    <button
                        type="button"
                        class="text-xs text-mist-400 hover:text-mist-200"
                        title="Edit booking details"
                        @click="emit('edit', b)">
                        <fa-icon icon="pen-to-square" />
                    </button>
                    <!-- <button
                        type="button"
                        class="rounded border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-300 hover:bg-cyan-500/20 transition"
                        @click="emit('mark-payout-received', b)">
                        Confirm Received
                    </button> -->
                </div>
            </div>
        </div>
    </div>
</template>
