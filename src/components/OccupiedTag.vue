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
    <span
        class="rounded-sm px-2 py-0.5 text-xs text-[11px] tracking-wide shrink-0"
        :class="[isOccupied ? 'bg-amber-500/20 text-amber-400' : 'bg-lime-500/20 text-lime-400']">
        {{ isOccupied ? 'Occupied ' : 'Available' }}
    </span>
</template>
