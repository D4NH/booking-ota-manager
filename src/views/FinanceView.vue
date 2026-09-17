<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { toast } from 'vue-toastflow';
import { useFinanceSync } from '@/composables/useFinanceSync';
import { useGoogleSheets } from '@/composables/useGoogleSheets';

import PageTitle from '@/components/PageTitle.vue';
import MonthSelector from '@/components/finance/MonthSelector.vue';
import FinanceDashboard from '@/components/finance/FinanceDashboard.vue';
import PropertyFinanceTable from '@/components/finance/PropertyFinanceTable.vue';
import PersonalFinanceTable from '@/components/finance/PersonalFinanceTable.vue';
import SavingsAndGoldSection from '@/components/finance/SavingsAndGoldSection.vue';
import TransferHistoryTable from '@/components/finance/TransferHistoryTable.vue';
import RecurringChecklist from '@/components/finance/RecurringChecklist.vue';
import TransferModal from '@/components/modal/TransferModal.vue';

const { syncAllFinancialData } = useFinanceSync();
const { isAuthenticated, refreshAuthStatus, initAuth } = useGoogleSheets();

const isSyncing = ref(false);
const isTransferModalOpen = ref(false);

const handleFinanceSync = async (): Promise<void> => {
    if (isSyncing.value) return;

    refreshAuthStatus();
    if (!isAuthenticated.value) {
        try {
            await initAuth();
        } catch (authErr) {
            console.warn('[Sync] Auth aborted or failed:', authErr);
            return;
        }
    }

    isSyncing.value = true;

    try {
        await toast.loading(
            async () => {
                await syncAllFinancialData();
            },
            {
                loading: {
                    title: 'Syncing...',
                    description: 'Fetching sheets and updating local database.',
                },
                success: (data) => {
                    return {
                        title: 'Sync Complete',
                        description: `Imported all finance data: ${data}`,
                    };
                },
                error: (err) => ({
                    title: 'Sync failed',
                    description:
                        err instanceof Error ? err.message : 'Failed to fetch Google Sheets.',
                }),
            }
        );
    } finally {
        isSyncing.value = false;
    }
};

onMounted(async () => {
    const valid = refreshAuthStatus();
    if (valid || isAuthenticated.value) {
        await syncAllFinancialData();
    }
});
</script>

<template>
    <div class="h-full overflow-y-auto space-y-4 p-4">
        <PageTitle>
            <template #title>Finance Dashboard</template>
            <template #subtitle> Personal, Shared and Mai House Jogja </template>

            <div class="flex items-center space-x-3 w-full sm:w-auto">
                <button
                    type="button"
                    :disabled="isSyncing"
                    class="cursor-pointer flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold border transition disabled:opacity-50"
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
            <FinanceDashboard />
            <RecurringChecklist />
            <button
                class="bg-lime-400 hover:bg-lime-300 text-mist-950 text-xs font-bold px-3.5 py-2 rounded-md transition shadow"
                @click="isTransferModalOpen = true">
                Transfer Funds
            </button>
            <PersonalFinanceTable />
            <SavingsAndGoldSection />
            <PropertyFinanceTable />
            <TransferHistoryTable />
        </div>

        <TransferModal v-model="isTransferModalOpen" />
    </div>
</template>
