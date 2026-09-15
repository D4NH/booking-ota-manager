<script setup lang="ts">
import { computed } from 'vue';
import { PROPERTY_LIST } from '@/config/properties';
import type { Booking } from '@/types/booking';
import { getCurrentDate } from '@/utils/date';

const { bookings, today = getCurrentDate() } = defineProps<{
    bookings: Booking[];
    today?: string;
}>();

const propertyRack = computed(() =>
    PROPERTY_LIST.map((property) => {
        const propBookings = bookings.filter(
            (b) => b.propertyId === property.id && b.status !== 'Unavailable'
        );

        // 1. In-house guest today (checkIn <= today < checkOut)
        const currentStay = propBookings.find((b) => today >= b.checkIn && today < b.checkOut);

        // 2. Arriving today (checkIn === today)
        const arrivingToday = propBookings.find((b) => b.checkIn === today);

        // 3. Departing today (checkOut === today)
        const departingToday = propBookings.find((b) => b.checkOut === today);

        // 4. Next upcoming booking (if currently vacant)
        const nextUpcoming = propBookings
            .filter((b) => b.checkIn > today)
            .sort((a, b) => a.checkIn.localeCompare(b.checkIn))[0];

        // Determine Operational State
        let state: 'occupied' | 'turnover' | 'arriving' | 'vacant' = 'vacant';
        let statusLabel = 'Vacant';
        let statusBadgeClass = 'border-mist-800 bg-mist-800 text-mist-300';
        let housekeeping = { label: 'Ready', class: 'text-mist-400 bg-mist-950' };

        if (arrivingToday && departingToday) {
            state = 'turnover';
            statusLabel = 'Same-day Turnover';
            statusBadgeClass = 'border-amber-500/40 bg-amber-500/15 text-amber-300';
            housekeeping = { label: 'Clean by 14:00', class: 'text-amber-300 bg-amber-500/10' };
        } else if (arrivingToday) {
            state = 'arriving';
            statusLabel = 'Check-in Today';
            statusBadgeClass = 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300';
            housekeeping = { label: 'Ready for Guest', class: 'text-cyan-300 bg-cyan-500/10' };
        } else if (currentStay) {
            state = 'occupied';
            statusLabel = 'Occupied';
            statusBadgeClass = 'border-lime-500/40 bg-lime-500/15 text-lime-400';
            housekeeping = { label: 'In House', class: 'text-lime-400 bg-lime-500/10' };
        }

        return {
            property,
            state,
            statusLabel,
            statusBadgeClass,
            housekeeping,
            currentStay,
            arrivingToday,
            departingToday,
            nextUpcoming,
        };
    })
);
</script>

<template>
    <div class="rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md">
        <div class="flex items-center justify-between mb-4 border-b border-mist-800 pb-2.5">
            <div class="flex items-center gap-2">
                <h3 class="text-sm font-bold text-mist-100 uppercase tracking-wider">
                    Live Unit Rack
                </h3>
                <span class="rounded-full bg-mist-800 px-2 py-0.5 text-[10px] text-mist-400">
                    Real-time Availability
                </span>
            </div>
            <span class="text-xs text-mist-500">Live for {{ today }}</span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
                v-for="item in propertyRack"
                :key="item.property.id"
                class="flex flex-col justify-between rounded-md border border-mist-800 bg-mist-950/50 p-3.5 hover:border-mist-800 transition">
                <!-- Unit Name & Status Badge -->
                <div>
                    <div class="flex items-center justify-between gap-2">
                        <div class="flex items-center gap-2 truncate">
                            <span
                                class="h-2 w-2 rounded-full shrink-0"
                                :class="[
                                    item.state === 'occupied'
                                        ? 'bg-lime-400'
                                        : item.state === 'turnover' || item.state === 'arriving'
                                          ? 'bg-amber-400 animate-pulse'
                                          : 'bg-mist-600',
                                ]" />
                            <h4 class="font-bold text-sm text-mist-100 truncate">
                                {{ item.property.name }}
                            </h4>
                        </div>

                        <span
                            :class="[
                                'rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border shrink-0',
                                item.statusBadgeClass,
                            ]">
                            {{ item.statusLabel }}
                        </span>
                    </div>

                    <!-- Live Guest Info -->
                    <div class="mt-2.5 min-h-11">
                        <!-- Currently staying -->
                        <div
                            v-if="item.currentStay"
                            class="text-xs">
                            <p class="font-semibold text-mist-200 truncate">
                                {{ item.currentStay.guestName }}
                            </p>
                            <p class="text-[11px] text-mist-400 mt-1">
                                Departs {{ item.currentStay.checkOut }} &bull; via
                                {{ item.currentStay.listing }}
                            </p>
                        </div>

                        <!-- Arriving Today -->
                        <div
                            v-else-if="item.arrivingToday"
                            class="text-xs">
                            <p class="font-semibold text-cyan-300 truncate">
                                {{ item.arrivingToday.guestName }}
                            </p>
                            <p class="text-[11px] text-mist-400 mt-1">
                                Arriving today &bull; {{ item.arrivingToday.nights }} night(s)
                            </p>
                        </div>

                        <!-- Vacant but has next guest -->
                        <div
                            v-else-if="item.nextUpcoming"
                            class="text-xs text-mist-400">
                            <p class="text-mist-500 italic text-[11px]">Vacant now</p>
                            <p class="text-[11px] text-mist-300 mt-1 truncate">
                                Next: {{ item.nextUpcoming.checkIn }} ({{
                                    item.nextUpcoming.guestName
                                }})
                            </p>
                        </div>

                        <!-- Fully vacant -->
                        <div
                            v-else
                            class="text-xs text-mist-500 italic py-1">
                            No active or upcoming reservations
                        </div>
                    </div>
                </div>

                <!-- Housekeeping -->
                <div
                    class="mt-3 flex items-center justify-between border-t border-mist-800 pt-2 text-[11px]">
                    <span class="text-mist-500">Status:</span>
                    <span :class="['rounded px-1.5 py-0.5 font-medium', item.housekeeping.class]">
                        {{ item.housekeeping.label }}
                    </span>
                </div>
            </div>
        </div>
    </div>
</template>
