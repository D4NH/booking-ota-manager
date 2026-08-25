<script setup lang="ts">
import type { Property } from '@/db';

interface Props {
    properties: Property[];
    selectedPropertyId: string;
}

defineProps<Props>();

const emit = defineEmits<{
    (e: 'update:selectedPropertyId', value: string): void;
    (e: 'propertyChange'): void;
}>();

const handleSelect = (event: Event): void => {
    const target = event.target as HTMLSelectElement;
    emit('update:selectedPropertyId', target.value);
    emit('propertyChange');
};
</script>

<template>
    <header class="w-full mt-6 mb-12 pb-6">
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
                <RouterLink
                    to="/"
                    class="flex h-8 w-8 items-center justify-center rounded-lg bg-lime-500 font-bold text-mist-950">
                    M
                </RouterLink>
                <h1 class="text-xl font-bold tracking-tight">Dashboard</h1>
            </div>

            <div class="flex items-center space-x-8">
                <RouterLink
                    class="text-white text-sm"
                    to="/calendar">
                    Calendar
                </RouterLink>
                <RouterLink
                    class="text-white text-sm"
                    to="/bookings">
                    Bookings
                </RouterLink>
                <RouterLink
                    class="text-white text-sm"
                    to="/finance">
                    Finance
                </RouterLink>
                <RouterLink
                    class="text-white text-sm"
                    to="/settings">
                    Settings
                </RouterLink>
                <div class="relative w-full max-w-xs">
                    <select
                        :value="selectedPropertyId"
                        class="appearance-none block w-full rounded-lg border border-mist-700 bg-mist-900 px-3 py-2 text-sm text-mist-200 focus:border-lime-500 focus:outline-none"
                        @change="handleSelect">
                        <option value="all">All Properties</option>
                        <option
                            v-for="prop in properties"
                            :key="prop.id"
                            :value="prop.id">
                            {{ prop.name }}
                        </option>
                    </select>
                    <div
                        class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-mist-200">
                        <svg
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke-width="1.5"
                            stroke="currentColor"
                            class="size-5">
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M8.25 15 12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
                        </svg>
                    </div>
                </div>
            </div>
        </div>
    </header>
</template>

<style lang="scss" scoped>
header {
    border-bottom: 1px solid var(--color-border);
    color: var(--color-text-muted);
    font-size: 0.813rem;
}
</style>
