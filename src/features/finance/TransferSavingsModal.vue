<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { toast } from 'vue-toastflow';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useFinanceSync } from '@/composables/useFinanceSync';
import { formatIDR } from '@/utils/money';
import { getCurrentDate } from '@/utils/date';
import type { PersonalOwner } from '@/types/finance';

import SelectDropdown from '@/components/ui/SelectDropdown.vue';
import DatePicker from '@/components/ui/DatePicker.vue';
import TextInput from '@/components/ui/TextInput.vue';

const SAVINGS_INSTITUTIONS = ['BCA', 'Bank Jago', 'Blu by BCA', 'Seabank', 'Mandiri', 'Bibit'];
const targetOptions = [
    { label: 'Citra Ayu Wardani', value: 'Citra Ayu Wardani' },
    { label: 'Danh Nguyen', value: 'Danh Nguyen' },
    { label: 'Shared', value: 'Shared' },
];

interface Props {
    preselectedKey?: string;
}

const { preselectedKey = '' } = defineProps<Props>();
const emit = defineEmits<{
    closed: [];
}>();
const isOpen = defineModel<boolean>({ default: false });

const financeStore = useFinanceStore();
const { dynamicSavingsAccounts } = storeToRefs(financeStore);
const { addPersonalTransaction, addSharedTransaction } = useFinanceSync();

const isSubmitting = ref(false);
const transferForm = ref({
    sourceKey: '',
    destinationType: 'checking' as 'savings' | 'checking',
    targetOwner: 'Danh Nguyen' as PersonalOwner | 'Shared',
    targetInstitution: 'Bank Jago',
    amount: '' as number | '',
    date: getCurrentDate(),
    notes: '',
});

const accountOptions = computed(() =>
    dynamicSavingsAccounts.value.map((account) => ({
        label: `${account.owner} (${account.institution}) - ${formatIDR(account.balance)}`,
        value: account.key,
    }))
);
const selectedSourceAccount = computed(() =>
    dynamicSavingsAccounts.value.find((acc) => acc.key === transferForm.value.sourceKey)
);

watch(
    () => isOpen.value,
    (open) => {
        if (!open) return;

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
    },
    { immediate: true }
);

function closeModal(): void {
    isOpen.value = false;
    emit('closed');
}
async function executeSavingsTransfer(): Promise<void> {
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

    isSubmitting.value = true;
    try {
        const cleanDate = transferForm.value.date || getCurrentDate();
        const customNote = transferForm.value.notes?.trim();

        if (transferForm.value.destinationType === 'savings') {
            const targetInst = transferForm.value.targetInstitution;
            const targetOwner = transferForm.value.targetOwner;

            // 1. Debit Source Savings (negative amount decreases savings balance)
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

            // 2. Credit Target Savings (positive amount increases savings balance)
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
            // 3. Withdrawal from Savings into Personal or Shared Checking
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

        closeModal();
    } catch (err: unknown) {
        console.error('Savings transfer failed:', err);
        toast.error({
            title: 'Transfer Failed',
            description:
                err instanceof Error ? err.message : 'Unable to complete savings transfer.',
        });
    } finally {
        isSubmitting.value = false;
    }
}
</script>

<template>
    <Teleport to="body">
        <transition
            enter-active-class="transition ease-out duration-150"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition ease-in duration-100"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0">
            <div
                v-if="isOpen"
                class="fixed inset-0 z-50 flex items-center justify-center bg-mist-950/75 p-4 backdrop-blur-xs">
                <div
                    class="w-full max-w-xl rounded-md border border-mist-800 bg-mist-900 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-5 space-y-4 text-mist-100">
                    <!-- Modal Header -->
                    <div
                        class="flex items-center justify-between border-b border-mist-800 -mt-5 -mr-5 -ml-5 p-4 bg-mist-950/60">
                        <h2 class="text-sm font-semibold text-mist-100">Transfer Savings</h2>
                        <button
                            type="button"
                            class="text-mist-400 hover:text-mist-200 text-lg leading-none cursor-pointer"
                            @click="closeModal">
                            <fa-icon
                                class="text-xs"
                                icon="xmark" />
                        </button>
                    </div>

                    <form
                        class="max-h-[80vh] overflow-y-auto space-y-4 text-xs"
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

                        <!-- Destination Type Selector -->
                        <div>
                            <label class="block text-xs text-mist-400 mb-1 font-medium">
                                Destination
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
                                <button
                                    type="button"
                                    class="py-1.5 px-3 rounded border text-center text-xs font-medium transition cursor-pointer"
                                    :class="
                                        transferForm.destinationType === 'savings'
                                            ? 'bg-blue-400/15 border-blue-400 text-blue-300'
                                            : 'bg-mist-950 border-mist-800 text-mist-400 hover:bg-mist-800'
                                    "
                                    @click="transferForm.destinationType = 'savings'">
                                    Another Savings Account
                                </button>
                            </div>
                        </div>

                        <!-- Target Owner & Target Bank (if savings) -->
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

                            <div v-if="transferForm.destinationType === 'savings'">
                                <label class="block text-mist-400 mb-1 font-medium">
                                    Target Bank
                                </label>
                                <select
                                    v-model="transferForm.targetInstitution"
                                    class="w-full bg-mist-950 border border-mist-700 rounded px-2 py-2 text-mist-200 focus:outline-hidden focus:border-blue-400 font-mono">
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
                            <DatePicker
                                v-model="transferForm.date"
                                input-label="Date"
                                :select-today-by-default="true" />
                            <TextInput
                                id="transferAmount"
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
                        </div>

                        <TextInput
                            id="transferNotes"
                            v-model.trim="transferForm.notes"
                            input-label="Notes / Reference"
                            type="text"
                            placeholder="Allocation for vacation" />

                        <!-- Form Actions -->
                        <div class="flex justify-end gap-2">
                            <button
                                type="button"
                                class="text-xs px-3 py-2 font-semibold text-mist-400 hover:text-mist-200"
                                @click="closeModal">
                                Cancel
                            </button>
                            <button
                                type="submit"
                                :disabled="isSubmitting"
                                class="bg-blue-400 hover:bg-blue-300 disabled:opacity-50 text-mist-950 px-4 py-2 rounded font-semibold transition cursor-pointer flex items-center gap-1.5">
                                <span
                                    v-if="isSubmitting"
                                    class="w-3 h-3 border-2 border-mist-900 border-t-transparent rounded-full animate-spin"></span>
                                <span>{{ isSubmitting ? 'Processing...' : 'Transfer' }}</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </transition>
    </Teleport>
</template>
