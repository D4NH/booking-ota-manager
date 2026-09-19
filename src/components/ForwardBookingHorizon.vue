<!-- src/components/ForwardBookingHorizon.vue -->
<script setup lang="ts">
import { computed } from 'vue';
import type { Booking } from '@/types/booking';
import type { Property, PropertyId } from '@/types/property';
import { formatIDR } from '@/utils/money';
import { getCurrentDate, formatDate, parseISODate } from '@/utils/date';

import CardTitle from '@/components/CardTitle.vue';

interface Props {
    bookings: Booking[];
    property: Property;
    propertyId?: PropertyId | 'all';
    today?: string;
}

interface HorizonWindow {
    label: string;
    sublabel: string;
    rangeText: string;
    bookedNights: number;
    capacityNights: number;
    occupancyPace: number;
    confirmedRevenue: number;
    statusText: string;
    statusClass: string;
    barColorClass: string;
}

const { bookings, property, propertyId = 'all', today = getCurrentDate() } = defineProps<Props>();

const MS_PER_DAY = 86_400_000;

const horizonWindows = computed<HorizonWindow[]>(() => {
    const activePropId = property?.id || (propertyId !== 'all' ? propertyId : null);
    const baseDate = parseISODate(today);
    const baseMs = Date.UTC(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());

    const buckets = [
        { label: '0-30 Days', sublabel: 'Immediate', startDayOffset: 0, endDayOffset: 30 },
        { label: '31-60 Days', sublabel: 'Near-Term', startDayOffset: 30, endDayOffset: 60 },
        { label: '61-90 Days', sublabel: 'Far Horizon', startDayOffset: 60, endDayOffset: 90 },
    ];

    return buckets.map((bucket) => {
        const windowStartMs = baseMs + bucket.startDayOffset * MS_PER_DAY;
        const windowEndMs = baseMs + bucket.endDayOffset * MS_PER_DAY;

        const startDateStr = new Date(windowStartMs).toISOString().slice(0, 10);
        const endDateStr = new Date(windowEndMs - MS_PER_DAY).toISOString().slice(0, 10);

        const rangeText = `${formatDate(startDateStr, { shortMonth: true })} → ${formatDate(endDateStr, { shortMonth: true })}`;

        let bookedNights = 0;
        let confirmedRevenue = 0;

        for (const b of bookings) {
            if (b.status === 'Unavailable' || b.status === 'No show') continue;
            if (activePropId && b.propertyId !== activePropId) continue;

            const checkInMs = parseISODate(b.checkIn).getTime();
            const checkOutMs = parseISODate(b.checkOut).getTime();

            // Check boundary overlap
            const overlapStart = Math.max(checkInMs, windowStartMs);
            const overlapEnd = Math.min(checkOutMs, windowEndMs);

            if (overlapStart < overlapEnd) {
                const nightsInWindow = Math.round((overlapEnd - overlapStart) / MS_PER_DAY);
                bookedNights += nightsInWindow;

                // Prorate revenue proportionally to nights residing in this window
                const totalBookingNights = b.nights || 1;
                const proratedPayout = Math.round((b.payout / totalBookingNights) * nightsInWindow);
                confirmedRevenue += proratedPayout;
            }
        }

        const capacityNights = 30; // 30 available room-nights per unit in a 30-day window
        const occupancyPace = Math.min(100, Math.round((bookedNights / capacityNights) * 100));

        // STR pacing benchmark logic
        let statusText = 'Low Pace';
        let statusClass = 'text-amber-400 bg-amber-500/10 border-amber-500/30';
        let barColorClass = 'bg-amber-400';

        if (bucket.startDayOffset === 0) {
            // 0-30d benchmark
            if (occupancyPace >= 70) {
                statusText = 'Strong Pace';
                statusClass = 'text-lime-400 bg-lime-500/10 border-lime-500/30';
                barColorClass = 'bg-lime-400';
            } else if (occupancyPace >= 45) {
                statusText = 'On Track';
                statusClass = 'text-sky-400 bg-sky-500/10 border-sky-500/30';
                barColorClass = 'bg-sky-400';
            }
        } else if (bucket.startDayOffset === 30) {
            // 31-60d benchmark
            if (occupancyPace >= 45) {
                statusText = 'Strong Pace';
                statusClass = 'text-lime-400 bg-lime-500/10 border-lime-500/30';
                barColorClass = 'bg-lime-400';
            } else if (occupancyPace >= 25) {
                statusText = 'On Track';
                statusClass = 'text-sky-400 bg-sky-500/10 border-sky-500/30';
                barColorClass = 'bg-sky-400';
            }
        } else {
            // 61-90d benchmark
            if (occupancyPace >= 25) {
                statusText = 'Strong Pace';
                statusClass = 'text-lime-400 bg-lime-500/10 border-lime-500/30';
                barColorClass = 'bg-lime-400';
            } else if (occupancyPace >= 10) {
                statusText = 'On Track';
                statusClass = 'text-sky-400 bg-sky-500/10 border-sky-500/30';
                barColorClass = 'bg-sky-400';
            }
        }

        return {
            label: bucket.label,
            sublabel: bucket.sublabel,
            rangeText,
            bookedNights,
            capacityNights,
            occupancyPace,
            confirmedRevenue,
            statusText,
            statusClass,
            barColorClass,
        };
    });
});

const totalConfirmed90dRevenue = computed(() =>
    horizonWindows.value.reduce((sum, w) => sum + w.confirmedRevenue, 0)
);
const total90dBookedNights = computed(() =>
    horizonWindows.value.reduce((sum, w) => sum + w.bookedNights, 0)
);
</script>

<template>
    <div class="flex flex-col h-full min-h-0">
        <div class="flex items-start justify-between">
            <CardTitle>
                <template #title>Booking Horizon</template>
                <template #subtitle>OTB occupancy & pipeline pacing for the next 90 days</template>
            </CardTitle>
        </div>

        <div
            class="flex-1 rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md flex flex-col justify-between space-y-4">
            <!-- 30-Day Window Cards -->
            <div class="grid grid-cols-1 md:grid-cols-3 divide-x divide-mist-800">
                <div
                    v-for="win in horizonWindows"
                    :key="win.label"
                    class="first:pl-0 last:pr-0 px-4 space-y-2.5 flex flex-col justify-between">
                    <!-- Window Header -->
                    <div class="flex items-start justify-between">
                        <div>
                            <span class="text-xs font-bold text-mist-100 block">
                                {{ win.label }}
                            </span>
                            <span class="text-xs text-mist-500 font-medium">
                                {{ win.rangeText }}
                            </span>
                        </div>
                        <span
                            class="rounded-sm px-1.5 py-0.5 uppercase font-medium text-xs text-nowrap"
                            :class="win.statusClass">
                            {{ win.statusText }}
                        </span>
                    </div>

                    <!-- Pace Metric & Progress Bar -->
                    <div class="space-y-1">
                        <div class="flex items-baseline justify-between font-mono">
                            <span class="text-lg font-bold text-mist-100">
                                {{ win.occupancyPace }}%
                            </span>
                            <span class="text-xs text-mist-400">
                                {{ win.bookedNights }} / {{ win.capacityNights }} nights
                            </span>
                        </div>

                        <div class="h-1.5 w-full rounded-full bg-mist-900 overflow-hidden">
                            <div
                                class="h-full rounded-full transition-all duration-500 ease-out"
                                :class="win.barColorClass"
                                :style="{ width: `${win.occupancyPace}%` }" />
                        </div>
                    </div>

                    <!-- Revenue Secured -->
                    <div
                        class="pt-2 border-t border-mist-800 flex items-center justify-between text-xs">
                        <span class="text-mist-500 text-[11px]">Confirmed:</span>
                        <span class="font-mono font-bold text-mist-200">
                            {{ formatIDR(win.confirmedRevenue) }}
                        </span>
                    </div>
                </div>
            </div>

            <!-- 90-Day Summary Footer -->
            <div class="border-t border-mist-800 pt-3 flex items-center justify-between text-xs">
                <div class="flex items-center gap-2">
                    <span class="text-mist-400">Total 90-Day Pipeline:</span>
                    <span class="font-mono font-bold text-lime-400">
                        {{ total90dBookedNights }} nights booked
                    </span>
                </div>

                <div class="flex items-center gap-2">
                    <span class="text-mist-500">Secured OTB Revenue:</span>
                    <span class="font-mono text-sm font-bold text-mist-100">
                        {{ formatIDR(totalConfirmed90dRevenue) }}
                    </span>
                </div>
            </div>
        </div>
    </div>
</template>
