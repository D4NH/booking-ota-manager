<script setup lang="ts">
import { ref, computed } from 'vue';

const props = withDefaults(
    defineProps<{
        text: string | undefined;
        characters?: string;
    }>(),
    {
        characters: '!@#$%^&*()_+-=~0123456789',
    }
);

const isHovered = ref(false);

// Generate scrambled string preserving spaces
const scrambledText = computed(() => {
    const chars = props.characters;
    if (!props.text) return '';
    return props.text
        .split('')
        .map((char) => (char === ' ' ? ' ' : chars[Math.floor(Math.random() * chars.length)]))
        .join('');
});
</script>

<template>
    <span
        class="cursor-pointer select-none font-mono text-sm font-bold text-mist-100"
        @mouseenter="isHovered = true"
        @mouseleave="isHovered = false">
        {{ isHovered ? text : scrambledText }}
    </span>
</template>
