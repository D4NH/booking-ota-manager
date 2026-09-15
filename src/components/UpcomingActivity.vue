<script setup lang="ts">
import { computed } from 'vue';
import { getPropertyTheme } from '@/config/properties';
import type { Booking } from '@/types/booking';
import { getCurrentDate } from '@/utils/date';

const { bookings, today = getCurrentDate() } = defineProps<{
    bookings: Booking[];
    today?: string;
}>();

const emit = defineEmits<{
    (e: 'select-booking', booking: Booking): void;
}>();

// Get upcoming arrivals & departures in the next 7 days
const upcomingEvents = computed(() => {
    // 7 days window
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 7);
    const maxDateStr = maxDate.toISOString().substring(0, 10);

    const events: Array<{
        type: 'arrival' | 'departure';
        date: string;
        booking: Booking;
        isToday: boolean;
    }> = [];

    bookings.forEach((b) => {
        if (b.status === 'Unavailable') return;

        // Check-ins (Arrivals)
        if (b.checkIn >= today && b.checkIn <= maxDateStr) {
            events.push({
                type: 'arrival',
                date: b.checkIn,
                booking: b,
                isToday: b.checkIn === today,
            });
        }

        // Check-outs (Departures)
        if (b.checkOut >= today && b.checkOut <= maxDateStr) {
            events.push({
                type: 'departure',
                date: b.checkOut,
                booking: b,
                isToday: b.checkOut === today,
            });
        }
    });

    // Sort chronologically
    return events.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
});
</script>

<template>
    <div
        class="flex flex-col justify-between rounded-md border border-mist-800 bg-mist-900 p-5 shadow-md">
        <div class="flex items-center justify-between border-b border-mist-800/80 pb-3">
            <div>
                <h3 class="text-base font-bold text-mist-100">Upcoming Activity</h3>
                <p class="text-xs text-mist-400">Scheduled arrivals & departures (Next 7 days)</p>
            </div>
            <RouterLink
                :to="{ name: 'bookings' }"
                class="text-xs font-semibold text-lime-400 hover:text-lime-300 transition">
                View all &rarr;
            </RouterLink>
        </div>

        <!-- Activity Feed List -->
        <div class="mt-3 flex-1 space-y-2.5 overflow-y-auto">
            <div
                v-if="upcomingEvents.length === 0"
                class="flex h-36 flex-col items-center justify-center text-center text-xs text-mist-500">
                <fa-icon
                    icon="calendar-check"
                    class="text-xl text-mist-700 mb-2" />
                <p>No arrivals or departures scheduled for the next 7 days.</p>
            </div>
            <!-- Event Rows -->
            <div
                v-for="(event, idx) in upcomingEvents"
                :key="idx"
                class="flex items-center justify-between rounded-md border border-mist-800/60 bg-mist-950/40 p-3 hover:bg-mist-800/40 transition cursor-pointer"
                @click="emit('select-booking', event.booking)">
                <!-- Left: Badge & Guest Info -->
                <div class="flex items-center gap-3 min-w-0">
                    <!-- Event Tag -->
                    <span
                        :class="[
                            'rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider shrink-0 border',
                            event.type === 'arrival'
                                ? event.isToday
                                    ? 'bg-lime-500/20 text-lime-400 border-lime-500/30 animate-pulse'
                                    : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-300 border-rose-500/20',
                        ]">
                        {{
                            event.isToday
                                ? event.type === 'arrival'
                                    ? 'In Today'
                                    : 'Out Today'
                                : event.type === 'arrival'
                                  ? 'Arrival'
                                  : 'Departure'
                        }}
                    </span>
                    <div class="truncate">
                        <div class="flex items-center gap-2">
                            <span class="font-bold text-sm text-mist-100 truncate">
                                {{ event.booking.guestName }}
                            </span>
                            <!-- Property Badge -->
                            <span
                                class="capitalize rounded px-1.5 py-0.2 text-[10px] font-semibold shrink-0"
                                :class="[
                                    getPropertyTheme(event.booking.propertyId).bg,
                                    getPropertyTheme(event.booking.propertyId).text,
                                ]">
                                {{ event.booking.propertyId }}
                            </span>
                        </div>
                        <p class="text-xs text-mist-400 mt-1">
                            {{ event.date }} &bull; {{ event.booking.nights }} night(s)
                        </p>
                    </div>
                </div>

                <!-- Channel Pill -->
                <span
                    class="rounded bg-mist-800/80 px-2 py-1 text-xs font-medium text-mist-300 shrink-0">
                    {{ event.booking.listing }}
                </span>
            </div>
        </div>
    </div>
</template>
