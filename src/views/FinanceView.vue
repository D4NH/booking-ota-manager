<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useFinanceSync } from '@/composables/useFinanceSync';
import { useGoogleSheets } from '@/composables/useGoogleSheets';
import { useFinanceStore } from '@/stores/useFinanceStore';

import PageTitle from '@/components/PageTitle.vue';
import MonthSelector from '@/components/finance/MonthSelector.vue';
import FinancePropertyMetrics from '@/components/finance/FinancePropertyMetrics.vue';
import FinancePropertyTable from '@/components/finance/FinancePropertyTable.vue';

const financeStore = useFinanceStore();
const { syncAllFinancialData } = useFinanceSync();
const { isAuthenticated, refreshAuthStatus } = useGoogleSheets();

const isSyncing = ref(false);

const handleFinanceSync = async () => await syncAllFinancialData();

onMounted(async () => {
    await financeStore.loadLocalFinanceData();
    await financeStore.fetchRecurringTemplates();

    if (refreshAuthStatus() || isAuthenticated.value) {
        await syncAllFinancialData({ silent: true });
    }
});
</script>

<template>
    <div class="h-full overflow-y-auto space-y-4 p-4">
        <PageTitle>
            <template #title>Finance Dashboard</template>
            <template #subtitle> Property, Personal and Shared Finances </template>

            <div class="flex items-center gap-2">
                <button
                    type="button"
                    :disabled="isSyncing"
                    class="cursor-pointer flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium border transition disabled:opacity-50"
                    :class="[
                        isAuthenticated
                            ? 'border-lime-500/30 bg-lime-500/10 text-lime-300 hover:bg-lime-500/20'
                            : 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20',
                    ]"
                    @click="handleFinanceSync">
                    <span
                        class="h-2 w-2 rounded-full shrink-0"
                        :class="[
                            isSyncing
                                ? 'bg-indigo-400 animate-ping'
                                : isAuthenticated
                                  ? 'bg-lime-400 animate-pulse'
                                  : 'bg-amber-400',
                        ]" />
                    <span>
                        {{ isAuthenticated ? 'Sync Finances' : 'Connect & Sync' }}
                    </span>
                </button>

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
