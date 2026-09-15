<script setup lang="ts">
import { computed } from 'vue';
import { useDateKeys } from '@/composables/useDateKeys';
import { getPropertyTheme } from '@/config/properties';
import type { Booking } from '@/types/booking';
import { getCurrentDate } from '@/utils/date';
import { formatIDR } from '@/utils/money';

const { currentDay, currentHour } = useDateKeys();

const { bookings, today = getCurrentDate() } = defineProps<{
    bookings: Booking[];
    today?: string;
}>();

const emit = defineEmits<{
    (e: 'checkout', booking: Booking): void;
    (e: 'edit', booking: Booking): void;
}>();

// GUESTS CURRENTLY IN-HOUSE
// - Mid-stay guests (checkIn < today && checkOut > today)
// - Departures who have NOT yet checked out and it is still morning (< 12:00)
// - Arrivals who have already arrived (checked-in or after 15:00)
const inHouseGuests = computed(() =>
    bookings.filter((b) => {
        if (b.status === 'Unavailable') return false;

        // Mid-stay
        if (b.checkIn < currentDay.value && b.checkOut > currentDay.value) return true;

        // Today's departure: STAYS in-house ONLY if before 12:00 and not marked checked-out
        if (b.checkOut === currentDay.value) {
            return currentHour.value < 12 && b.status !== 'Checking-out';
        }

        // Today's arrival: MOVES to in-house after 15:00 or if already checked-in
        if (b.checkIn === currentDay.value) {
            return currentHour.value >= 15 || b.status === 'Checked-in';
        }

        return false;
    })
);
// GUESTS WHO HAVE LEFT TODAY
// - Check-out date is today AND (past 12:00 OR already marked Checked-out)
const departedGuests = computed(() =>
    bookings.filter((b) => {
        if (b.status === 'Unavailable') return false;

        if (b.checkOut === currentDay.value) {
            // Moves here if past noon OR if manually checked-out
            return currentHour.value >= 12 || b.status === 'Checking-out';
        }
        return false;
    })
);
</script>

<template>
    <div class="rounded-md border border-mist-800 bg-mist-900 p-5 shadow-md space-y-4">
        <div class="flex items-center justify-between border-b border-mist-800 pb-3">
            <div>
                <h3 class="text-base font-bold text-mist-100">Active Stays</h3>
                <p class="text-xs text-mist-400">Current in-house guests & today's departures</p>
            </div>
            <span class="rounded bg-mist-800 px-2 py-0.5 text-xs font-mono text-mist-300">
                {{ inHouseGuests.length }} In-House
            </span>
        </div>

        <div
            v-if="inHouseGuests.length === 0 && departedGuests.length === 0"
            class="py-8 text-center text-xs text-mist-500 italic">
            No active guests in-house today.
        </div>

        <!-- In-House Guests (Includes guests leaving today until 12:00) -->
        <div
            v-if="inHouseGuests.length > 0"
            class="space-y-2">
            <span class="text-[11px] font-bold uppercase tracking-wider text-mist-400">
                Currently In-House ({{ inHouseGuests.length }})
            </span>
            <div
                v-for="b in inHouseGuests"
                :key="b.id || b.bookingId"
                class="rounded-md border border-mist-800 bg-mist-950/60 p-3 flex items-center justify-between hover:border-mist-700 transition">
                <!-- Guest Info -->
                <div class="min-w-0">
                    <div class="flex items-center gap-2">
                        <span class="font-bold text-sm text-mist-100 truncate">
                            {{ b.guestName }}
                        </span>
                        <span
                            class="capitalize rounded px-1.5 py-0.2 text-[10px] font-semibold"
                            :class="[
                                getPropertyTheme(b.propertyId).bg,
                                getPropertyTheme(b.propertyId).text,
                            ]">
                            {{ b.propertyId }}
                        </span>

                        <!-- Urgency Tag if leaving today -->
                        <span
                            v-if="b.checkOut === today"
                            class="rounded bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.2 text-[10px] font-bold text-amber-300 animate-pulse">
                            Due Out at 12:00
                        </span>
                    </div>

                    <p class="text-xs text-mist-400 mt-1">
                        {{ b.checkIn }} &rarr; {{ b.checkOut }} &bull; {{ b.nights }} night(s) via
                        {{ b.listing }}
                    </p>
                </div>

                <!-- Quick Checkout button if leaving today -->
                <div class="flex items-center gap-3 shrink-0">
                    <span class="font-mono text-xs font-bold text-mist-200">{{
                        formatIDR(b.payout)
                    }}</span>

                    <button
                        v-if="b.checkOut === today"
                        type="button"
                        class="rounded bg-amber-500 hover:bg-amber-400 px-2.5 py-1 text-xs font-bold text-mist-950 transition"
                        @click="emit('checkout', b)">
                        Check Out
                    </button>
                </div>
            </div>
        </div>

        <!-- Departed Guests (Moved here after 12:00 or upon clicking Check Out) -->
        <div
            v-if="departedGuests.length > 0"
            class="pt-2 border-t border-mist-800/80 space-y-2">
            <span
                class="text-[11px] font-bold uppercase tracking-wider text-mist-500 flex items-center gap-1.5">
                <fa-icon
                    icon="circle-check"
                    class="text-xs text-lime-400" />
                Checked Out Today ({{ departedGuests.length }})
            </span>

            <div
                v-for="b in departedGuests"
                :key="'departed-' + (b.id || b.bookingId)"
                class="rounded-md border border-mist-800/60 bg-mist-950/30 p-2.5 flex items-center justify-between opacity-75">
                <div class="text-xs">
                    <span class="font-semibold text-mist-300 line-through mr-2">{{
                        b.guestName
                    }}</span>
                    <span class="text-mist-500">
                        {{ b.propertyId }} &bull; Room ready for turnover
                    </span>
                </div>

                <span class="text-[11px] font-mono text-lime-400"> Vacated </span>
            </div>
        </div>
    </div>
</template>
