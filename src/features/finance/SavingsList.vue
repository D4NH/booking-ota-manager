<script setup lang="ts">
import { ref, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { toast } from 'vue-toastflow';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useFinanceSync } from '@/composables/useFinanceSync';
import { formatIDR } from '@/utils/money';
import { getCurrentDate } from '@/utils/date';
import SavingGoalModal from '@/features/finance/SavingGoalModal.vue';
import type { PersonalOwner } from '@/types/finance';

import SelectDropdown from '@/components/ui/SelectDropdown.vue';
import DatePicker from '@/components/ui/DatePicker.vue';
import TextInput from '@/components/ui/TextInput.vue';

const financeStore = useFinanceStore();
const { dynamicSavingsAccounts, dynamicAllocatedGoals } = storeToRefs(financeStore);
const { removeSavingGoal, addPersonalTransaction, addSharedTransaction } = useFinanceSync();

const isGoalModalOpen = ref(false);
const isTransferModalOpen = ref(false);
const isSubmittingTransfer = ref(false);
const transferForm = ref({
    sourceKey: '',
    destinationType: 'savings' as 'savings' | 'checking',
    targetOwner: 'Danh Nguyen' as PersonalOwner | 'Shared',
    targetInstitution: 'Bank Jago',
    amount: '' as number | '',
    date: getCurrentDate(),
    notes: '',
});

const SAVINGS_INSTITUTIONS = ['BCA', 'Bank Jago', 'Blu by BCA', 'Seabank', 'Mandiri', 'Bibit'];
const targetOptions = [
    { label: 'Citra Ayu Wardani', value: 'Citra Ayu Wardani' },
    { label: 'Danh Nguyen', value: 'Danh Nguyen' },
    { label: 'Shared', value: 'Shared' },
];
const accountOptions = computed(() =>
    dynamicSavingsAccounts.value.map((account) => ({
        label: `${account.owner} - ${formatIDR(account.balance)} `,
        value: account.key,
    }))
);
const selectedSourceAccount = computed(() =>
    dynamicSavingsAccounts.value.find((acc) => acc.key === transferForm.value.sourceKey)
);

const openTransferModal = (preselectedKey?: string) => {
    const defaultSource = preselectedKey || dynamicSavingsAccounts.value[0]?.key || '';
    const firstAcc = dynamicSavingsAccounts.value.find((a) => a.key === defaultSource);

    transferForm.value = {
        sourceKey: defaultSource,
        destinationType: 'checking',
        targetOwner: (firstAcc?.owner as PersonalOwner | 'Shared') || 'Danh Nguyen',
        targetInstitution:
            SAVINGS_INSTITUTIONS.find((i) => i !== firstAcc?.institution) || 'Bank Jago',
        amount: '',
        date: getCurrentDate(),
        notes: '',
    };
    isTransferModalOpen.value = true;
};
const closeTransferModal = () => {
    isTransferModalOpen.value = false;
    transferForm.value.amount = '';
    transferForm.value.notes = '';
};
const executeSavingsTransfer = async () => {
    const source = selectedSourceAccount.value;
    const amountNum = Number(transferForm.value.amount);

    if (!source || !amountNum || amountNum <= 0) {
        toast.warning({
            title: 'Invalid Amount',
            description: 'Please enter a valid transfer amount greater than 0.',
        });
        return;
    }

    if (amountNum > source.balance) {
        toast.error({
            title: 'Insufficient Balance',
            description: `Transfer amount exceeds available balance (${formatIDR(source.balance)}).`,
        });
        return;
    }

    isSubmittingTransfer.value = true;
    try {
        const cleanDate = transferForm.value.date || getCurrentDate();
        const customNote = transferForm.value.notes?.trim();

        if (transferForm.value.destinationType === 'savings') {
            const targetInst = transferForm.value.targetInstitution;
            const targetOwner = transferForm.value.targetOwner;

            // Debit Source Savings (negative amount decreases savings balance)
            const debitNote = [`Transfer to [${targetInst}] (${targetOwner})`, customNote]
                .filter(Boolean)
                .join(' | ');

            await addPersonalTransaction({
                owner: source.owner as PersonalOwner,
                type: 'expense',
                category: 'Savings',
                amount: -Math.abs(amountNum),
                date: cleanDate,
                notes: debitNote,
                savingsInstitution: source.institution,
            });

            // Credit Target Savings (positive amount increases savings balance)
            const creditNote = [
                `Transfer from [${source.institution}] (${source.owner})`,
                customNote,
            ]
                .filter(Boolean)
                .join(' | ');

            if (targetOwner === 'Shared') {
                await addSharedTransaction({
                    type: 'expense',
                    category: 'Savings',
                    amount: Math.abs(amountNum),
                    date: cleanDate,
                    notes: creditNote,
                    savingsInstitution: targetInst,
                });
            } else {
                await addPersonalTransaction({
                    owner: targetOwner as PersonalOwner,
                    type: 'expense',
                    category: 'Savings',
                    amount: Math.abs(amountNum),
                    date: cleanDate,
                    notes: creditNote,
                    savingsInstitution: targetInst,
                });
            }
        } else {
            // Withdrawal
            const debitNote = [
                `Withdrawal to ${transferForm.value.targetOwner} checking`,
                customNote,
            ]
                .filter(Boolean)
                .join(' | ');

            await addPersonalTransaction({
                owner: source.owner as PersonalOwner,
                type: 'expense',
                category: 'Savings',
                amount: -Math.abs(amountNum),
                date: cleanDate,
                notes: debitNote,
                savingsInstitution: source.institution,
            });

            const creditNote = [
                `Transferred from ${source.owner} ${source.institution} savings`,
                customNote,
            ]
                .filter(Boolean)
                .join(' | ');

            if (transferForm.value.targetOwner === 'Shared') {
                await addSharedTransaction({
                    type: 'income',
                    category: 'Other',
                    amount: Math.abs(amountNum),
                    date: cleanDate,
                    notes: creditNote,
                });
            } else {
                await addPersonalTransaction({
                    owner: transferForm.value.targetOwner as PersonalOwner,
                    type: 'income',
                    category: 'Other',
                    amount: Math.abs(amountNum),
                    date: cleanDate,
                    notes: creditNote,
                });
            }
        }

        closeTransferModal();
    } catch (err: unknown) {
        console.error('Savings transfer failed:', err);
        toast.error({
            title: 'Transfer Failed',
            description:
                err instanceof Error ? err.message : 'Unable to complete savings transfer.',
        });
    } finally {
        isSubmittingTransfer.value = false;
    }
};
const handleDeleteGoal = async (id: string, name: string) => {
    await removeSavingGoal(id, name);
};
</script>

<template>
    <div class="bg-mist-900 rounded-md border border-mist-800 p-4 shadow-sm">
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
                        class="hover:bg-mist-800/50 transition-colors">
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
                            colspan="5"
                            class="py-6 text-center text-mist-400">
                            No personal transactions categorized as "Savings" yet.
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Saving Goals Section -->
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

        <SavingGoalModal v-model="isGoalModalOpen" />

        <!-- Transfer Savings Modal -->
        <div
            v-if="isTransferModalOpen"
            class="fixed inset-0 z-50 flex items-center justify-center bg-mist-950/75 p-4 backdrop-blur-sm">
            <div
                class="w-full max-w-2xl rounded-md border border-mist-800 bg-mist-900 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 space-y-4 p-4">
                <div
                    class="flex items-center justify-between border-b border-mist-800 -mt-4 -mr-4 -ml-4 p-4 bg-mist-950/60">
                    <h2 class="font-semibold text-mist-100">Transfer Savings</h2>
                    <button
                        type="button"
                        class="text-mist-400 hover:text-mist-200 text-lg leading-none cursor-pointer"
                        @click="closeTransferModal">
                        <fa-icon
                            class="text-xs"
                            icon="xmark" />
                    </button>
                </div>

                <form
                    class="max-h-[80vh] overflow-y-auto space-y-4"
                    @submit.prevent="executeSavingsTransfer">
                    <!-- Source Account Selector -->
                    <SelectDropdown
                        v-model="transferForm.sourceKey"
                        input-label="Source Account"
                        :options="accountOptions">
                        <template #icon>
                            <fa-icon
                                icon="hard-drive"
                                class="text-xs" />
                        </template>
                    </SelectDropdown>
                    <!-- Destination Type -->
                    <div>
                        <label class="block text-xs text-mist-400 mb-1 font-medium">
                            Transfer To
                        </label>
                        <div class="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                class="py-1.5 px-3 rounded border text-center text-xs font-medium transition cursor-pointer"
                                :class="
                                    transferForm.destinationType === 'checking'
                                        ? 'bg-blue-400/15 border-blue-400 text-blue-300'
                                        : 'bg-mist-950 border-mist-800 text-mist-400 hover:bg-mist-800'
                                "
                                @click="transferForm.destinationType = 'checking'">
                                Checking / Operational
                            </button>
                            <!-- <button
                                type="button"
                                class="py-1.5 px-3 rounded border text-center font-medium transition cursor-pointer"
                                :class="
                                    transferForm.destinationType === 'savings'
                                        ? 'bg-blue-400/15 border-blue-400 text-blue-300'
                                        : 'bg-mist-950 border-mist-800 text-mist-400 hover:bg-mist-800'
                                "
                                @click="transferForm.destinationType = 'savings'">
                                Other Savings Account
                            </button> -->
                        </div>
                    </div>

                    <!-- Destination Owner -->
                    <div class="grid grid-cols-2 gap-2.5">
                        <SelectDropdown
                            v-model="transferForm.targetOwner"
                            input-label="Target Owner"
                            :options="targetOptions">
                            <template #icon>
                                <fa-icon
                                    icon="id-card"
                                    class="text-xs" />
                            </template>
                        </SelectDropdown>
                        <!-- Target Institution (Only when transferring between savings) -->
                        <div v-if="transferForm.destinationType === 'savings'">
                            <label class="block text-mist-500 mb-1 font-medium">
                                Target Bank
                            </label>
                            <select
                                v-model="transferForm.targetInstitution"
                                class="w-full bg-mist-950 border border-mist-700 rounded px-2 py-1.5 text-mist-200 focus:outline-hidden focus:border-blue-400">
                                <option
                                    v-for="inst in SAVINGS_INSTITUTIONS"
                                    :key="inst"
                                    :value="inst">
                                    {{ inst }}
                                </option>
                            </select>
                        </div>
                    </div>

                    <!-- Amount & Date -->
                    <div class="grid grid-cols-2 gap-2.5">
                        <TextInput
                            id="payout"
                            v-model.number="transferForm.amount"
                            input-label="Amount"
                            type="number"
                            min="1"
                            placeholder="100.000"
                            required>
                            <template #icon>
                                <fa-icon
                                    icon="rupiah-sign"
                                    class="text-xs" />
                            </template>
                        </TextInput>

                        <DatePicker
                            v-model="transferForm.date"
                            input-label="Date"
                            :width="311"
                            :select-today-by-default="true" />
                    </div>

                    <TextInput
                        id="amount"
                        v-model="transferForm.notes"
                        input-label="Notes"
                        type="text"
                        placeholder="...">
                    </TextInput>

                    <!-- Form Actions -->
                    <div class="flex justify-end gap-2">
                        <button
                            type="button"
                            class="text-xs px-3 py-2 font-medium text-mist-400 hover:text-mist-200 cursor-pointer"
                            @click="closeTransferModal">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            :disabled="isSubmittingTransfer"
                            class="bg-blue-400 hover:bg-blue-300 disabled:opacity-50 text-mist-950 text-xs px-4 py-2 rounded-md font-semibold transition cursor-pointer">
                            {{ isSubmittingTransfer ? 'Processing...' : 'Transfer' }}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</template>
