<script setup lang="ts">
import { ref } from 'vue';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useFinanceSync } from '@/composables/useFinanceSync';
import type { TransferTargetAccount } from '@/types/finance';

interface Props {
    modelValue?: boolean;
}

const { modelValue = false } = defineProps<Props>();

const emit = defineEmits<{
    'update:modelValue': [value: boolean];
}>();

const financeStore = useFinanceStore();
const { executeOwnerTransfer } = useFinanceSync();

const sourcePropertyId = ref('piyungan');
const targetAccount = ref<TransferTargetAccount>('Shared');
const amount = ref<number | null>(null);
const date = ref(new Date().toISOString().slice(0, 10));
const notes = ref('');

const sanitizeAmount = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const cleanedString = target.value.replace(/\D/g, '');
    amount.value = cleanedString ? parseInt(cleanedString, 10) : 0;
    target.value = cleanedString;
};
const closeModal = () => emit('update:modelValue', false);
const handleTransfer = async () => {
    if (!amount.value || !date.value) return;

    const targetDate = date.value;

    const success = await executeOwnerTransfer({
        sourcePropertyId: sourcePropertyId.value,
        targetAccount: targetAccount.value,
        amount: amount.value,
        date: targetDate,
        notes: notes.value,
    });

    if (success) {
        financeStore.selectedMonth = targetDate.slice(0, 7);
        amount.value = null;
        notes.value = '';
        closeModal();
    }
};
</script>

<template>
    <div
        v-if="modelValue"
        class="fixed inset-0 z-50 bg-mist-950/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="bg-mist-900 border border-mist-800 rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div class="flex justify-between items-center mb-3">
                <h3 class="font-bold text-mist-100 text-sm">Execute Owner Draw</h3>
                <button
                    class="text-mist-400 hover:text-mist-200 text-lg"
                    @click="closeModal">
                    &times;
                </button>
            </div>

            <p class="text-xs text-mist-400 mb-4 leading-relaxed">
                Transfers create a 3-way record: An outflow under Property Ledger, an inflow under
                the target ledger, and a permanent entry in the Transfers audit table.
            </p>

            <form
                class="space-y-4"
                @submit.prevent="handleTransfer">
                <div>
                    <label class="text-xs font-semibold text-mist-400 block mb-1">
                        Source Entity
                    </label>
                    <select
                        v-model="sourcePropertyId"
                        class="w-full text-xs border border-mist-700 bg-mist-850 text-mist-100 rounded-lg p-2.5">
                        <option value="piyungan">Mai House Jogja - Piyungan</option>
                    </select>
                </div>

                <div>
                    <label class="text-xs font-semibold text-mist-400 block mb-1">
                        Target Account
                    </label>
                    <select
                        v-model="targetAccount"
                        class="w-full text-xs border border-mist-700 bg-mist-850 text-mist-100 rounded-lg p-2.5">
                        <option value="Shared">Shared Household Ledger</option>
                        <option value="Danh Nguyen">Danh Nguyen Account</option>
                        <option value="Citra Ayu Wardani">Citra Ayu Wardani Account</option>
                    </select>
                </div>

                <div>
                    <label class="text-xs font-semibold text-mist-400 block mb-1">
                        Amount (IDR)
                    </label>
                    <input
                        :value="amount"
                        type="number"
                        required
                        placeholder="0"
                        class="w-full text-xs border border-mist-700 bg-mist-850 text-mist-100 rounded-lg p-2.5 font-mono"
                        @input="sanitizeAmount" />
                </div>

                <div>
                    <label class="text-xs font-semibold text-mist-400 block mb-1">Date</label>
                    <input
                        v-model="date"
                        type="date"
                        required
                        class="w-full text-xs border border-mist-700 bg-mist-850 text-mist-100 rounded-lg p-2.5 font-mono" />
                </div>

                <div>
                    <label class="text-xs font-semibold text-mist-400 block mb-1">
                        Transfer Memo
                    </label>
                    <input
                        v-model="notes"
                        type="text"
                        placeholder="e.g. Dividend share distribution"
                        class="w-full text-xs border border-mist-700 bg-mist-850 text-mist-100 rounded-lg p-2.5" />
                </div>

                <div class="flex justify-end space-x-2 pt-3">
                    <button
                        type="button"
                        class="px-3 py-2 text-xs font-medium text-mist-400 hover:text-mist-200"
                        @click="closeModal">
                        Cancel
                    </button>
                    <button
                        type="submit"
                        :disabled="financeStore.isLoading"
                        class="bg-lime-400 hover:bg-lime-300 text-mist-950 text-xs px-4 py-2 rounded-lg font-bold transition">
                        Execute Transfer
                    </button>
                </div>
            </form>
        </div>
    </div>
</template>
