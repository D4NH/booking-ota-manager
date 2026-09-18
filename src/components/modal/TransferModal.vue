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
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm">
        <div
            class="w-full max-w-2xl rounded-md border border-mist-800 bg-mist-900 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 space-y-4 p-4">
            <div
                class="flex items-center justify-between border-b border-mist-800 -mt-4 -mr-4 -ml-4 p-4 bg-mist-950/60">
                <h2 class="text-base font-bold text-mist-100">Execute Owner Payout</h2>
                <button
                    type="button"
                    class="cursor-pointer text-mist-400 hover:text-mist-200"
                    @click="closeModal">
                    <fa-icon icon="xmark" />
                </button>
            </div>

            <p class="text-xs text-mist-400 leading-relaxed">
                Transfers create a 3-way record: An outflow under Property Ledger, an inflow under
                the target ledger, and a permanent entry in the Transfers audit table.
            </p>

            <form
                class="space-y-4"
                @submit.prevent="handleTransfer">
                <div class="relative">
                    <label
                        for="property"
                        class="block text-xs font-medium text-mist-400">
                        Source Entity
                    </label>
                    <div
                        class="pointer-events-none absolute inset-y-0 top-5 left-3 flex items-center text-mist-500">
                        <fa-icon
                            class="text-xs"
                            icon="house" />
                    </div>
                    <select
                        id="property"
                        v-model="sourcePropertyId"
                        name="property"
                        required
                        class="w-full appearance-none rounded-md border border-mist-800 bg-mist-950/50 mt-1 pl-9 pr-3 py-2 text-sm text-mist-200 focus:border-lime-500 focus:outline-none transition-colors cursor-pointer">
                        <option value="piyungan">Mai House Jogja</option>
                    </select>
                    <div
                        class="pointer-events-none absolute inset-y-0 top-5 right-2 flex items-center text-mist-400">
                        <fa-icon
                            class="text-xs"
                            icon="angle-down" />
                    </div>
                </div>

                <div class="relative">
                    <label
                        for="property"
                        class="block text-xs font-medium text-mist-400">
                        Target Account
                    </label>
                    <div
                        class="pointer-events-none absolute inset-y-0 top-5 left-3 flex items-center text-mist-500">
                        <fa-icon
                            class="text-xs"
                            icon="id-card" />
                    </div>
                    <select
                        id="property"
                        v-model="targetAccount"
                        name="property"
                        required
                        class="w-full appearance-none rounded-md border border-mist-800 bg-mist-950/50 mt-1 pl-9 pr-3 py-2 text-sm text-mist-200 focus:border-lime-500 focus:outline-none transition-colors cursor-pointer">
                        <option value="Shared">Shared Household</option>
                        <option value="Danh Nguyen">Danh Nguyen</option>
                        <option value="Citra Ayu Wardani">Citra Ayu Wardani</option>
                    </select>
                    <div
                        class="pointer-events-none absolute inset-y-0 top-5 right-2 flex items-center text-mist-400">
                        <fa-icon
                            class="text-xs"
                            icon="angle-down" />
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div class="relative">
                        <label class="block text-xs font-medium text-mist-400">Date</label>
                        <input
                            v-model="date"
                            type="date"
                            class="w-full appearance-none rounded-md border border-mist-800 bg-mist-950/50 mt-1 py-2 px-3 text-sm text-mist-200 focus:border-lime-500 focus:outline-none transition-colors"
                            required />
                        <div
                            class="pointer-events-none absolute inset-y-0 top-5 right-2 flex items-center text-mist-500">
                            <fa-icon
                                class="text-sm"
                                icon="calendar-days" />
                        </div>
                    </div>
                    <div class="relative">
                        <label class="block text-xs font-medium text-mist-400">
                            Amount (IDR)
                        </label>
                        <div
                            class="absolute inset-y-0 top-5 left-3 flex items-center pointer-events-none text-mist-500">
                            <fa-icon
                                icon="rupiah-sign"
                                class="text-xs" />
                        </div>
                        <input
                            :value="amount"
                            type="number"
                            placeholder="1000000"
                            class="w-full rounded-md bg-mist-950/50 border border-mist-800 mt-1 pl-8 pr-4 py-2 text-sm text-mist-200 placeholder-mist-600 focus:border-lime-500 focus:outline-none transition-colors"
                            required
                            @input="sanitizeAmount" />
                    </div>
                </div>

                <div>
                    <label class="text-xs font-semibold text-mist-400 block"> Transfer Memo </label>
                    <input
                        v-model="notes"
                        type="text"
                        placeholder="e.g. Dividend share distribution"
                        class="w-full appearance-none rounded-md border border-mist-800 bg-mist-950/50 mt-1 py-2 px-3 text-sm text-mist-200 focus:border-lime-500 focus:outline-none transition-colors" />
                </div>

                <div class="flex justify-end space-x-2">
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
