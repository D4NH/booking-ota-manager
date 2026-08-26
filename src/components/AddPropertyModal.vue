<script setup lang="ts">
import { ref } from 'vue';
import type { Property } from '@/db';
import type { PropertyId } from '@/config/properties';

const props = defineProps<{
    propertyToEdit?: Property | null;
}>();

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'save', payload: Omit<Property, 'createdAt'>): void;
}>();

const form = ref({
    id: (props.propertyToEdit?.id as PropertyId) || 'piyungan',
    name: props.propertyToEdit?.name || 'Mai House Jogja',
    color: props.propertyToEdit?.color || '#016730',
    address: props.propertyToEdit?.address || 'Piyungan, Yogyakarta',
    codePrefix: props.propertyToEdit?.codePrefix || 'MHJ',
});

// Preset helper updated with missing interface properties
const availablePresets: {
    id: PropertyId;
    name: string;
    color: string;
    address: string;
    codePrefix: string;
}[] = [
    {
        id: 'piyungan',
        name: 'Mai House Jogja - Piyungan',
        color: '#016730',
        address: 'Piyungan, Bantul, Yogyakarta',
        codePrefix: 'PIY',
    },
    {
        id: 'wonosari',
        name: 'Mai House Jogja - Wonosari',
        color: '#3b82f6',
        address: 'Wonosari, Gunungkidul, Yogyakarta',
        codePrefix: 'WON',
    },
    {
        id: 'bantul',
        name: 'Mai House Jogja - Bantul',
        color: '#884B00',
        address: 'Imogiri, Bantul, Yogyakarta',
        codePrefix: 'IMO',
    },
];

const handlePresetChange = (event: Event): void => {
    const target = event.target as HTMLSelectElement;
    const selected = availablePresets.find((p) => p.id === target.value);
    if (selected) {
        form.value.id = selected.id;
        form.value.name = selected.name;
        form.value.color = selected.color;
        form.value.address = selected.address;
        form.value.codePrefix = selected.codePrefix;
    }
};

const handleSubmit = (): void => {
    emit('save', {
        id: form.value.id,
        name: form.value.name.trim(),
        color: form.value.color,
        address: form.value.address.trim(),
        codePrefix: form.value.codePrefix.trim(),
    });
    emit('close');
};
</script>

<template>
    <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-mist-950/80 p-4 backdrop-blur-sm">
        <div
            class="w-full max-w-md space-y-4 rounded-xl border border-mist-800 bg-mist-900 p-6 shadow-2xl">
            <div class="flex items-center justify-between border-b border-mist-800 pb-3">
                <h2 class="text-base font-bold text-mist-100">
                    {{ propertyToEdit ? 'Edit Property' : 'Add Property' }}
                </h2>
                <button
                    type="button"
                    class="text-mist-400 hover:text-mist-200"
                    @click="emit('close')">
                    &times;
                </button>
            </div>

            <form
                class="space-y-4"
                @submit.prevent="handleSubmit">
                <div>
                    <label class="mb-1 block text-xs font-medium text-mist-400">
                        Target Property
                    </label>
                    <select
                        :value="form.id"
                        class="w-full rounded-lg border border-mist-700 bg-mist-950 px-3 py-2 text-sm text-mist-200 focus:border-lime-500 focus:outline-none"
                        required
                        @change="handlePresetChange">
                        <option
                            v-for="preset in availablePresets"
                            :key="preset.id"
                            :value="preset.id">
                            {{ preset.name }}
                        </option>
                    </select>
                </div>

                <!-- Property Display Name -->
                <div>
                    <label class="mb-1 block text-xs font-medium text-mist-400">Display Name</label>
                    <input
                        v-model="form.name"
                        type="text"
                        placeholder="e.g. Mai House Jogja - Piyungan"
                        class="w-full rounded-lg border border-mist-700 bg-mist-950 px-3 py-2 text-sm text-mist-200 placeholder:text-mist-600 focus:border-lime-500 focus:outline-none"
                        required />
                </div>

                <!-- Code Prefix & Area -->
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="mb-1 block text-xs font-medium text-mist-400">
                            Code Prefix
                        </label>
                        <input
                            v-model="form.codePrefix"
                            type="text"
                            placeholder="e.g. PIY"
                            class="w-full rounded-lg border border-mist-700 bg-mist-950 px-3 py-2 font-mono text-sm text-mist-200 uppercase focus:border-lime-500 focus:outline-none"
                            required />
                    </div>
                </div>

                <!-- Address -->
                <div>
                    <label class="mb-1 block text-xs font-medium text-mist-400">Address</label>
                    <input
                        v-model="form.address"
                        type="text"
                        placeholder="Full property address"
                        class="w-full rounded-lg border border-mist-700 bg-mist-950 px-3 py-2 text-sm text-mist-200 focus:border-lime-500 focus:outline-none"
                        required />
                </div>

                <!-- Theme / Badge Color Selection -->
                <div>
                    <label class="mb-1 block text-xs font-medium text-mist-400">
                        Badge Color
                    </label>
                    <div class="flex items-center gap-3">
                        <input
                            v-model="form.color"
                            type="color"
                            class="h-9 w-12 cursor-pointer rounded border border-mist-700 bg-mist-950 p-1" />
                        <input
                            v-model="form.color"
                            type="text"
                            placeholder="#016730"
                            class="w-full rounded-lg border border-mist-700 bg-mist-950 px-3 py-2 font-mono text-sm text-mist-200 focus:border-lime-500 focus:outline-none"
                            required />
                    </div>
                </div>

                <div class="flex justify-end gap-3 pt-3">
                    <button
                        type="button"
                        class="px-4 py-2 text-xs font-semibold text-mist-400 hover:text-mist-200"
                        @click="emit('close')">
                        Cancel
                    </button>
                    <button
                        type="submit"
                        class="rounded-lg bg-lime-500 px-4 py-2 text-xs font-semibold text-mist-950 transition hover:bg-lime-400">
                        {{ propertyToEdit ? 'Update Property' : 'Save Property' }}
                    </button>
                </div>
            </form>
        </div>
    </div>
</template>
