<script setup lang="ts">
const { isOccupied } = defineProps<{
    isOccupied: boolean;
}>();
</script>

<template>
    <span
        class="flex items-center gap-2 rounded-md bg-mist-950/80 px-2 py-1 text-xs font-semibold text-mist-300 shadow-md backdrop-blur-sm">
        <span
            class="h-2 w-2 rounded-full"
            :class="isOccupied ? 'bg-amber-400' : 'bg-lime-400'" />
        {{ isOccupied ? 'Occupied' : 'Available' }}
    </span>
</template>
