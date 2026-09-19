<script setup lang="ts">
import { computed } from 'vue';

interface Props {
    notes?: string;
}

const { notes = '' } = defineProps<Props>();

const isRecurring = computed(() => /\[RECURRING\]/i.test(notes));
const cleanNote = computed(() => notes.replace(/\[RECURRING\]/gi, '').trim());
</script>

<template>
    <span class="inline-flex items-center gap-1.5 flex-wrap">
        <span
            v-if="isRecurring"
            title="Recurring Commitment"
            class="inline-flex items-center text-lime-400">
            <fa-icon
                class="text-sm"
                icon="arrows-rotate" />
        </span>
        <span v-if="cleanNote">{{ cleanNote }}</span>
    </span>
</template>
