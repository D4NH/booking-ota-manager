<script setup lang="ts">
import GoogleSyncButton from '@/components/GoogleSyncButton.vue';
import PageTitle from '@/components/PageTitle.vue';
import MonthSelector from '@/components/MonthSelector.vue';
import FinancePropertyMetrics from '@/features/finance/PropertyMetrics.vue';
import FinancePropertyTable from '@/features/finance/PropertyTable.vue';
import FinancePropertyBreakdown from '@/features/finance/PropertyBreakdown.vue';
import CashFlow from '@/features/finance/CashFlow.vue';
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

            <div class="grid grid-cols-2 gap-4 h-115">
                <CashFlow />
                <FinancePropertyBreakdown />
            </div>
            <FinancePropertyTable class="h-162" />
        </div>
    </div>
</template>
