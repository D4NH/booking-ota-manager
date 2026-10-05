<script setup lang="ts">
import { computed, useSlots } from 'vue';

export type ButtonType = 'button' | 'submit' | 'reset';
export type VariantType = 'primary' | 'outline' | 'text' | 'icon';

interface StyleTokens {
    bg?: string;
    text: string;
    hover: string;
    border?: string;
}

type PaletteStyles = Record<VariantType, StyleTokens>;

const COLOR_PALETTES = {
    lime: {
        primary: { bg: 'bg-lime-500', text: 'text-mist-950', hover: 'hover:bg-lime-400' },
        outline: {
            bg: 'bg-transparent',
            text: 'text-lime-400',
            border: 'border border-lime-500/40',
            hover: 'hover:bg-lime-500/10 hover:border-lime-400',
        },
        text: { text: 'text-mist-400', hover: 'hover:text-lime-400' },
        icon: { text: 'text-mist-400', hover: 'hover:text-lime-400' },
    },
    rose: {
        primary: { bg: 'bg-rose-500', text: 'text-white', hover: 'hover:bg-rose-600' },
        outline: {
            bg: 'bg-transparent',
            text: 'text-rose-400',
            border: 'border border-rose-500/40',
            hover: 'hover:bg-rose-500/10 hover:border-rose-400',
        },
        text: { text: 'text-rose-400', hover: 'hover:text-rose-300' },
        icon: { text: 'text-mist-400', hover: 'hover:text-rose-400' },
    },
    mist: {
        primary: {
            bg: 'bg-mist-800',
            text: 'text-mist-100',
            border: 'border border-mist-700',
            hover: 'hover:bg-mist-700',
        },
        outline: {
            bg: 'bg-transparent',
            text: 'text-mist-300',
            border: 'border border-mist-700',
            hover: 'hover:bg-mist-800 hover:text-mist-100',
        },
        text: { text: 'text-mist-400', hover: 'hover:text-mist-200' },
        icon: { text: 'text-mist-400', hover: 'hover:text-mist-200' },
    },
    blue: {
        primary: { bg: 'bg-blue-600', text: 'text-white', hover: 'hover:bg-blue-500' },
        outline: {
            bg: 'bg-transparent',
            text: 'text-blue-400',
            border: 'border border-blue-500/40',
            hover: 'hover:bg-blue-500/10 hover:border-blue-400',
        },
        text: { text: 'text-mist-400', hover: 'hover:text-blue-400' },
        icon: { text: 'text-mist-400', hover: 'hover:text-blue-400' },
    },
    amber: {
        primary: { bg: 'bg-amber-400', text: 'text-mist-950', hover: 'hover:bg-amber-300' },
        outline: {
            bg: 'bg-transparent',
            text: 'text-amber-400',
            border: 'border border-amber-500/40',
            hover: 'hover:bg-amber-500/10 hover:border-amber-400',
        },
        text: { text: 'text-mist-400', hover: 'hover:text-amber-400' },
        icon: { text: 'text-mist-400', hover: 'hover:text-amber-400' },
    },
} as const satisfies Record<string, PaletteStyles>;

export type ButtonColor = 'default' | keyof typeof COLOR_PALETTES;

interface Props {
    type?: ButtonType;
    label?: string;
    variant?: VariantType;
    color?: ButtonColor;
    disabled?: boolean;
    fullWidth?: boolean;
}

const {
    type = 'button',
    label = 'Button',
    variant = 'primary',
    color = 'default',
    disabled = false,
    fullWidth = false,
} = defineProps<Props>();

const emit = defineEmits<{
    click: [event: MouseEvent];
}>();

const slots = useSlots();

const currentVariantConfig = computed<StyleTokens>(() => {
    const resolvedColor: keyof typeof COLOR_PALETTES =
        color === 'default' ? (variant === 'text' || variant === 'icon' ? 'mist' : 'lime') : color;

    return COLOR_PALETTES[resolvedColor][variant];
});

const buttonClass = computed<string>(() => {
    const base =
        'inline-flex items-center gap-2 cursor-pointer rounded-md transition font-semibold text-xs select-none';
    const spacing = variant === 'icon' ? 'p-1.5' : slots.icon ? 'py-2 pl-2.5 pr-3' : 'py-2 px-3';
    const disabledClass = disabled ? 'disabled:cursor-not-allowed disabled:opacity-50' : '';
    const layoutClass = fullWidth ? 'w-full justify-center' : 'justify-center';
    const hoverClass = !disabled ? currentVariantConfig.value.hover : '';
    const textClass = currentVariantConfig.value.text;
    const bgClass = currentVariantConfig.value.bg || '';
    const borderClass = currentVariantConfig.value.border || '';

    return [base, spacing, disabledClass, layoutClass, hoverClass, textClass, bgClass, borderClass]
        .filter(Boolean)
        .join(' ');
});

function handleClick(event: MouseEvent): void {
    if (disabled) {
        event.preventDefault();
        event.stopPropagation();
        return;
    }

    emit('click', event);
}
</script>

<template>
    <button
        :type="type"
        :class="buttonClass"
        :disabled="disabled"
        :aria-label="variant === 'icon' ? label : undefined"
        @click="handleClick">
        <slot
            v-if="slots.icon"
            name="icon" />
        <span
            v-if="variant !== 'icon'"
            class="inline-flex items-center">
            <slot>{{ label }}</slot>
        </span>
    </button>
</template>
