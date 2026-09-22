<script setup lang="ts">
import { ref, computed } from 'vue';

const { text, characters = '!@#$%^&*()_+-=~0123456789' } = defineProps<{
    text: string | undefined;
    characters?: string;
}>();

const isHovered = ref(false);

const scrambledText = computed(() => {
    const chars = characters;
    if (!text) return '';
    return text
        .split('')
        .map((char) => (char === ' ' ? ' ' : chars[Math.floor(Math.random() * chars.length)]))
        .join('');
});
</script>

<template>
    <span
        class="cursor-pointer select-none font-mono text-sm font-semibold text-mist-100"
        @mouseenter="isHovered = true"
        @mouseleave="isHovered = false">
        {{ isHovered ? text : scrambledText }}
    </span>
</template>
