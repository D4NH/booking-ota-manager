<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useFinanceSync } from '@/composables/useFinanceSync';
import { getCurrentDate } from '@/utils/date';
import type {
    TransactionType,
    PersonalFinance,
    SharedFinance,
    PersonalOwner,
} from '@/types/finance';

import SelectDropdown from '@/components/ui/SelectDropdown.vue';
import DatePicker from '@/components/ui/DatePicker.vue';
import TextInput from '@/components/ui/TextInput.vue';

const DEFAULT_PERSONAL_CATEGORY = 'Food & Drinks';
const DEFAULT_SHARED_CATEGORY = 'House';
const categoriesPersonal = [
    'Creditcard',
    'Investments',
    'Other',
    'Food & Drinks',
    'Groceries',
    'Savings',
    'Subscription',
] as const;
const categoriesShared = [
    'BPJS',
    'Creditcard',
    'Electricity',
    'Internet',
    'Investments',
    'Kirana',
    'House',
    'Other',
    'Subscription',
] as const;
const savingsInstitutions = ['BCA', 'Bank Jago', 'Seabank', 'Mandiri'] as const;
const entryType = [
    { label: 'Income', value: 'income' },
    { label: 'Expense', value: 'expense' },
    { label: 'Fixed Cost', value: 'fixed_cost' },
];

interface Props {
    owner?: PersonalOwner | 'Shared';
    itemToEdit?: PersonalFinance | SharedFinance | null;
}

const { owner = 'Danh Nguyen', itemToEdit = null } = defineProps<Props>();
const emit = defineEmits<{
    closed: [];
}>();
const isOpen = defineModel<boolean>({ default: false });

const financeStore = useFinanceStore();
const {
    addPersonalTransaction,
    addSharedTransaction,
    editPersonalTransaction,
    editSharedTransaction,
} = useFinanceSync();
const { currentGoldPricePerGram, isLoading } = storeToRefs(financeStore);

const formType = ref<TransactionType>('expense');
const formCategory = ref<string>(DEFAULT_PERSONAL_CATEGORY);
const formSavingsInstitution = ref<string>('BCA');
const formGoldWeightGrams = ref<number | null>(null);
const formAmount = ref<number | null>(null);
const formDate = ref(getCurrentDate());
const formNotes = ref('');
const isSubmitting = ref(false);

const isEditing = computed(() => Boolean(itemToEdit));
const availableCategories = computed(() => {
    const list = owner === 'Shared' ? categoriesShared : categoriesPersonal;
    return list.map((category) => ({
        label: category,
        value: category,
    }));
});
const isSavingsCategory = computed(() => formCategory.value.trim().toLowerCase() === 'savings');
const isGoldCategory = computed(() => formCategory.value.trim().toLowerCase() === 'gold');

watch(
    () => [isOpen.value, itemToEdit, owner] as const,
    ([open, item, currentOwner]) => {
        if (!open) return;

        if (item) {
            formType.value = item.type;
            formCategory.value = item.category;
            formAmount.value = item.amount;
            formDate.value = item.date;
            formNotes.value = item.notes || '';
            formSavingsInstitution.value =
                'savingsInstitution' in item && item.savingsInstitution
                    ? item.savingsInstitution
                    : 'BCA';
            formGoldWeightGrams.value =
                'goldWeightGrams' in item && item.goldWeightGrams ? item.goldWeightGrams : null;
        } else {
            formType.value = 'expense';
            formCategory.value =
                currentOwner === 'Shared' ? DEFAULT_SHARED_CATEGORY : DEFAULT_PERSONAL_CATEGORY;
            formSavingsInstitution.value = 'BCA';
            formGoldWeightGrams.value = null;
            formAmount.value = null;
            formDate.value = getCurrentDate();
            formNotes.value = '';
        }
    },
    { immediate: true }
);
watch(formCategory, (newCat) => {
    if (newCat?.trim().toLowerCase() === 'gold') {
        handleAmountChange();
    }
});

function getDefaultCategory(): string {
    return owner === 'Shared' ? DEFAULT_SHARED_CATEGORY : DEFAULT_PERSONAL_CATEGORY;
}
function handleAmountChange(): void {
    if (isGoldCategory.value && formAmount.value && Number(formAmount.value) > 0) {
        const rate = currentGoldPricePerGram.value || 2450000;
        const calculatedGrams = Number(formAmount.value) / rate;
        formGoldWeightGrams.value = Number(calculatedGrams.toFixed(2));
    }
}
function closeModal(): void {
    isOpen.value = false;
    emit('closed');
}
async function submitRecord(): Promise<void> {
    if (isSubmitting.value || !formAmount.value || formAmount.value <= 0 || !formDate.value) {
        return;
    }

    isSubmitting.value = true;
    const resolvedCategory = formCategory.value.trim() || getDefaultCategory();

    try {
        let success = false;

        if (isEditing.value && itemToEdit) {
            if (owner === 'Shared') {
                success = await editSharedTransaction(itemToEdit.id, {
                    type: formType.value,
                    category: resolvedCategory,
                    amount: Number(formAmount.value),
                    date: formDate.value,
                    notes: formNotes.value.trim(),
                });
            } else {
                success = await editPersonalTransaction(itemToEdit.id, {
                    owner: owner as PersonalOwner,
                    type: formType.value,
                    category: resolvedCategory,
                    amount: Number(formAmount.value),
                    date: formDate.value,
                    notes: formNotes.value.trim(),
                    savingsInstitution: isSavingsCategory.value
                        ? formSavingsInstitution.value
                        : undefined,
                    goldWeightGrams: isGoldCategory.value
                        ? formGoldWeightGrams.value || undefined
                        : undefined,
                });
            }
        } else {
            if (owner === 'Shared') {
                success = await addSharedTransaction({
                    type: formType.value,
                    category: resolvedCategory,
                    amount: Number(formAmount.value),
                    date: formDate.value,
                    notes: formNotes.value.trim(),
                });
            } else {
                success = await addPersonalTransaction({
                    owner: owner as PersonalOwner,
                    type: formType.value,
                    category: resolvedCategory,
                    amount: Number(formAmount.value),
                    date: formDate.value,
                    notes: formNotes.value.trim(),
                    savingsInstitution: isSavingsCategory.value
                        ? formSavingsInstitution.value
                        : undefined,
                    goldWeightGrams: isGoldCategory.value
                        ? formGoldWeightGrams.value || undefined
                        : undefined,
                });
            }
        }

        if (success) {
            closeModal();
        }
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
                        <h2 class="font-semibold text-mist-100">
                            {{ isEditing ? 'Edit Entry for' : 'Add Entry for' }} {{ owner }}
                        </h2>
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
                        @submit.prevent="submitRecord">
                        <div class="grid grid-cols-2 gap-3">
                            <SelectDropdown
                                v-model="formType"
                                input-label="Transaction Type"
                                :options="entryType" />

                            <SelectDropdown
                                v-model="formCategory"
                                input-label="Category"
                                :options="availableCategories" />
                        </div>

                        <!-- Savings Destination Selector -->
                        <div
                            v-if="isSavingsCategory"
                            class="bg-mist-950/70 border border-mist-800 p-3 rounded-md space-y-1.5">
                            <label class="text-xs font-semibold text-blue-400 block">
                                Destination Savings Account
                            </label>
                            <select
                                v-model="formSavingsInstitution"
                                class="w-full text-xs border border-mist-700 bg-mist-900 text-mist-100 rounded-md p-2 focus:outline-hidden focus:border-blue-400 font-mono">
                                <option
                                    v-for="inst in savingsInstitutions"
                                    :key="inst"
                                    :value="inst">
                                    {{ inst }}
                                </option>
                            </select>
                            <p class="text-[11px] text-mist-400 font-mono">
                                Inflows automatically update your Liquid Savings breakdown.
                            </p>
                        </div>

                        <div class="grid grid-cols-2 gap-3">
                            <DatePicker
                                v-model="formDate"
                                select-today-by-default
                                input-label="Date" />

                            <TextInput
                                id="personalAmount"
                                v-model.number="formAmount"
                                input-label="Amount"
                                type="number"
                                placeholder="100000"
                                required
                                @input="handleAmountChange">
                                <template #icon>
                                    <fa-icon
                                        icon="rupiah-sign"
                                        class="text-xs" />
                                </template>
                            </TextInput>
                        </div>

                        <TextInput
                            id="personalNotes"
                            v-model.trim="formNotes"
                            input-label="Notes"
                            type="text"
                            placeholder="Description, reference..." />

                        <div class="flex justify-end gap-2">
                            <button
                                type="button"
                                class="text-xs px-3 py-2 font-semibold text-mist-400 hover:text-mist-200"
                                @click="closeModal">
                                Cancel
                            </button>
                            <button
                                type="submit"
                                :disabled="isLoading || isSubmitting"
                                class="bg-lime-400 hover:bg-lime-300 disabled:opacity-50 disabled:cursor-not-allowed text-mist-950 px-4 py-2 rounded font-semibold transition cursor-pointer flex items-center gap-1.5">
                                <span
                                    v-if="isSubmitting"
                                    class="w-3 h-3 border-2 border-mist-900 border-t-transparent rounded-full animate-spin"></span>
                                <span>{{ isEditing ? 'Save Changes' : 'Add Entry' }}</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </transition>
    </Teleport>
</template>
