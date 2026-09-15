<script setup lang="ts">
import { getCurrentDate, formatDate } from '@/utils/date';
</script>

<template>
    <div class="flex shrink-0 items-start justify-between">
        <div>
            <h1 class="text-xl font-bold text-mist-100"><slot name="title">Title</slot></h1>
            <div class="mt-1 text-xs text-mist-400">
                <slot name="subtitle">Subtitle</slot>
            </div>
        </div>
        <div class="text-xs text-mist-500">
            {{ formatDate(getCurrentDate(), { includeYear: true }) }}
        </div>
    </div>
</template>
