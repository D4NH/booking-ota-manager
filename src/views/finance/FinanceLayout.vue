<script setup lang="ts">
import { RouterView } from 'vue-router';
import PageTitle from '@/components/PageTitle.vue';
import MonthSelector from '@/components/MonthSelector.vue';
</script>

<template>
    <div class="h-full space-y-4 overflow-y-auto p-4">
        <PageTitle>
            <template #title>Finance Dashboard</template>
            <template #subtitle>Property, Personal and Shared Finances</template>

            <MonthSelector />
        </PageTitle>

        <RouterView />
    </div>
</template>
