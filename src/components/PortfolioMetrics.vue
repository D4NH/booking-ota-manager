<script setup lang="ts">
import { computed } from 'vue';
import { formatIDR } from '@/utils/money';
import type { Booking } from '@/types/booking';
import type { Property } from '@/types/property';

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
        if (b.status === 'Unavailable' || b.status === 'No show') continue;
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
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- Revenue -->
        <div class="rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md space-y-1">
            <h3 class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                Portfolio Revenue
            </h3>
            <p class="font-mono text-lg font-bold text-white">
                {{ formatIDR(metrics.revenue) }}
            </p>
            <p class="text-xs text-mist-500">Total earnings in {{ year }}</p>
        </div>

        <!-- Active Listings -->
        <div class="rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md space-y-1">
            <h3 class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                Active Listings
            </h3>
            <p class="font-mono text-lg font-bold text-mist-100">
                <span class="text-lime-400">{{ metrics.activeUnits }}</span>
                <span class="text-mist-500 text-lg"> / {{ properties.length }} Units</span>
            </p>
            <p class="text-xs text-mist-500">Generating revenue</p>
        </div>

        <!-- ADR -->
        <div class="rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md space-y-1">
            <h3 class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                Average Daily Rate
            </h3>
            <p class="font-mono text-lg font-bold text-white">
                {{ formatIDR(metrics.adr) }}
            </p>
            <p class="text-xs text-mist-500">Across {{ metrics.nights }} booked nights</p>
        </div>

        <!-- Annual Occupancy -->
        <div class="rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md space-y-1">
            <h3 class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                Annual Occupancy
            </h3>
            <p class="font-mono text-lg font-bold text-lime-400">{{ metrics.occupancy }}%</p>
            <p class="text-xs text-mist-500">
                {{ metrics.nights }} / {{ metrics.totalCapacity }} room nights
            </p>
        </div>
    </div>
</template>
