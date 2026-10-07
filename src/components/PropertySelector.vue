<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { usePropertyStore } from '@/stores/usePropertyStore';
import type { PropertyId } from '@/types/property';

interface PropertyTabOption {
    id: PropertyId;
    label: string;
}

interface Props {
    modelValue: PropertyId | 'all';
    showAll?: boolean;
}

const { modelValue, showAll = true } = defineProps<Props>();
const emit = defineEmits<{
    'update:modelValue': [value: PropertyId | 'all'];
    change: [value: PropertyId | 'all'];
}>();

const propertyStore = usePropertyStore();
const { sortedProperties } = storeToRefs(propertyStore);

const PROPERTY_TABS: readonly PropertyTabOption[] = sortedProperties.value.map((p) => ({
    id: p.id,
    label: p.name.replace('Mai House Jogja - ', '').replace('Mai House Bali - ', ''),
}));

function handleSelect(id: PropertyId | 'all'): void {
    if (id === modelValue) return;
    emit('update:modelValue', id);
    emit('change', id);
}
</script>

<template>
    <div class="flex items-center gap-2">
        <div
            class="flex items-center rounded-md border border-mist-800 bg-mist-950/50 p-0.5 text-xs select-none">
            <button
                v-if="showAll"
                type="button"
                class="flex cursor-pointer items-center gap-1.5 rounded-xs px-3 py-1.5 font-semibold transition"
                :class="[
                    modelValue === 'all'
                        ? 'border border-mist-700/80 bg-mist-800 text-lime-400 shadow-sm'
                        : 'text-mist-400 hover:text-mist-200',
                ]"
                @click="handleSelect('all')">
                All
            </button>
            <!-- Property Tabs -->
            <button
                v-for="prop in PROPERTY_TABS"
                :key="prop.id"
                type="button"
                class="flex cursor-pointer items-center gap-1.5 rounded-xs px-3 py-1.5 font-semibold capitalize transition"
                :class="[
                    modelValue === prop.id
                        ? 'border border-mist-700/80 bg-mist-800 text-lime-400 shadow-sm'
                        : 'border border-transparent text-mist-400 hover:text-mist-200',
                ]"
                @click="handleSelect(prop.id)">
                {{ prop.label }}
            </button>
        </div>
    </div>
</template>
