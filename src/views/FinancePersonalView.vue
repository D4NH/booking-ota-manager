<script setup lang="ts">
import { ref } from 'vue';

import GoogleSyncButton from '@/components/GoogleSyncButton.vue';
import PageTitle from '@/components/PageTitle.vue';
import MonthSelector from '@/components/finance/MonthSelector.vue';
import FinancePersonalMetrics from '@/components/finance/FinancePersonalMetrics.vue';
import FinancePersonalTable from '@/components/finance/FinancePersonalTable.vue';
import SavingsAndGold from '@/components/finance/SavingsAndGold.vue';
import TransferModal from '@/components/modal/TransferModal.vue';

const isTransferModalOpen = ref(false);
</script>

<template>
    <div class="h-full overflow-y-auto space-y-4 p-4">
        <PageTitle>
            <template #title>Finance Dashboard</template>
            <template #subtitle> Personal, Shared and Mai House Jogja </template>

            <div class="flex items-center gap-2">
                <GoogleSyncButton scope="finance" />
                <MonthSelector />
            </div>
        </PageTitle>

        <div class="space-y-4">
            <FinancePersonalMetrics />

            <div class="grid grid-cols-3 gap-4">
                <FinancePersonalTable class="col-span-2" />
                <div>1</div>
            </div>

            <SavingsAndGold />
        </div>

        <TransferModal v-model="isTransferModalOpen" />
    </div>
</template>
