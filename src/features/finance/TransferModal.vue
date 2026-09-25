<script setup lang="ts">
import { ref, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useFinanceSync } from '@/composables/useFinanceSync';
import type { TransferTargetAccount } from '@/types/finance';

import SelectDropdown from '@/components/ui/SelectDropdown.vue';
import DatePicker from '@/components/ui/DatePicker.vue';
import TextInput from '@/components/ui/TextInput.vue';

const sourceOptions = [{ label: 'Mai House Jogja', value: 'piyungan' }];
const targetOptions = [
    { label: 'Shared Household', value: 'Shared' },
    { label: 'Citra / Danh', value: 'Split' },
    { label: 'Citra Ayu Wardani', value: 'Citra Ayu Wardani' },
    { label: 'Danh Nguyen', value: 'Danh Nguyen' },
];

interface Props {
    modelValue?: boolean;
}

const { modelValue = false } = defineProps<Props>();
const emit = defineEmits<{
    'update:modelValue': [value: boolean];
}>();

const financeStore = useFinanceStore();
const { executeOwnerTransfer } = useFinanceSync();
const { isLoading } = storeToRefs(financeStore);

const sourcePropertyId = ref('piyungan');
const targetAccount = ref<TransferTargetAccount>('Split');
const amount = ref<number | null>(null);
const date = ref(new Date().toISOString().slice(0, 10));
const notes = ref('');
const isSubmitting = ref(false);

const isBothMode = computed(() => targetAccount.value === 'Split');

function closeModal(): void {
    emit('update:modelValue', false);
}
async function handleTransfer(): Promise<void> {
    if (isSubmitting.value || !amount.value || !date.value) return;

    isSubmitting.value = true;
    const targetDate = date.value;

    try {
        const success = await executeOwnerTransfer({
            sourcePropertyId: sourcePropertyId.value,
            targetAccount: targetAccount.value,
            amount: Number(amount.value),
            date: targetDate,
            notes: notes.value,
        });

        if (success) {
            financeStore.selectedMonth = targetDate.slice(0, 7);
            amount.value = null;
            notes.value = '';
            closeModal();
        }
    } finally {
        setTimeout(() => {
            isSubmitting.value = false;
        }, 1000);
    }
}
</script>

<template>
    <div
        v-if="modelValue"
        class="fixed inset-0 z-50 flex items-center justify-center bg-mist-950/75 backdrop-blur-sm">
        <div
            class="w-full max-w-2xl rounded-md border border-mist-800 bg-mist-900 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 space-y-4 p-4">
            <div
                class="flex items-center justify-between border-b border-mist-800 -mt-4 -mr-4 -ml-4 p-4 bg-mist-950/60">
                <h2 class="text-base font-semibold text-mist-100">Transfer Funds</h2>
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
                class="max-h-[80vh] overflow-y-auto space-y-4"
                @submit.prevent="handleTransfer">
                <SelectDropdown
                    v-model="sourcePropertyId"
                    input-label="Source Entity"
                    placeholder="Select source"
                    :options="sourceOptions" />

                <SelectDropdown
                    v-model="targetAccount"
                    input-label="Target Account"
                    placeholder="Select account"
                    :options="targetOptions" />

                <div class="grid grid-cols-2 gap-4">
                    <DatePicker
                        v-model="date"
                        input-label="Date"
                        :width="311"
                        :select-today-by-default="true" />

                    <TextInput
                        id="payout"
                        v-model.number="amount"
                        :input-label="isBothMode ? 'Payout Amount' : 'Amount'"
                        type="number"
                        min="1"
                        placeholder="100000"
                        required>
                        <template #icon>
                            <fa-icon
                                icon="rupiah-sign"
                                class="text-xs" />
                        </template>
                    </TextInput>
                </div>

                <TextInput
                    id="notes"
                    v-model.trim="notes"
                    input-label="Transfer Memo"
                    type="text"
                    placeholder="..." />

                <div class="flex justify-end space-x-2">
                    <button
                        type="button"
                        class="px-3 py-2 text-xs font-semibold text-mist-400 hover:text-mist-200"
                        @click="closeModal">
                        Cancel
                    </button>
                    <button
                        type="submit"
                        :disabled="isLoading || isSubmitting"
                        class="bg-lime-400 hover:bg-lime-300 text-mist-950 text-xs px-4 py-2 rounded-md font-semibold transition flex items-center gap-1.5 disabled:opacity-50">
                        <span
                            v-if="isSubmitting"
                            class="w-3 h-3 border-2 border-mist-950 border-t-transparent rounded-full animate-spin"></span>
                        <span>{{ isBothMode ? 'Payout Both' : 'Confirm Payout' }}</span>
                    </button>
                </div>
            </form>
        </div>
    </div>
</template>
