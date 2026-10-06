<script setup lang="ts">
import { ref, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { formatIDR } from '@/utils/money';
import type { SavingGoal, PersonalOwner } from '@/types/finance';
import SavingGoalModal from '@/features/finance/SavingGoalModal.vue';
import TransferSavingsModal from '@/features/finance/TransferSavingsModal.vue';

interface Props {
    owner?: PersonalOwner | 'Shared';
}

const { owner = 'Danh Nguyen' } = defineProps<Props>();

const financeStore = useFinanceStore();
const { dynamicSavingsAccounts, dynamicAllocatedGoals } = storeToRefs(financeStore);

const isGoalModalOpen = ref<boolean>(false);
const editingGoal = ref<SavingGoal | null>(null);
const isTransferModalOpen = ref<boolean>(false);
const selectedAccountKey = ref<string>('');

const scopedAccounts = computed(() => {
    const list = dynamicSavingsAccounts.value || [];
    return list.filter((acc) => acc.owner === owner);
});
const scopedGoals = computed(() => {
    const list = dynamicAllocatedGoals.value || [];
    return list.filter((goal) => goal.owner === owner);
});

function openTransferModal(preselectedKey?: string): void {
    selectedAccountKey.value = preselectedKey || '';
    isTransferModalOpen.value = true;
}
function openAddGoal(): void {
    editingGoal.value = null;
    isGoalModalOpen.value = true;
}
function openEditGoal(goal: SavingGoal): void {
    editingGoal.value = goal;
    isGoalModalOpen.value = true;
}
function handleCloseGoalModal(): void {
    editingGoal.value = null;
}
function handleCloseTransferModal(): void {
    selectedAccountKey.value = '';
}
</script>

<template>
    <div class="rounded-md border border-mist-800 bg-mist-900 p-4 shadow-sm">
        <div class="mb-4 flex h-7 items-center justify-between">
            <div class="flex items-center gap-2">
                <span class="h-2.5 w-2.5 rounded-full bg-blue-400" />
                <h3 class="text-xs font-semibold tracking-wider text-mist-400 uppercase">
                    Saving Accounts
                </h3>
            </div>
            <button
                v-if="scopedAccounts.length > 0"
                type="button"
                class="flex cursor-pointer items-center gap-1.5 rounded border border-mist-700 bg-mist-800 px-2 py-1.5 text-xs font-semibold text-blue-400 transition hover:bg-mist-700"
                @click="openTransferModal()">
                <fa-icon
                    class="text-[10px]"
                    icon="arrow-right-arrow-left" />
                <span>Transfer Savings</span>
            </button>
        </div>

        <div class="mb-6 overflow-x-auto">
            <table class="w-full table-fixed border-collapse text-left text-xs text-mist-200">
                <thead
                    class="border-y border-mist-800 bg-mist-950/50 font-semibold text-mist-400 uppercase">
                    <tr>
                        <th class="w-28 px-3 py-2.5">Updated</th>
                        <th class="px-3 py-2.5">Institution</th>
                        <th class="w-32 px-3 py-2.5 text-right">Balance</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-mist-800/60">
                    <tr
                        v-for="acc in scopedAccounts"
                        :key="acc.key">
                        <td class="px-3 py-2.5 font-mono text-mist-400">{{ acc.lastUpdated }}</td>
                        <td class="flex items-center gap-1.5 px-3 py-2.5">
                            <span class="h-2 w-2 rounded-full bg-blue-400" />
                            <span>{{ acc.institution }}</span>
                        </td>
                        <td class="px-3 py-2.5 text-right font-mono font-medium text-blue-400">
                            {{ formatIDR(acc.balance) }}
                        </td>
                    </tr>
                    <tr v-if="scopedAccounts.length === 0">
                        <td
                            colspan="3"
                            class="py-2.5 text-center text-mist-400">
                            No savings accounts found for {{ owner }}.
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="mb-3 flex items-center justify-between border-t border-mist-800/80 pt-3">
            <div class="flex items-center gap-2">
                <span class="h-2.5 w-2.5 rounded-full bg-blue-400" />
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
                <span>Add Goal</span>
            </button>
        </div>

        <div class="space-y-2 divide-y divide-mist-800">
            <div
                v-for="goal in scopedGoals"
                :key="goal.id"
                class="-mx-2 mb-1.5 cursor-pointer rounded-md px-2 pt-1 pb-3 transition hover:bg-mist-800/40"
                @click="openEditGoal(goal)">
                <div class="flex items-center justify-between gap-2">
                    <div>
                        <div class="flex items-center gap-1.5">
                            <span class="text-xs font-semibold text-mist-100">{{ goal.name }}</span>
                            <span
                                class="py-0.2 rounded px-1.5 font-mono text-[9px] font-semibold uppercase"
                                :class="[
                                    goal.owner === 'Shared'
                                        ? 'border border-blue-400/20 bg-blue-400/10 text-blue-400'
                                        : 'border border-mist-700 bg-mist-800 text-mist-300',
                                ]">
                                {{ goal.owner.split(' ')[0] }}
                            </span>
                        </div>
                        <p
                            v-if="goal.notes"
                            class="mt-0.5 text-[11px] text-mist-400">
                            {{ goal.notes }}
                        </p>
                    </div>

                    <div class="flex shrink-0 items-center gap-2.5 font-mono text-xs">
                        <span class="text-mist-300">{{ formatIDR(goal.allocatedAmount) }}</span>
                        <span class="text-mist-500">/</span>
                        <span class="text-mist-200">{{ formatIDR(goal.targetAmount) }}</span>
                        <fa-icon
                            class="text-xs text-mist-500"
                            icon="pen-to-square" />
                    </div>
                </div>

                <div class="mt-2 mb-1.5 h-1.5 w-full overflow-hidden rounded-full bg-mist-950/50">
                    <div
                        class="h-full bg-blue-400 transition-all duration-500"
                        :style="{ width: `${goal.progressPct}%` }" />
                </div>

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
                        class="font-bold text-blue-400">
                        {{ goal.progressPct }}%
                    </span>
                </div>
            </div>

            <div
                v-if="scopedGoals.length === 0"
                class="py-8 text-center text-xs text-mist-400">
                No active savings goals found for {{ owner }}.
            </div>
        </div>

        <SavingGoalModal
            v-model="isGoalModalOpen"
            :item-to-edit="editingGoal"
            @closed="handleCloseGoalModal" />

        <TransferSavingsModal
            v-model="isTransferModalOpen"
            :preselected-key="selectedAccountKey"
            @closed="handleCloseTransferModal" />
    </div>
</template>
