<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import type { Property, PropertyId } from '@/types/property';

const props = defineProps<{
    propertyToEdit?: Property | null;
    currentProperty?: PropertyId | 'all';
}>();

const emit = defineEmits<{
    close: [];
    save: [payload: Omit<Property, 'createdAt'>];
}>();

const defaultForm: Property = {
    id: '' as PropertyId,
    name: '',
    address: '',
    coordinates: {
        lat: 0,
        lng: 0,
    },
    color: '#016730',
    price: 0,
    codePrefix: '',
    bedrooms: 0,
    bathrooms: 0,
    plotSize: 0,
};

const form = ref<Property>({ ...defaultForm });

const isEditing = computed(() => Boolean(props.propertyToEdit?.id));

const handleSubmit = () => {
    if (!form.value.name || !form.value.codePrefix) return;

    // Auto-generate ID for new properties if empty
    const generatedId = (form.value.id ||
        form.value.name.toLowerCase().replace(/[^a-z0-9]/g, '')) as PropertyId;

    const payload: Property = {
        ...form.value,
        id: generatedId,
        coordinates: {
            lat: form.value.coordinates.lat,
            lng: form.value.coordinates.lng,
        },
        price: Number(form.value.price) || 0,
    };

    emit('save', payload);
    emit('close');
};
watch(
    () => props.propertyToEdit,
    (newVal) => {
        form.value = newVal ? { ...newVal } : { ...defaultForm };
    },
    { immediate: true }
);
</script>

<template>
    <Teleport to="body">
        <div
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div
                class="w-full max-w-lg rounded-md border border-mist-800 bg-mist-900 p-6 shadow-xl transition-all"
                role="dialog"
                aria-modal="true">
                <!-- Modal Header -->
                <div class="flex items-center justify-between border-b border-mist-800 pb-4">
                    <div>
                        <h2 class="text-lg font-bold text-mist-100">
                            {{ isEditing ? 'Edit Property' : 'Add New Property' }}
                        </h2>
                        <p
                            v-if="isEditing"
                            class="text-xs text-mist-400">
                            ID: {{ form.id }}
                        </p>
                    </div>
                    <button
                        type="button"
                        class="rounded-md p-1 text-mist-400 transition-colors hover:bg-mist-800 hover:text-mist-200"
                        @click="emit('close')">
                        ✕
                    </button>
                </div>

                <!-- Form Fields -->
                <form
                    class="mt-4 space-y-4"
                    @submit.prevent="handleSubmit">
                    <!-- Property Name -->
                    <div>
                        <label class="block text-xs font-semibold text-mist-300">
                            Property Name
                        </label>
                        <input
                            v-model="form.name"
                            type="text"
                            required
                            placeholder="e.g. Mai House Jogja - Piyungan"
                            class="mt-1 w-full rounded-md border border-mist-800 bg-mist-950 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lime-400" />
                    </div>

                    <!-- Full Address -->
                    <div>
                        <label class="block text-xs font-semibold text-mist-300">Address</label>
                        <textarea
                            v-model="form.address"
                            rows="3"
                            placeholder="Enter property address..."
                            class="mt-1 w-full rounded-md border border-mist-800 bg-mist-950 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lime-400"></textarea>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-xs font-semibold text-mist-300"> Lat </label>
                            <input
                                v-model.number="form.coordinates.lat"
                                type="number"
                                step="any"
                                required
                                placeholder="0"
                                class="mt-1 w-full rounded-md border border-mist-800 bg-mist-950 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lime-400" />
                        </div>

                        <div>
                            <label class="block text-xs font-semibold text-mist-300"> Lang </label>
                            <input
                                v-model.number="form.coordinates.lng"
                                type="number"
                                step="any"
                                required
                                placeholder="0"
                                class="mt-1 w-full rounded-md border border-mist-800 bg-mist-950 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lime-400" />
                        </div>
                    </div>

                    <!-- Code Prefix & Theme Color -->
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-xs font-semibold text-mist-300">
                                Code Prefix
                            </label>
                            <input
                                v-model="form.codePrefix"
                                type="text"
                                required
                                placeholder="e.g. MHJ"
                                class="mt-1 w-full rounded-md border border-mist-800 bg-mist-950 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lime-400" />
                        </div>

                        <div>
                            <label class="block text-xs font-semibold text-mist-300">
                                Theme Color
                            </label>
                            <div class="mt-1 flex items-center gap-2">
                                <input
                                    v-model="form.color"
                                    type="color"
                                    class="h-9 w-12 cursor-pointer rounded-md border border-mist-800 bg-mist-950 p-1" />
                                <input
                                    v-model="form.color"
                                    type="text"
                                    class="w-full rounded-md border border-mist-800 bg-mist-950 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lime-400" />
                            </div>
                        </div>
                    </div>

                    <!-- Base Price per Night -->
                    <div>
                        <label class="block text-xs font-semibold text-mist-300">
                            Price per Night (IDR)
                        </label>
                        <input
                            v-model.number="form.price"
                            type="number"
                            min="0"
                            placeholder="e.g. 1499000"
                            class="mt-1 w-full rounded-md border border-mist-800 bg-mist-950 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lime-400" />
                    </div>

                    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div>
                            <label class="block text-xs font-semibold text-mist-300">
                                Bedrooms
                            </label>
                            <input
                                v-model="form.bedrooms"
                                type="text"
                                required
                                placeholder="0"
                                class="mt-1 w-full rounded-md border border-mist-800 bg-mist-950 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lime-400" />
                        </div>

                        <div>
                            <label class="block text-xs font-semibold text-mist-300">
                                Bathrooms
                            </label>
                            <input
                                v-model="form.bathrooms"
                                type="text"
                                required
                                placeholder="0"
                                class="mt-1 w-full rounded-md border border-mist-800 bg-mist-950 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lime-400" />
                        </div>

                        <div>
                            <label class="block text-xs font-semibold text-mist-300">
                                Area m&sup3;</label
                            >
                            <input
                                v-model="form.plotSize"
                                type="text"
                                required
                                placeholder="0"
                                class="mt-1 w-full rounded-md border border-mist-800 bg-mist-950 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lime-400" />
                        </div>
                    </div>

                    <!-- Action Buttons -->
                    <div class="mt-6 flex items-center justify-end gap-3 pt-2">
                        <button
                            type="button"
                            class="rounded-md border border-mist-800 px-4 py-2 text-xs font-semibold text-mist-300 transition-colors hover:bg-mist-800"
                            @click="emit('close')">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            class="rounded-md bg-lime-400 px-4 py-2 text-xs font-bold text-mist-950 transition-colors hover:bg-lime-300">
                            {{ isEditing ? 'Save Changes' : 'Create Property' }}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </Teleport>
</template>
