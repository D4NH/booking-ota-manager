<script setup lang="ts">
// import { getCurrentDate, formatDate } from '@/utils/date';
</script>

<template>
    <div class="flex shrink-0 items-center justify-between relative">
        <div>
            <h1 class="text-xl font-bold text-mist-100"><slot name="title">Title</slot></h1>
            <div class="mt-1 text-xs text-mist-400">
                <slot name="subtitle">Subtitle</slot>
            </div>
        </div>
        <slot />
        <!-- <div class="absolute top-4 right-4 text-xs text-mist-500">
            {{ formatDate(getCurrentDate(), { includeYear: true }) }}
        </div> -->
    </div>
</template>
