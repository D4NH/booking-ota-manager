<script setup lang="ts">
import { ref, computed, useSlots } from 'vue';

// Formatter for dot notation only (1500000 -> "1.500.000")
const dotFormatter = new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 0,
});

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
            if (processedValue === '' || processedValue === '-') return processedValue;
            const parsed = parseFloat(processedValue);
            return isNaN(parsed) ? '' : parsed;
        }

        return processedValue;
    },
});

const slots = useSlots();

const isFocused = ref(false);

/**
 * Switch HTML input type to 'text' for numbers to permit
 * dot notation ("1.500.000") when blurred without browser errors.
 */
const effectiveType = computed(() => {
    if (type === 'number') return 'text';
    return type;
});
/**
 * Display dot-separated number when blurred, and raw digits when focused.
 */
const displayValue = computed(() => {
    if (type !== 'number') {
        return modelValue.value ?? '';
    }
    // When focused: display raw number without dots
    if (isFocused.value) {
        if (
            modelValue.value === null ||
            modelValue.value === undefined ||
            modelValue.value === ''
        ) {
            return '';
        }
        return String(modelValue.value).replace(/[^0-9-]/g, '');
    }
    // When blurred: display dot notation only ("1.500.000")
    if (modelValue.value !== null && modelValue.value !== undefined && modelValue.value !== '') {
        const num = Number(modelValue.value);
        return isNaN(num) ? '' : dotFormatter.format(num);
    }

    return '';
});

function handleInput(event: Event): void {
    const inputElement = event.target as HTMLInputElement;

    if (type === 'number') {
        const sanitized = inputElement.value.replace(/[^0-9-]/g, '');
        inputElement.value = sanitized;
        modelValue.value = sanitized;
    } else {
        modelValue.value = inputElement.value;
    }
}
function handleFocus(): void {
    isFocused.value = true;
}
function handleBlur(): void {
    isFocused.value = false;
}
function handlePaste(event: ClipboardEvent): void {
    if (type !== 'number') return;

    event.preventDefault();
    const clipboardData = event.clipboardData;
    if (!clipboardData) return;

    const pastedText = clipboardData.getData('text');
    const sanitizedPaste = pastedText.replace(/[^0-9-]/g, '');

    const target = event.target as HTMLInputElement;
    target.value = sanitizedPaste;
    modelValue.value = sanitizedPaste;
}
</script>

<template>
    <div class="relative">
        <label
            v-if="inputLabel.length"
            :for="id"
            class="block font-medium text-xs text-mist-400 mb-1">
            {{ inputLabel }}
        </label>

        <div
            v-if="slots.icon"
            class="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-mist-500 group-focus-within:text-lime-400 transition-colors"
            :class="[inputLabel.length ? 'top-5' : 'top-0.5']">
            <slot name="icon"></slot>
        </div>

        <input
            :id="id"
            :type="effectiveType"
            :inputmode="type === 'number' ? 'numeric' : undefined"
            :value="displayValue"
            :placeholder="placeholder"
            class="w-full flex items-center justify-between py-1.5 bg-mist-950/50 border border-mist-800 hover:border-mist-700 rounded-md shadow-md text-sm text-mist-300 focus:outline-none focus:ring-lime-500 focus:border-lime-500 transition-colors"
            :class="[
                slots.icon ? 'pl-9 pr-3 ' : 'px-3',
                { 'font-mono': type === 'number' || id === 'bookingId' || id === 'goldCert' },
                { 'cursor-not-allowed disabled:bg-mist-900': disabled },
            ]"
            :disabled="disabled"
            :required="required"
            @input="handleInput"
            @focus="handleFocus"
            @blur="handleBlur"
            @paste="handlePaste" />
    </div>
</template>
