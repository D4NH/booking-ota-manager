<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import type { Property, PropertyId } from '@/types/property';

const props = defineProps<{
    isOpen: boolean;
    propertyToEdit?: Property | null;
}>();

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'save', payload: Omit<Property, 'createdAt'>): void;
}>();

const isEditing = computed(() => Boolean(props.propertyToEdit?.id));

const defaultForm: Property = {
    id: '' as PropertyId,
    name: '',
    address: '',
    color: '#016730',
    price: 0,
    codePrefix: '',
};

const form = ref<Property>({ ...defaultForm });

watch(
    () => props.propertyToEdit,
    (newVal) => {
        form.value = newVal ? { ...newVal } : { ...defaultForm };
    },
    { immediate: true }
);

watch(
    () => props.isOpen,
    (isOpen) => {
        if (!isOpen) {
            form.value = { ...defaultForm };
        }
    }
);

const handleClose = () => {
    emit('close');
};

const handleSubmit = () => {
    if (!form.value.name || !form.value.codePrefix) return;

    // Auto-generate clean slug ID for new properties if empty
    const generatedId = (form.value.id ||
        form.value.name.toLowerCase().replace(/[^a-z0-9]/g, '')) as PropertyId;

    const payload: Property = {
        ...form.value,
        id: generatedId,
        price: Number(form.value.price) || 0,
    };

    emit('save', payload);
    handleClose();
};
</script>

<template>
    <Teleport to="body">
        <div
            v-if="isOpen"
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            @click.self="handleClose">
            <div
                class="w-full max-w-lg rounded-2xl border border-mist-800 bg-mist-900 p-6 shadow-2xl transition-all"
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
                        class="rounded-lg p-1 text-mist-400 transition-colors hover:bg-mist-800 hover:text-mist-200"
                        @click="handleClose">
                        ✕
                    </button>
                </div>

                <!-- Form Fields -->
                <form
                    class="mt-4 space-y-4"
                    @submit.prevent="handleSubmit">
                    <!-- Property Name -->
                    <div>
                        <label class="block text-xs font-semibold text-mist-300"
                            >Property Name</label
                        >
                        <input
                            v-model="form.name"
                            type="text"
                            required
                            placeholder="e.g. Mai House Jogja - Piyungan"
                            class="mt-1 w-full rounded-lg border border-mist-800 bg-mist-950 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lime-400" />
                    </div>

                    <!-- Code Prefix & Theme Color -->
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-xs font-semibold text-mist-300"
                                >Code Prefix</label
                            >
                            <input
                                v-model="form.codePrefix"
                                type="text"
                                required
                                placeholder="e.g. MHJ"
                                class="mt-1 w-full rounded-lg border border-mist-800 bg-mist-950 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lime-400" />
                        </div>

                        <div>
                            <label class="block text-xs font-semibold text-mist-300"
                                >Theme Color</label
                            >
                            <div class="mt-1 flex items-center gap-2">
                                <input
                                    v-model="form.color"
                                    type="color"
                                    class="h-9 w-12 cursor-pointer rounded border border-mist-800 bg-mist-950 p-1" />
                                <input
                                    v-model="form.color"
                                    type="text"
                                    class="w-full rounded-lg border border-mist-800 bg-mist-950 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lime-400" />
                            </div>
                        </div>
                    </div>

                    <!-- Base Price per Night -->
                    <div>
                        <label class="block text-xs font-semibold text-mist-300"
                            >Base Price per Night (IDR)</label
                        >
                        <input
                            v-model.number="form.price"
                            type="number"
                            min="0"
                            placeholder="e.g. 1499000"
                            class="mt-1 w-full rounded-lg border border-mist-800 bg-mist-950 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lime-400" />
                    </div>

                    <!-- Full Address -->
                    <div>
                        <label class="block text-xs font-semibold text-mist-300"
                            >Full Address</label
                        >
                        <textarea
                            v-model="form.address"
                            rows="3"
                            placeholder="Enter property address..."
                            class="mt-1 w-full rounded-lg border border-mist-800 bg-mist-950 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lime-400"></textarea>
                    </div>

                    <!-- Action Buttons -->
                    <div class="mt-6 flex items-center justify-end gap-3 pt-2">
                        <button
                            type="button"
                            class="rounded-lg border border-mist-800 px-4 py-2 text-xs font-semibold text-mist-300 transition-colors hover:bg-mist-800"
                            @click="handleClose">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            class="rounded-lg bg-lime-400 px-4 py-2 text-xs font-bold text-mist-950 transition-colors hover:bg-lime-300">
                            {{ isEditing ? 'Save Changes' : 'Create Property' }}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </Teleport>
</template>
