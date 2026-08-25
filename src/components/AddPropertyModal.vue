<script setup lang="ts">
import { ref } from 'vue';
import { useBookingStore } from '@/stores/useBookingStore';

const emit = defineEmits<{
    (e: 'close'): void;
}>();

const bookingStore = useBookingStore();

const propertyName = ref<string>('');
const propertyAddress = ref<string>('');
const propertyArea = ref<string>('');
const codePrefix = ref<string>('');
const propertyColor = ref<string>('#7DCF00');
const isSubmitting = ref<boolean>(false);

const handleSubmit = async (): Promise<void> => {
    if (
        !propertyName.value.trim() ||
        !propertyAddress.value.trim() ||
        !propertyArea.value.trim() ||
        !codePrefix.value.trim()
    )
        return;

    isSubmitting.value = true;
    try {
        await bookingStore.addProperty({
            name: propertyName.value.trim(),
            address: propertyAddress.value.trim(),
            area: propertyArea.value.trim(),
            codePrefix: codePrefix.value.trim().toUpperCase(),
            color: propertyColor.value,
        });
        emit('close');
    } catch (error) {
        console.error('Failed to add property:', error);
    } finally {
        isSubmitting.value = false;
    }
};
</script>

<template>
    <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-mist-950/80 p-4 backdrop-blur-sm">
        <div class="w-full max-w-md rounded-2xl border border-mist-800 bg-mist-900 shadow-2xl">
            <div class="border-b border-mist-800 px-6 py-4 flex justify-between items-center">
                <h2 class="text-lg font-bold text-mist-100">Add New Property</h2>
                <button
                    class="text-mist-400 hover:text-mist-200"
                    @click="$emit('close')">
                    &times;
                </button>
            </div>

            <form
                class="p-6 space-y-4"
                @submit.prevent="handleSubmit">
                <!-- Property Name -->
                <div class="space-y-1.5">
                    <label class="text-sm font-medium text-mist-300">Name</label>
                    <input
                        v-model="propertyName"
                        type="text"
                        required
                        placeholder="e.g. Villa"
                        class="w-full rounded-lg border border-mist-700 bg-mist-950 px-3 py-2 text-sm text-mist-200 placeholder:text-mist-600 focus:border-lime-500 focus:outline-none" />
                </div>

                <div class="space-y-1.5">
                    <label class="text-sm font-medium text-mist-300">Address</label>
                    <input
                        v-model="propertyAddress"
                        type="text"
                        required
                        placeholder="e.g. Jl. Jalan"
                        class="w-full rounded-lg border border-mist-700 bg-mist-950 px-3 py-2 text-sm text-mist-200 placeholder:text-mist-600 focus:border-lime-500 focus:outline-none" />
                </div>

                <div class="space-y-1.5">
                    <label class="text-sm font-medium text-mist-300">Area</label>
                    <input
                        v-model="propertyArea"
                        type="text"
                        required
                        placeholder="e.g. Piyungan"
                        class="w-full rounded-lg border border-mist-700 bg-mist-950 px-3 py-2 text-sm text-mist-200 placeholder:text-mist-600 focus:border-lime-500 focus:outline-none" />
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <!-- Booking Prefix -->
                    <div class="space-y-1.5">
                        <label class="text-sm font-medium text-mist-300">Prefix</label>
                        <input
                            v-model="codePrefix"
                            type="text"
                            required
                            placeholder="e.g. MHJ"
                            maxlength="4"
                            class="w-full rounded-lg border border-mist-700 bg-mist-950 px-3 py-2 text-sm text-mist-200 placeholder:text-mist-600 focus:border-lime-500 focus:outline-none uppercase" />
                    </div>

                    <!-- Color Badge -->
                    <div class="space-y-1.5">
                        <label class="text-sm font-medium text-mist-300">Calendar Color</label>
                        <div class="flex items-center gap-3">
                            <input
                                v-model="propertyColor"
                                type="color"
                                class="h-9 w-14 cursor-pointer rounded border-0 bg-transparent p-0" />
                            <span class="text-xs font-mono text-mist-400">{{ propertyColor }}</span>
                        </div>
                    </div>
                </div>

                <!-- Actions -->
                <div class="pt-4 flex justify-end gap-3">
                    <button
                        type="button"
                        class="rounded-lg px-4 py-2 text-sm font-medium text-mist-400 hover:text-mist-200 hover:bg-mist-800 transition"
                        @click="$emit('close')">
                        Cancel
                    </button>
                    <button
                        type="submit"
                        :disabled="isSubmitting"
                        class="rounded-lg bg-lime-500 px-4 py-2 text-sm font-semibold text-mist-950 hover:bg-lime-400 transition disabled:opacity-50">
                        {{ isSubmitting ? 'Saving...' : 'Save Property' }}
                    </button>
                </div>
            </form>
        </div>
    </div>
</template>
