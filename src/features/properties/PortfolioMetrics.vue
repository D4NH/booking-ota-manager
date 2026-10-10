<script setup lang="ts">
import { computed } from 'vue';
import type { Booking } from '@/types/booking';
import type { Property } from '@/types/property';
import { formatIDR } from '@/utils/money';

interface Props {
    bookings: Booking[];
    properties: Property[];
    year?: number;
}

const { bookings, properties, year = new Date().getFullYear() } = defineProps<Props>();

const metrics = computed(() => {
    const yearPrefix = String(year);
    const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    const daysInYear = isLeapYear ? 366 : 365;

    let revenue = 0;
    let nights = 0;
    const activePropertyIds = new Set<string>();

    for (const b of bookings) {
        if (b.status === 'Unavailable') continue;
        if (!b.checkIn || !b.checkIn.startsWith(yearPrefix)) continue;

        revenue += b.payout || 0;
        nights += b.nights || 0;
        activePropertyIds.add(b.propertyId);
    }

    const activeUnits = activePropertyIds.size;
    const totalCapacity = daysInYear * (activeUnits || properties.length || 1);
    const adr = nights > 0 ? Math.round(revenue / nights) : 0;
    const revPar = totalCapacity > 0 ? Math.round(revenue / totalCapacity) : 0;
    const occupancy =
        totalCapacity > 0 ? Math.min(100, Math.round((nights / totalCapacity) * 100)) : 0;

    return {
        revenue,
        nights,
        adr,
        revPar,
        occupancy,
        activeUnits,
        totalCapacity,
    };
});
</script>

<template>
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <!-- Revenue -->
        <div class="space-y-1 rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md">
            <h3 class="text-xs font-semibold tracking-wider text-mist-400 uppercase">
                Portfolio Revenue
            </h3>
            <p class="font-mono text-lg font-extrabold text-mist-200">
                {{ formatIDR(metrics.revenue) }}
            </p>
            <p class="text-xs text-mist-500">Total earnings in {{ year }}</p>
        </div>

        <!-- Active Listings -->
        <div class="space-y-1 rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md">
            <h3 class="text-xs font-semibold tracking-wider text-mist-400 uppercase">
                Active Listings
            </h3>
            <p class="flex items-center gap-1 font-mono text-lg font-extrabold text-mist-200">
                <span class="text-lime-400">{{ metrics.activeUnits }}</span>
                <span class="text-sm">/</span>
                <span class="text-lg">{{ properties.length }} Units</span>
            </p>
            <p class="text-xs text-mist-500">Generating revenue</p>
        </div>

        <!-- ADR -->
        <div class="space-y-1 rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md">
            <h3 class="text-xs font-semibold tracking-wider text-mist-400 uppercase">
                Average Daily Rate
            </h3>
            <p class="font-mono text-lg font-extrabold text-mist-200">
                {{ formatIDR(metrics.adr) }}
            </p>
            <p class="text-xs text-mist-500">Across {{ metrics.nights }} booked nights</p>
        </div>

        <!-- Annual Occupancy -->
        <div class="space-y-1 rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md">
            <h3 class="text-xs font-semibold tracking-wider text-mist-400 uppercase">
                Annual Occupancy
            </h3>
            <p class="flex items-center gap-1 font-mono text-lg font-extrabold text-lime-400">
                <span>
                    {{ metrics.occupancy }}
                </span>
                <span> %</span>
            </p>
            <p class="text-xs text-mist-500">
                {{ metrics.nights }} / {{ metrics.totalCapacity }} room nights
            </p>
        </div>
    </div>
</template>
