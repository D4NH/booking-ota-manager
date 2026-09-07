<script setup lang="ts">
import { toRef } from 'vue';
import type { Booking } from '@/types/booking';
import type { Property } from '@/types/property';
import { useMonthlyMetrics } from '@/composables/useMonthlyMetrics';
import { formatIDR } from '@/utils/money';

const props = defineProps<{
    bookings: Booking[];
    properties: Property[];
    propertyId: string;
}>();

const bookingsRef = toRef(props, 'bookings');
const propertiesRef = toRef(props, 'properties');

const { occupancyPercentage, totalPayout, totalBookingsCount } = useMonthlyMetrics(
    bookingsRef,
    propertiesRef,
    {
        propertyId: props.propertyId,
    }
);
</script>

<template>
    <div class="rounded-lg border border-mist-800 bg-mist-900 p-4 shadow-md">
        <div class="flex justify-around w-full space-x-4">
            <div class="flex flex-col items-center space-y-1">
                <span class="text-xs text-mist-400">Occupancy</span>
                <span class="text-lg font-bold text-lime-400"> {{ occupancyPercentage }} % </span>
            </div>
            <div class="flex flex-col items-center space-y-1">
                <span class="text-xs text-mist-400">Revenue</span>
                <span class="text-lg font-mono font-bold text-mist-100">
                    {{ formatIDR(totalPayout) }}
                </span>
            </div>
            <div class="flex flex-col items-center space-y-1">
                <span class="text-xs text-mist-400">Bookings</span>
                <span class="text-lg font-bold text-mist-100">
                    {{ totalBookingsCount }}
                </span>
            </div>
        </div>
    </div>
</template>
