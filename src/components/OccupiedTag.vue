<script setup lang="ts">
import { toRef } from 'vue';
import type { Booking } from '@/types/booking';
import type { Property } from '@/types/property';
import { useDailyOperations } from '@/composables/useDailyOperations';

const props = defineProps<{
    property: Property;
    bookings: Booking[];
}>();

const bookingsRef = toRef(props, 'bookings');

const { isOccupied } = useDailyOperations(bookingsRef, {
    propertyId: props.property.id,
});
</script>

<template>
    <div
        class="flex items-center gap-1 rounded-md bg-mist-950/80 px-2 py-1 text-[11px] font-semibold text-mist-300 shadow-md backdrop-blur-sm transition">
        <span
            class="h-2 w-2 rounded-md"
            :class="[isOccupied ? 'bg-amber-400' : 'bg-lime-400']"></span>
        <span>{{ isOccupied ? 'Occupied ' : 'Available' }}</span>
    </div>
</template>
