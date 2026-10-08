<script setup lang="ts">
import { computed } from 'vue';
import { getPropertyStyle } from '@/config/properties';
import type { Booking } from '@/types/booking';
import { getCurrentDate, getCurrentHour } from '@/utils/date';
import { formatIDR } from '@/utils/money';

const { bookings, today = getCurrentDate() } = defineProps<{
    bookings: Booking[];
    today?: string;
}>();

const emit = defineEmits<{
    checkout: [booking: Booking];
    edit: [booking: Booking];
}>();

// GUESTS CURRENTLY IN-HOUSE
// - Mid-stay guests (checkIn < today && checkOut > today)
// - Departures who have NOT yet checked out and it is still morning (< 12:00)
// - Arrivals who have already arrived (checked-in or after 15:00)
const inHouseGuests = computed(() =>
    bookings.filter((b) => {
        if (b.status === 'Unavailable') return false;
        // Mid-stay
        if (b.checkIn < getCurrentDate() && b.checkOut > getCurrentDate()) return true;
        // Today's departure: STAYS in-house ONLY if before 12:00 and not marked checked-out
        if (b.checkOut === getCurrentDate()) {
            return getCurrentHour() < 12 && b.status !== 'Checking-out';
        }
        // Today's arrival: MOVES to in-house after 15:00 or if already checked-in
        if (b.checkIn === getCurrentDate()) {
            return getCurrentHour() >= 15 || b.status === 'Checked-in';
        }

        return false;
    })
);
// GUESTS WHO HAVE LEFT TODAY
// - Check-out date is today AND (past 12:00 OR already marked Checked-out)
const departedGuests = computed(() =>
    bookings.filter((b) => {
        if (b.status === 'Unavailable') return false;
        if (b.checkOut === getCurrentDate()) {
            // Moves here if past noon OR if manually checked-out
            return getCurrentHour() >= 12 || b.status === 'Checking-out';
        }
        return false;
    })
);
</script>

<template>
    <div class="space-y-4 rounded-md border border-mist-800 bg-mist-900 p-5 shadow-md">
        <div class="flex items-center justify-between border-b border-mist-800 pb-3">
            <div>
                <h3 class="text-base font-semibold">Active Stays</h3>
                <p class="text-xs text-mist-400">Current in-house guests & today's departures</p>
            </div>
            <span class="rounded bg-mist-800 px-2 py-0.5 font-mono text-xs text-mist-300">
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
            <span class="text-[11px] font-semibold tracking-wider text-mist-400 uppercase">
                Currently In-House ({{ inHouseGuests.length }})
            </span>
            <div
                v-for="b in inHouseGuests"
                :key="b.id || b.bookingId"
                class="flex items-center justify-between rounded-md border border-mist-800 bg-mist-950/60 p-3 transition hover:border-mist-800">
                <!-- Guest Info -->
                <div class="min-w-0">
                    <div class="flex items-center gap-2">
                        <span class="truncate text-sm font-semibold">
                            {{ b.guestName }}
                        </span>
                        <span
                            class="py-0.2 rounded px-1.5 text-[10px] font-semibold capitalize"
                            :class="getPropertyStyle(b.propertyId)">
                            {{ b.propertyId }}
                        </span>

                        <!-- Urgency Tag if leaving today -->
                        <span
                            v-if="b.checkOut === today"
                            class="py-0.2 animate-pulse rounded border border-amber-500/30 bg-amber-500/15 px-1.5 text-[10px] font-semibold text-amber-300">
                            Due Out at 12:00
                        </span>
                    </div>

                    <p class="mt-1 text-xs text-mist-400">
                        {{ b.checkIn }} &rarr; {{ b.checkOut }} &bull; {{ b.nights }} night(s) via
                        {{ b.listing }}
                    </p>
                </div>

                <!-- Quick Checkout button if leaving today -->
                <div class="flex shrink-0 items-center gap-3">
                    <span class="font-mono text-xs font-semibold text-mist-200">
                        {{ formatIDR(b.payout) }}
                    </span>

                    <button
                        v-if="b.checkOut === today"
                        type="button"
                        class="rounded bg-amber-500 px-2.5 py-1 text-xs font-semibold text-mist-950 transition hover:bg-amber-400"
                        @click="emit('checkout', b)">
                        Check Out
                    </button>
                </div>
            </div>
        </div>

        <!-- Departed Guests (Moved here after 12:00 or upon clicking Check Out) -->
        <div
            v-if="departedGuests.length > 0"
            class="space-y-2 border-t border-mist-800 pt-2">
            <span
                class="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-mist-500 uppercase">
                <fa-icon
                    icon="circle-check"
                    class="text-xs text-lime-400" />
                Checked Out Today ({{ departedGuests.length }})
            </span>

            <div
                v-for="b in departedGuests"
                :key="'departed-' + (b.id || b.bookingId)"
                class="flex items-center justify-between rounded-md border border-mist-800 bg-mist-950/30 p-2.5 opacity-75">
                <div class="text-xs">
                    <span class="mr-2 font-semibold text-mist-300 line-through">
                        {{ b.guestName }}
                    </span>
                    <span class="text-mist-500">
                        {{ b.propertyId }} &bull; Room ready for turnover
                    </span>
                </div>

                <span class="font-mono text-[11px] text-lime-400"> Vacated </span>
            </div>
        </div>
    </div>
</template>
