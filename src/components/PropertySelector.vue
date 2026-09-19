<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { usePropertyStore } from '@/stores/usePropertyStore';
import type { PropertyId } from '@/types/property';

interface Props {
    modelValue: PropertyId | 'all';
    showAll?: boolean;
}

interface Emits {
    (e: 'update:modelValue', value: PropertyId | 'all'): void;
    (e: 'change', value: PropertyId | 'all'): void;
}

const { modelValue, showAll = true } = defineProps<Props>();
const emit = defineEmits<Emits>();

const propertyStore = usePropertyStore();
const { sortedProperties } = storeToRefs(propertyStore);

const handleSelect = (id: PropertyId | 'all'): void => {
    if (id === modelValue) return;
    emit('update:modelValue', id);
    emit('change', id);
};
</script>

<template>
    <div
        class="flex items-center gap-1 rounded-md border border-mist-800 bg-mist-900 p-1 shrink-0 shadow-sm">
        <!-- "All" Tab -->
        <button
            v-if="showAll"
            type="button"
            class="cursor-pointer rounded-md px-3 py-1.5 text-xs font-bold transition-colors"
            :class="[
                modelValue === 'all'
                    ? 'bg-mist-800 text-lime-400 shadow-md'
                    : 'text-mist-400 hover:text-mist-200',
            ]"
            @click="handleSelect('all')">
            All
        </button>

        <!-- Property Tabs -->
        <button
            v-for="prop in sortedProperties"
            :key="prop.id"
            type="button"
            class="capitalize rounded-md px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer"
            :class="[
                modelValue === prop.id
                    ? 'bg-mist-800 text-lime-400 shadow-md'
                    : 'text-mist-400 hover:text-mist-200',
            ]"
            @click="handleSelect(prop.id)">
            {{ prop.id }}
        </button>
    </div>
</template>
