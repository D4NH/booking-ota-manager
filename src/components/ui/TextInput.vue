<script setup lang="ts">
import { useSlots } from 'vue';

interface Props {
    inputLabel?: string;
    disabled?: boolean;
    required?: boolean;
    placeholder?: string;
    type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url';
    id?: string;
}

const {
    inputLabel = 'Text',
    placeholder = 'Insert text',
    type = 'text',
    id = '',
    disabled = false,
    required = false,
} = defineProps<Props>();

const [modelValue, modifiers] = defineModel<string | number | null>({
    default: '',
    set(value) {
        let processedValue = value;

        if (modifiers.trim && typeof processedValue === 'string') {
            processedValue = processedValue.trim();
        }

        if ((modifiers.number || type === 'number') && typeof processedValue === 'string') {
            const parsed = parseFloat(processedValue);
            return isNaN(parsed) ? '' : parsed;
        }

        return processedValue;
    },
});

const slots = useSlots();

const handleInputScrubbing = (event: Event): void => {
    if (type !== 'number') return;

    const inputElement = event.target as HTMLInputElement;
    const rawValue = inputElement.value;

    const sanitizedValue = rawValue.replace(/[^0-9-]/g, '');

    if (inputElement.value !== sanitizedValue) {
        inputElement.value = sanitizedValue;
        modelValue.value = sanitizedValue;
    }
};
const handlePasteScrubbing = (event: ClipboardEvent): void => {
    if (type !== 'number') return;

    // Prevent default drop event cycle values from flashing visually
    event.preventDefault();

    // Standard ClipboardEvent natively includes a type-safe DataTransfer object
    const clipboardData = event.clipboardData;

    // Guard clause handling edge contexts where clipboard access might be restricted
    if (!clipboardData) return;

    const pastedText = clipboardData.getData('text');

    // Filter out all non-integers from clipboard contents string data
    const sanitizedPaste = pastedText.replace(/[^0-9-]/g, '');

    // Pipe the sanitized results straight into the component models layer
    modelValue.value = sanitizedPaste;
};
</script>

<template>
    <div class="relative">
        <label
            :for="id"
            class="block font-medium text-xs text-mist-400 mb-1">
            {{ inputLabel }}
        </label>
        <div
            v-if="slots.icon"
            class="absolute inset-y-0 left-0 top-5 flex items-center pl-3.5 pointer-events-none text-mist-500 group-focus-within:text-lime-400 transition-colors">
            <slot name="icon"></slot>
        </div>

        <input
            :id="id"
            v-model="modelValue"
            :type="type"
            :placeholder="placeholder"
            class="w-full flex items-center justify-between pl-4 pr-3 py-1.5 bg-mist-950/50 border border-mist-800 rounded-md shadow-md text-sm text-mist-300 hover:bg-mist-850 focus:outline-none focus:ring-lime-500 focus:border-lime-500 transition-colors"
            :class="[
                slots.icon ? 'pl-9 py-2' : 'pl-4',
                { 'font-mono': type === 'number' || id === 'bookingId' },
                { 'cursor-not-allowed disabled:bg-mist-900': disabled },
            ]"
            :disabled="disabled"
            :required="required"
            @input="handleInputScrubbing"
            @paste="handlePasteScrubbing" />
    </div>
</template>
