<script setup lang="ts">
import { computed, useSlots } from 'vue';

export type ButtonColor = 'default' | 'blue' | 'amber' | 'mist' | 'lime';

export type VariantType =
    | 'primary'
    | 'secondary'
    | 'outline'
    | 'text'
    | 'icon'
    | 'danger'
    | 'danger-outline'
    | 'danger-text'
    | 'danger-icon';

interface ButtonVariantConfig {
    bg?: string;
    text: string;
    hover: string;
    border?: string;
}

const defaultPrimary: ButtonVariantConfig = {
    bg: 'bg-lime-500',
    text: 'text-mist-950',
    hover: 'hover:bg-lime-400',
};
const solidColorMap: Record<Exclude<ButtonColor, 'default'>, ButtonVariantConfig> = {
    blue: {
        bg: 'bg-blue-400',
        text: 'text-mist-950',
        hover: 'hover:bg-blue-300',
    },
    amber: {
        bg: 'bg-amber-300',
        text: 'text-mist-950',
        hover: 'hover:bg-amber-400',
    },
    mist: {
        bg: 'bg-mist-400',
        text: 'text-mist-950',
        hover: 'hover:bg-mist-500',
    },
    lime: {
        bg: 'bg-lime-400',
        text: 'text-mist-950',
        hover: 'hover:bg-lime-500',
    },
};

const outlineColorMap: Record<Exclude<ButtonColor, 'default'>, ButtonVariantConfig> = {
    blue: {
        bg: 'bg-transparent',
        text: 'text-blue-400',
        border: 'border border-blue-500/40',
        hover: 'hover:bg-blue-500/10 hover:border-blue-400',
    },
    amber: {
        bg: 'bg-transparent',
        text: 'text-amber-400',
        border: 'border border-amber-500/40',
        hover: 'hover:bg-amber-500/10 hover:border-amber-400',
    },
    mist: {
        bg: 'bg-transparent',
        text: 'text-mist-400',
        border: 'border border-mist-500/40',
        hover: 'hover:bg-blue-500/10 hover:border-mist-400',
    },
    lime: {
        bg: 'bg-transparent',
        text: 'text-lime-400',
        border: 'border border-lime-500/40',
        hover: 'hover:bg-lime-500/10 hover:border-lime-400',
    },
};

const textColorMap: Record<Exclude<ButtonColor, 'default'>, ButtonVariantConfig> = {
    blue: { text: 'text-blue-400', hover: 'hover:text-blue-300' },
    amber: { text: 'text-amber-400', hover: 'hover:text-amber-300' },
    mist: { text: 'text-mist-400', hover: 'hover:text-mist-300' },
    lime: { text: 'text-lime-400', hover: 'hover:text-lime-300' },
};

interface Props {
    type?: 'button' | 'submit' | 'reset';
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
    (e: 'click', event: MouseEvent): void;
}>();

const slots = useSlots();

const currentVariantConfig = computed<ButtonVariantConfig>(() => {
    if (color !== 'default') {
        if (variant === 'outline') {
            return outlineColorMap[color];
        }
        if (variant === 'text' || variant === 'icon') {
            return textColorMap[color];
        }
        return solidColorMap[color];
    }

    switch (variant) {
        case 'outline':
            return {
                bg: 'bg-transparent',
                text: 'text-lime-500',
                border: 'border border-lime-500',
                hover: 'hover:bg-lime-500/10',
            };
        case 'text':
        case 'icon':
            return {
                text: 'text-mist-400',
                hover: 'hover:text-mist-200',
            };
        case 'danger':
            return {
                bg: 'bg-red-500',
                text: 'text-white',
                hover: 'hover:bg-red-600',
            };
        case 'danger-outline':
            return {
                bg: 'bg-transparent',
                text: 'text-rose-400',
                border: 'border border-rose-500/40',
                hover: 'hover:bg-rose-500/10',
            };
        case 'danger-text':
        case 'danger-icon':
            return {
                text: 'text-rose-400',
                hover: 'hover:text-rose-300',
            };
        case 'primary':
        default:
            return defaultPrimary;
    }
});

const buttonClass = computed(() => {
    const base =
        'inline-flex items-center gap-2 cursor-pointer rounded-md transition font-semibold text-xs select-none';
    const iconSpacing = slots.icon
        ? variant === 'icon' || variant === 'danger-icon'
            ? 'p-1'
            : 'py-2 pl-2.5 pr-3'
        : 'py-2 px-3';
    const disabledClass = disabled ? 'disabled:cursor-not-allowed disabled:opacity-50' : '';
    const layoutClass = fullWidth ? 'w-full justify-center' : 'justify-center';
    const hoverClass = !disabled ? currentVariantConfig.value.hover : '';
    const textClass = currentVariantConfig.value.text;
    const bgClass = currentVariantConfig.value.bg || '';
    const borderClass = currentVariantConfig.value.border || '';

    return [
        base,
        iconSpacing,
        disabledClass,
        layoutClass,
        hoverClass,
        textClass,
        bgClass,
        borderClass,
    ]
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
            v-if="variant !== 'icon' && variant !== 'danger-icon'"
            class="inline-flex items-center">
            <slot>{{ label }}</slot>
        </span>
    </button>
</template>
