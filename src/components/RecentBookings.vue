<script setup lang="ts">
import { computed } from 'vue';
import { getPropertyTheme } from '@/config/properties';
import { getStatusStyle } from '@/config/status';
import type { Booking } from '@/types/booking';
import { formatIDR } from '@/utils/money';
import { formatDate, getCurrentDate } from '@/utils/date';

const props = defineProps<{
    bookings: Booking[];
}>();

const emit = defineEmits<{
    (e: 'select-booking', booking: Booking): void;
}>();

const recentBookings = computed(() => {
    return [...props.bookings]
        .filter((b) => b.status !== 'Unavailable')
        .filter((b) => b.checkIn > getCurrentDate())
        .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
        .slice(0, 5);
});
</script>

<template>
    <div
        class="overflow-y-auto divide-y divide-mist-800 h-full flex flex-col items-stretch rounded-md border border-mist-800 bg-mist-900 shadow-md">
        <div
            v-if="recentBookings.length === 0"
            class="flex h-40 flex-col items-center justify-center text-center text-xs text-mist-500">
            <fa-icon
                icon="receipt"
                class="text-xl text-mist-700 mb-2" />
            <p>No recent bookings found.</p>
        </div>

        <div
            v-for="b in recentBookings"
            :key="b.id || b.bookingId"
            class="flex grow items-center justify-between rounded-md px-2.5 py-3.5 hover:bg-mist-800/40 transition cursor-pointer group"
            @click="emit('select-booking', b)">
            <!-- Guest & Property -->
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
                            class="capitalize rounded px-1.5 py-0.2 text-[10px] font-semibold shrink-0"
                            :class="[
                                getPropertyTheme(b.propertyId).bg,
                                getPropertyTheme(b.propertyId).text,
                            ]">
                            {{ b.propertyId }}
                        </span>
                    </div>
                    <p class="text-[11px] text-mist-400 mt-1">
                        {{ formatDate(b.checkIn, { shortMonth: true }) }} &bull;
                        {{ b.nights }} night(s) via
                        <span class="text-mist-300">{{ b.listing }}</span>
                    </p>
                </div>
            </div>
            <!-- Payout & Status -->
            <div class="text-right shrink-0">
                <span class="font-mono text-xs font-bold text-mist-100 block">
                    {{ formatIDR(b.payout) }}
                </span>
                <span
                    class="text-[10px] inline-block mt-1"
                    :class="getStatusStyle(b.status)">
                    {{ b.status }}
                </span>
            </div>
        </div>
    </div>
</template>
