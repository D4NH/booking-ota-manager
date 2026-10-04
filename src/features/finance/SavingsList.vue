<script setup lang="ts">
import { ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { formatIDR } from '@/utils/money';
import type { SavingGoal } from '@/types/finance';

import SavingGoalModal from '@/features/finance/SavingGoalModal.vue';
import TransferSavingsModal from '@/features/finance/TransferSavingsModal.vue'; // <── Imported

const financeStore = useFinanceStore();
const { dynamicSavingsAccounts, dynamicAllocatedGoals } = storeToRefs(financeStore);

const isGoalModalOpen = ref(false);
const editingGoal = ref<SavingGoal | null>(null);
const isTransferModalOpen = ref(false);
const selectedAccountKey = ref('');

function openTransferModal(preselectedKey?: string): void {
    selectedAccountKey.value = preselectedKey || '';
    isTransferModalOpen.value = true;
}
const openAddGoal = () => {
    editingGoal.value = null;
    isGoalModalOpen.value = true;
};

const openEditGoal = (goal: SavingGoal) => {
    editingGoal.value = goal;
    isGoalModalOpen.value = true;
};
</script>

<template>
    <div class="rounded-md border border-mist-800 bg-mist-900 p-4 shadow-sm">
        <!-- Accounts Header -->
        <div class="mb-4 flex h-7 items-center justify-between">
            <div class="flex items-center gap-2">
                <span class="h-2.5 w-2.5 rounded-full bg-blue-400"></span>
                <h3 class="text-xs font-semibold tracking-wider text-mist-400 uppercase">
                    Saving Accounts
                </h3>
            </div>
            <button
                v-if="dynamicSavingsAccounts.length > 0"
                type="button"
                class="flex cursor-pointer items-center gap-1.5 rounded border border-mist-700 bg-mist-800 px-2 py-1 text-xs font-semibold text-blue-400 transition hover:bg-mist-700"
                @click="openTransferModal()">
                <fa-icon
                    class="text-[10px]"
                    icon="arrow-right-arrow-left" />
                Transfer Savings
            </button>
        </div>

        <!-- <div class="flex flex-col justify-between"> -->
        <div class="mb-6 overflow-x-auto">
            <table class="w-full table-fixed border-collapse text-left text-xs text-mist-200">
                <thead
                    class="border-y border-mist-800 bg-mist-950/50 font-semibold text-mist-400 uppercase">
                    <tr>
                        <th class="w-25 px-3 py-2.5">Last Active</th>
                        <th class="w-26 px-3 py-2.5">Owner</th>
                        <th class="px-3 py-2.5">Institution</th>
                        <th class="w-32 px-3 py-2.5 text-right">Total Balance</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-mist-800/60 font-mono">
                    <tr
                        v-for="acc in dynamicSavingsAccounts"
                        :key="acc.key">
                        <td class="px-3 py-2.5 text-mist-400">{{ acc.lastUpdated }}</td>
                        <td class="px-3 py-2.5 font-medium text-mist-100">
                            {{ acc.owner }}
                        </td>
                        <td class="flex items-center gap-1.5 px-3 py-2.5">
                            <span class="h-2 w-2 rounded-full bg-blue-400"></span>
                            {{ acc.institution }}
                        </td>
                        <td class="px-3 py-2.5 text-right font-semibold text-blue-400">
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
        <div class="mb-3 flex items-center justify-between border-t border-mist-800/80 pt-2">
            <div class="flex items-center gap-2">
                <span class="h-2.5 w-2.5 rounded-full bg-blue-400"></span>
                <h3 class="text-xs font-semibold tracking-wider text-mist-400 uppercase">
                    Saving Goals
                </h3>
            </div>
            <button
                type="button"
                class="flex cursor-pointer items-center gap-1.5 rounded border border-mist-700 bg-mist-800 px-2 py-1 text-xs font-semibold text-blue-400 transition hover:bg-mist-700"
                @click="openAddGoal">
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
                class="-mx-2 mb-1.5 cursor-pointer rounded-md px-2 pt-1 pb-3 transition hover:bg-mist-800/40"
                @click="openEditGoal(goal)">
                <div class="flex items-center justify-between gap-2">
                    <div>
                        <div class="flex items-center gap-1.5">
                            <span class="text-xs font-semibold text-mist-100">
                                {{ goal.name }}
                            </span>
                            <span
                                class="py-0.2 rounded px-1.5 font-mono text-[9px] font-semibold uppercase"
                                :class="
                                    goal.owner === 'Shared'
                                        ? 'border border-blue-400/20 bg-blue-400/10 text-blue-400'
                                        : 'border border-mist-700 bg-mist-800 text-mist-300'
                                ">
                                {{ goal.owner.split(' ')[0] }}
                            </span>
                        </div>
                        <p
                            v-if="goal.notes"
                            class="mt-0.5 text-[11px] text-mist-400">
                            {{ goal.notes }}
                        </p>
                    </div>

                    <!-- Financial Values -->
                    <div class="flex shrink-0 items-center gap-2.5">
                        <div class="text-right font-mono text-xs">
                            <span class="text-mist-300">
                                {{ formatIDR(goal.allocatedAmount) }}
                            </span>
                            <span class="mx-1 text-mist-500">/</span>
                            <span class="text-mist-200">{{ formatIDR(goal.targetAmount) }}</span>
                        </div>
                        <span class="-mt-1 p-1 text-mist-500">
                            <fa-icon
                                class="text-xs"
                                icon="pen-to-square" />
                        </span>
                    </div>
                </div>

                <!-- Progress Bar -->
                <div class="my-2 h-1.5 w-full overflow-hidden rounded-full bg-mist-950/50">
                    <div
                        class="h-full rounded-full bg-blue-400 transition-all duration-500"
                        :style="{ width: `${goal.progressPct}%` }"></div>
                </div>

                <!-- Footer Status -->
                <div class="flex items-center justify-between font-mono text-xs text-mist-400">
                    <span>
                        <template v-if="goal.isCompleted">
                            <strong class="text-blue-400">
                                <fa-icon icon="check" /> Goal Achieved
                            </strong>
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
                        class="py-0.2 px-1.5 text-blue-400">
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

        <SavingGoalModal
            v-model="isGoalModalOpen"
            :item-to-edit="editingGoal"
            @closed="editingGoal = null" />
        <TransferSavingsModal
            v-model="isTransferModalOpen"
            :preselected-key="selectedAccountKey"
            @closed="selectedAccountKey = ''" />
    </div>
</template>
