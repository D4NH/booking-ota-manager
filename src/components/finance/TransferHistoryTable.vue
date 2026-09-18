<script setup lang="ts">
import { ref } from 'vue';
import { storeToRefs } from 'pinia';
import { getPropertyStyle } from '@/config/properties';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { formatIDR } from '@/utils/money';

import CardTitle from '@/components/CardTitle.vue';
import TransferModal from '@/components/modal/TransferModal.vue';

const financeStore = useFinanceStore();
const { filteredTransfers } = storeToRefs(financeStore);

const isTransferModalOpen = ref(false);
</script>

<template>
    <div class="flex flex-col">
        <div class="flex items-center justify-between">
            <CardTitle>
                <template #title>Transfers & Payouts</template>
                <template #subtitle>
                    Distributions from rental operations into personal or joint pools
                </template>
            </CardTitle>

            <!-- <span
                class="text-xs font-mono font-bold bg-lime-400/10 text-lime-400 border border-lime-400/20 px-2.5 py-1 rounded-lg">
                {{ filteredTransfers.length }} Record(s)
            </span> -->

            <button
                class="bg-lime-400 hover:bg-lime-300 text-mist-950 text-xs font-bold px-3.5 py-2 rounded-md transition shadow"
                @click="isTransferModalOpen = true">
                Transfer Funds
            </button>
        </div>

        <div class="overflow-x-auto rounded-md border border-mist-800 bg-mist-900 shadow-md">
            <table class="w-full text-left text-sm text-mist-200 table-fixed">
                <thead
                    class="border-b border-mist-800/50 bg-mist-950/40 text-xs font-semibold uppercase text-mist-400">
                    <tr>
                        <th class="w-35 py-3 px-3">Date</th>
                        <th class="w-35 py-3 px-3">Property</th>
                        <th class="w-55 py-3 px-3">Destination</th>
                        <th class="py-3 px-3">Notes</th>
                        <th class="py-3 px-3 text-right">Amount</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-mist-800/60">
                    <tr
                        v-for="transfer in filteredTransfers"
                        :key="transfer.id"
                        class="hover:bg-mist-850/50">
                        <td class="py-3 px-3 text-mist-400 text-xs font-mono">
                            {{ transfer.date }}
                        </td>
                        <td class="py-3 px-3">
                            <!-- <span class="inline-flex items-center gap-1.5 capitalize">
                                <span class="w-2 h-2 rounded-full bg-lime-400"></span>
                                {{ transfer.sourcePropertyId }}
                            </span> -->
                            <RouterLink
                                :to="{
                                    name: 'property-detail',
                                    params: { id: transfer.sourcePropertyId },
                                }"
                                :class="getPropertyStyle(transfer.sourcePropertyId)">
                                {{ transfer.sourcePropertyId }}
                            </RouterLink>
                        </td>
                        <td class="py-3 px-3">
                            {{ transfer.targetAccount }}
                        </td>
                        <td class="py-3 px-3 text-mist-400 flex items-center gap-1.5">
                            {{ transfer.notes || 'General dividend distribution' }}
                        </td>
                        <td class="py-3 px-3 text-right font-bold font-mono text-xs">
                            {{ formatIDR(transfer.amount) }}
                        </td>
                    </tr>
                    <tr v-if="filteredTransfers.length === 0">
                        <td
                            colspan="5"
                            class="py-6 text-center text-mist-400 font-sans">
                            No payouts logged for this month.
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <TransferModal v-model="isTransferModalOpen" />
    </div>
</template>
