<script setup lang="ts">
import GoogleSyncButton from '@/components/GoogleSyncButton.vue';
import PageTitle from '@/components/PageTitle.vue';
import MonthSelector from '@/components/finance/MonthSelector.vue';
import FinancePropertyMetrics from '@/components/finance/FinancePropertyMetrics.vue';
import FinancePropertyTable from '@/components/finance/FinancePropertyTable.vue';
</script>

<template>
    <div class="h-full overflow-y-auto space-y-4 p-4">
        <PageTitle>
            <template #title>Finance Dashboard</template>
            <template #subtitle> Property, Personal and Shared Finances </template>

            <div class="flex items-center gap-2">
                <GoogleSyncButton scope="finance" />
                <MonthSelector />
            </div>
        </PageTitle>

        <div class="space-y-4">
            <FinancePropertyMetrics />

            <div class="grid grid-cols-3 gap-4">
                <FinancePropertyTable class="col-span-2" />
                <div>1</div>
            </div>
        </div>
    </div>
</template>
