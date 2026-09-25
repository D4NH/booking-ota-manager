<script setup lang="ts">
import { ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useFinanceSync } from '@/composables/useFinanceSync';
import { formatIDR } from '@/utils/money';

import SavingGoalModal from '@/features/finance/SavingGoalModal.vue';
import TransferSavingsModal from '@/features/finance/TransferSavingsModal.vue'; // <── Imported

const financeStore = useFinanceStore();
const { dynamicSavingsAccounts, dynamicAllocatedGoals } = storeToRefs(financeStore);
const { removeSavingGoal } = useFinanceSync();

const isGoalModalOpen = ref(false);
const isTransferModalOpen = ref(false);
const selectedAccountKey = ref('');

function openTransferModal(preselectedKey?: string): void {
    selectedAccountKey.value = preselectedKey || '';
    isTransferModalOpen.value = true;
}
async function handleDeleteGoal(id: string, name: string): Promise<void> {
    await removeSavingGoal(id, name);
}
</script>

<template>
    <div class="bg-mist-900 rounded-md border border-mist-800 p-4 shadow-sm">
        <!-- Accounts Header -->
        <div class="flex items-center justify-between mb-4 h-7">
            <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-blue-400"></span>
                <h3 class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                    Saving Accounts
                </h3>
            </div>
            <button
                v-if="dynamicSavingsAccounts.length > 0"
                type="button"
                class="bg-mist-800 hover:bg-mist-700 text-blue-400 border border-mist-700 rounded text-xs font-semibold px-2 py-1 transition cursor-pointer flex items-center gap-1.5"
                @click="openTransferModal()">
                <fa-icon
                    class="text-[10px]"
                    icon="arrow-right-arrow-left" />
                Transfer Savings
            </button>
        </div>

        <div class="overflow-x-auto mb-6">
            <table class="w-full text-left text-xs text-mist-200 table-fixed border-collapse">
                <thead
                    class="bg-mist-950/50 text-mist-400 uppercase font-semibold border-y border-mist-800">
                    <tr>
                        <th class="w-25 py-2.5 px-3">Last Active</th>
                        <th class="w-26 py-2.5 px-3">Owner</th>
                        <th class="py-2.5 px-3">Institution</th>
                        <th class="w-32 py-2.5 px-3 text-right">Total Balance</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-mist-800/60 font-mono">
                    <tr
                        v-for="acc in dynamicSavingsAccounts"
                        :key="acc.key"
                        class="hover:bg-mist-800/50 transition-colors cursor-pointer"
                        title="Click to transfer from this account"
                        @click="openTransferModal(acc.key)">
                        <td class="py-2.5 px-3 text-mist-400">{{ acc.lastUpdated }}</td>
                        <td class="py-2.5 px-3 font-medium text-mist-100">
                            {{ acc.owner }}
                        </td>
                        <td class="py-2.5 px-3 flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-blue-400"></span>
                            {{ acc.institution }}
                        </td>
                        <td class="py-2.5 px-3 text-right font-semibold text-blue-400">
                            {{ formatIDR(acc.balance) }}
                        </td>
                    </tr>
                    <tr v-if="dynamicSavingsAccounts.length === 0">
                        <td
                            colspan="4"
                            class="py-6 text-center text-mist-400">
                            No personal transactions categorized as "Savings" yet.
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Saving Goals Section Header -->
        <div class="flex items-center justify-between mb-3 pt-2 border-t border-mist-800/80">
            <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-blue-400"></span>
                <h3 class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                    Saving Goals
                </h3>
            </div>
            <button
                type="button"
                class="bg-mist-800 hover:bg-mist-700 text-blue-400 border border-mist-700 rounded text-xs font-semibold px-2 py-1 transition cursor-pointer"
                @click="isGoalModalOpen = true">
                <fa-icon
                    class="text-[10px]"
                    icon="plus" />
                Add Goal
            </button>
        </div>

        <!-- Goals List -->
        <div class="space-y-2 divide-y divide-mist-800">
            <div
                v-for="goal in dynamicAllocatedGoals"
                :key="goal.id"
                class="pb-3 pt-1">
                <div class="flex items-center justify-between gap-2">
                    <div>
                        <div class="flex items-center gap-1.5">
                            <span class="text-xs font-semibold text-mist-100">
                                {{ goal.name }}
                            </span>
                            <span
                                class="text-[9px] px-1.5 py-0.2 rounded font-mono font-semibold uppercase"
                                :class="
                                    goal.owner === 'Shared'
                                        ? 'bg-blue-400/10 text-blue-400 border border-blue-400/20'
                                        : 'bg-mist-800 text-mist-300 border border-mist-700'
                                ">
                                {{ goal.owner.split(' ')[0] }}
                            </span>
                        </div>
                        <p
                            v-if="goal.notes"
                            class="text-[11px] text-mist-400 mt-0.5">
                            {{ goal.notes }}
                        </p>
                    </div>

                    <!-- Financial Values & Delete Action -->
                    <div class="flex items-center gap-2.5 shrink-0">
                        <div class="text-right font-mono text-xs">
                            <span class="text-mist-300">
                                {{ formatIDR(goal.allocatedAmount) }}
                            </span>
                            <span class="text-mist-500 mx-1">/</span>
                            <span class="text-mist-200">{{ formatIDR(goal.targetAmount) }}</span>
                        </div>
                        <button
                            type="button"
                            class="text-mist-500 hover:text-rose-400 p-1 -mt-1 transition opacity-60 hover:opacity-100 cursor-pointer rounded"
                            title="Delete Saving Goal"
                            @click="handleDeleteGoal(goal.id, goal.name)">
                            <fa-icon
                                class="text-xs"
                                icon="trash-can" />
                        </button>
                    </div>
                </div>

                <!-- Progress Bar -->
                <div class="w-full bg-mist-950/50 h-1.5 rounded-full overflow-hidden my-2">
                    <div
                        class="h-full rounded-full transition-all duration-500 bg-blue-400"
                        :style="{ width: `${goal.progressPct}%` }"></div>
                </div>

                <!-- Footer Status -->
                <div class="flex justify-between items-center text-xs font-mono text-mist-400">
                    <span>
                        <template v-if="goal.isCompleted">
                            <strong class="text-blue-400">✓ Goal Achieved</strong>
                        </template>
                        <template v-else>
                            Need:
                            <strong class="text-mist-200">
                                {{ formatIDR(goal.remainingAmount) }}
                            </strong>
                        </template>
                    </span>
                    <span
                        v-if="!goal.isCompleted"
                        class="px-1.5 py-0.2 text-blue-400">
                        {{ `${goal.progressPct}%` }}
                    </span>
                </div>
            </div>

            <div
                v-if="dynamicAllocatedGoals.length === 0"
                class="py-6 text-center text-xs text-mist-400">
                No active savings goals defined.
            </div>
        </div>

        <!-- External Modals -->
        <SavingGoalModal v-model="isGoalModalOpen" />
        <TransferSavingsModal
            v-model="isTransferModalOpen"
            :preselected-key="selectedAccountKey"
            @closed="selectedAccountKey = ''" />
    </div>
</template>
