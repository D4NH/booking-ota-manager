<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useFinanceSync } from '@/composables/useFinanceSync';
import type { TransactionType, PersonalFinance, SharedFinance } from '@/types/finance';
import { formatIDR } from '@/utils/money';

import CardTitle from '@/components/CardTitle.vue';
import RecurringChecklist from '@/components/finance/RecurringChecklist.vue';
import TransactionNote from '@/components/finance/TransactionNote.vue';

const financeStore = useFinanceStore();
const {
    addPersonalTransaction,
    addSharedTransaction,
    editPersonalTransaction,
    editSharedTransaction,
    removePersonalTransaction,
} = useFinanceSync();
const {
    filteredPersonalFinances,
    filteredSharedFinances,
    isLoading,
    currentGoldPricePerGram,
    monthlyProjectedIncome,
    monthlyProjectedExpenses,
} = storeToRefs(financeStore);

const DEFAULT_PERSONAL_CATEGORY = 'BCA';
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
    'Other',
    'Subscription',
] as const;
const savingsInstitutions = ['BCA', 'Bank Jago', 'Seabank', 'Mandiri'] as const;

const activeTab = ref<'Danh Nguyen' | 'Citra Ayu Wardani' | 'Shared'>('Danh Nguyen');
const isModalOpen = ref(false);
const isSubmitting = ref(false);
const editingItem = ref<PersonalFinance | SharedFinance | null>(null);
const showRecurring = ref(false);
const formType = ref<TransactionType>('expense');
const formCategory = ref<string>(DEFAULT_PERSONAL_CATEGORY);
const formSavingsInstitution = ref<string>('BCA');
const formGoldWeightGrams = ref<number | null>(null);
const formAmount = ref<number | null>(null);
const formDate = ref(new Date().toISOString().slice(0, 10));
const formNotes = ref('');

const isEditing = computed(() => editingItem.value !== null);
const availableCategories = computed<readonly string[]>(() =>
    activeTab.value === 'Shared' ? categoriesShared : categoriesPersonal
);
const currentList = computed<(PersonalFinance | SharedFinance)[]>(() => {
    if (activeTab.value === 'Shared') return filteredSharedFinances.value;
    return filteredPersonalFinances.value.filter((i) => i.owner === activeTab.value);
});
const totalRecurringCount = computed(() => {
    const recurringItems = [...monthlyProjectedIncome.value, ...monthlyProjectedExpenses.value];
    return recurringItems.filter((i) => !i.isSettled).length;
});

const getDefaultCategory = (): string =>
    activeTab.value === 'Shared' ? DEFAULT_SHARED_CATEGORY : DEFAULT_PERSONAL_CATEGORY;
const openAddModal = (): void => {
    editingItem.value = null;
    formCategory.value = getDefaultCategory();
    formSavingsInstitution.value = 'BCA';
    formGoldWeightGrams.value = null;
    formAmount.value = null;
    formNotes.value = '';
    formDate.value = new Date().toISOString().slice(0, 10);
    formType.value = 'expense';
    isModalOpen.value = true;
};
const openEditModal = (item: PersonalFinance | SharedFinance): void => {
    editingItem.value = item;
    formType.value = item.type;
    formCategory.value = item.category;
    formAmount.value = item.amount;
    formDate.value = item.date;
    formNotes.value = item.notes || '';
    formSavingsInstitution.value =
        'savingsInstitution' in item && item.savingsInstitution ? item.savingsInstitution : 'BCA';
    formGoldWeightGrams.value =
        'goldWeightGrams' in item && item.goldWeightGrams ? item.goldWeightGrams : null;
    isModalOpen.value = true;
};
const handleAmountChange = (): void => {
    if (formCategory.value === 'Gold' && formAmount.value && Number(formAmount.value) > 0) {
        const rate = currentGoldPricePerGram.value || 2450000;
        const calculatedGrams = Number(formAmount.value) / rate;
        formGoldWeightGrams.value = Number(calculatedGrams.toFixed(2));
    }
};
const submitRecord = async (): Promise<void> => {
    if (isSubmitting.value || !formAmount.value || !formDate.value) return;

    isSubmitting.value = true;
    const resolvedCategory = formCategory.value.trim() || getDefaultCategory();

    try {
        let success = false;

        if (isEditing.value && editingItem.value) {
            if (activeTab.value === 'Shared') {
                success = await editSharedTransaction(editingItem.value.id, {
                    type: formType.value,
                    category: resolvedCategory,
                    amount: Number(formAmount.value),
                    date: formDate.value,
                    notes: formNotes.value,
                });
            } else {
                success = await editPersonalTransaction(editingItem.value.id, {
                    owner: activeTab.value,
                    type: formType.value,
                    category: resolvedCategory,
                    amount: Number(formAmount.value),
                    date: formDate.value,
                    notes: formNotes.value,
                    savingsInstitution:
                        resolvedCategory === 'Savings' ? formSavingsInstitution.value : undefined,
                    goldWeightGrams:
                        resolvedCategory === 'Gold'
                            ? formGoldWeightGrams.value || undefined
                            : undefined,
                });
            }
        } else {
            if (activeTab.value === 'Shared') {
                success = await addSharedTransaction({
                    type: formType.value,
                    category: resolvedCategory,
                    amount: Number(formAmount.value),
                    date: formDate.value,
                    notes: formNotes.value,
                });
            } else {
                success = await addPersonalTransaction({
                    owner: activeTab.value,
                    type: formType.value,
                    category: resolvedCategory,
                    amount: Number(formAmount.value),
                    date: formDate.value,
                    notes: formNotes.value,
                    savingsInstitution:
                        resolvedCategory === 'Savings' ? formSavingsInstitution.value : undefined,
                    goldWeightGrams:
                        resolvedCategory === 'Gold'
                            ? formGoldWeightGrams.value || undefined
                            : undefined,
                });
            }
        }

        if (success) {
            isModalOpen.value = false;
            editingItem.value = null;
            formAmount.value = null;
            formNotes.value = '';
            formGoldWeightGrams.value = null;
        }
    } finally {
        // Enforce 1000ms debounce guardrail against click spamming
        setTimeout(() => {
            isSubmitting.value = false;
        }, 1000);
    }
};

watch(activeTab, () => {
    if (!isModalOpen.value) {
        formCategory.value = getDefaultCategory();
    }
});
watch(formCategory, (newCat) => {
    if (newCat === 'Gold') {
        handleAmountChange();
    }
});
</script>

<template>
    <div class="min-h-0 flex flex-col space-y-4">
        <CardTitle>
            <template #title>Budget Overview</template>
            <template #subtitle>
                Income allocation, fixed commitments and variable spend across personal and shared
                accounts
            </template>
        </CardTitle>
        <div class="flex shrink-0 items-center justify-between">
            <div
                class="flex items-center rounded-md border border-mist-800 bg-mist-950/50 p-0.5 text-xs">
                <button
                    v-for="tab in ['Danh Nguyen', 'Citra Ayu Wardani', 'Shared']"
                    :key="tab"
                    class="cursor-pointer rounded-md px-3 py-1.5 transition"
                    :class="
                        activeTab === tab
                            ? 'bg-mist-800 text-lime-400 shadow-sm'
                            : 'text-mist-400 hover:text-mist-200'
                    "
                    @click="activeTab = tab">
                    {{ tab }}
                </button>
            </div>
            <div class="flex items-center gap-2">
                <button
                    type="button"
                    class="rounded-md border border-mist-800 px-3 py-2 text-xs text-mist-300 hover:bg-mist-800 transition shadow-sm cursor-pointer"
                    :class="[showRecurring ? 'bg-mist-800' : 'bg-mist-900']"
                    title="Filter by Status"
                    @click="showRecurring = !showRecurring">
                    <fa-icon
                        class="text-xs mr-1"
                        icon="arrows-rotate" />
                    Recurring Payments ({{ totalRecurringCount }})
                </button>
                <button
                    class="bg-lime-400 hover:bg-lime-300 text-mist-950 text-xs font-semibold px-3 py-2 rounded-md transition shadow-sm"
                    @click="openAddModal">
                    + Add Record
                </button>
            </div>
        </div>

        <RecurringChecklist v-if="showRecurring" />

        <div
            class="flex-1 overflow-auto max-h-76.5 rounded-md border border-mist-800 bg-mist-900 shadow-md">
            <table class="w-full text-left text-xs text-mist-200 table-fixed border-collapse">
                <thead
                    class="sticky top-0 z-10 border-b border-mist-800 bg-mist-950/50 backdrop-blur-sm text-xs font-semibold uppercase text-mist-400">
                    <tr>
                        <th class="w-28 px-4 py-2.5">Date</th>
                        <th class="w-32 px-4 py-2.5">Category</th>
                        <th class="w-auto px-4 py-2.5">Notes</th>
                        <th class="w-35 px-4 py-2.5 text-right">Amount</th>
                        <th class="w-23 px-4 py-2.5 text-center">Actions</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-mist-800/60 align-middle">
                    <tr
                        v-for="item in currentList"
                        :key="item.id"
                        class="hover:bg-mist-850/50 group">
                        <td class="px-4 py-2.5 align-middle text-mist-400 font-mono">
                            {{ item.date }}
                        </td>
                        <td class="px-4 py-2.5 align-middle font-medium text-mist-100">
                            <div class="flex items-center gap-1.5">
                                <span>{{ item.category }}</span>
                                <span
                                    v-if="item.category === 'Gold'"
                                    class="text-[9px] bg-amber-400/10 text-amber-400 border border-amber-400/20 px-1 rounded-md font-mono font-semibold">
                                    GOLD
                                </span>
                            </div>
                        </td>
                        <td class="px-4 py-2.5 align-middle text-mist-400">
                            <span
                                v-if="'savingsInstitution' in item && item.savingsInstitution"
                                class="text-blue-400 mr-1 font-semibold">
                                [{{ item.savingsInstitution }}]
                            </span>
                            <span
                                v-if="'goldWeightGrams' in item && item.goldWeightGrams"
                                class="text-amber-400 mr-1 font-semibold">
                                [{{ item.goldWeightGrams }}g]
                            </span>
                            <TransactionNote :notes="item.notes" />
                        </td>
                        <td class="px-4 py-2.5 align-middle text-right font-semibold font-mono">
                            <span
                                :class="item.type === 'income' ? 'text-lime-400' : 'text-rose-400'">
                                {{ item.type === 'income' ? '+' : '-' }}
                            </span>
                            {{ formatIDR(item.amount) }}
                        </td>
                        <td class="px-4 py-2.5 align-middle text-center">
                            <div class="flex items-center justify-end gap-1 h-7">
                                <button
                                    type="button"
                                    title="Edit Transaction"
                                    class="opacity-70 group-hover:opacity-100 text-mist-400 hover:text-lime-400 p-1 rounded hover:bg-mist-800 transition"
                                    @click="openEditModal(item)">
                                    <fa-icon
                                        icon="pen-to-square"
                                        class="text-xs" />
                                </button>
                                <span class="text-mist-700">|</span>
                                <button
                                    type="button"
                                    title="Delete Transaction"
                                    class="opacity-70 group-hover:opacity-100 text-mist-400 hover:text-rose-400 p-1 rounded hover:bg-mist-800 transition"
                                    @click="removePersonalTransaction(item.id, item.category)">
                                    <fa-icon
                                        icon="trash-can"
                                        class="text-xs" />
                                </button>
                            </div>
                        </td>
                    </tr>
                    <tr v-if="currentList.length === 0">
                        <td
                            colspan="5"
                            class="py-6 text-center text-mist-400">
                            No matching entries logged for this period.
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div
            v-if="isModalOpen"
            class="fixed inset-0 z-50 bg-mist-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div
                class="bg-mist-900 border border-mist-800 rounded-2xl shadow-2xl w-full max-w-md p-6">
                <div class="flex items-center justify-between mb-4">
                    <h4 class="font-semibold text-mist-100 text-sm">
                        {{ isEditing ? 'Edit Entry for' : 'Add Entry for' }} {{ activeTab }}
                    </h4>
                    <button
                        type="button"
                        class="text-mist-400 hover:text-mist-200 text-sm"
                        @click="isModalOpen = false">
                        ✕
                    </button>
                </div>

                <form
                    class="space-y-4"
                    @submit.prevent="submitRecord">
                    <div>
                        <label class="text-xs font-semibold text-mist-400 block mb-1">Type</label>
                        <select
                            v-model="formType"
                            class="w-full text-xs border border-mist-800 bg-mist-850 text-mist-100 rounded-md p-2.5">
                            <option value="income">Income</option>
                            <option value="expense">Expense</option>
                            <option value="fixed_cost">Fixed Cost</option>
                        </select>
                    </div>

                    <div>
                        <label class="text-xs font-semibold text-mist-400 block mb-1">
                            Category
                        </label>
                        <select
                            v-model="formCategory"
                            class="w-full text-xs border border-mist-800 bg-mist-850 text-mist-100 rounded-md p-2.5">
                            <option
                                v-for="cat in availableCategories"
                                :key="cat"
                                :value="cat">
                                {{ cat }}
                            </option>
                        </select>
                    </div>

                    <div
                        v-if="formCategory === 'Savings'"
                        class="bg-mist-850 border border-mist-800 p-3 rounded-md space-y-2">
                        <label class="text-xs font-semibold text-lime-400 block">
                            Destination Savings Account
                        </label>
                        <select
                            v-model="formSavingsInstitution"
                            class="w-full text-xs border border-mist-800 bg-mist-900 text-mist-100 rounded-md p-2">
                            <option
                                v-for="inst in savingsInstitutions"
                                :key="inst"
                                :value="inst">
                                {{ inst }}
                            </option>
                        </select>
                        <p class="text-[11px] text-mist-400">
                            Auto-syncs directly into the Liquid Savings breakdown.
                        </p>
                    </div>

                    <div
                        v-if="formCategory === 'Gold'"
                        class="bg-mist-850 border border-mist-800 p-3 rounded-md space-y-2">
                        <label class="text-xs font-semibold text-amber-400 block">
                            Weight in Grams
                        </label>
                        <input
                            v-model="formGoldWeightGrams"
                            type="number"
                            step="0.01"
                            placeholder="Auto-calculated if blank"
                            class="w-full text-xs border border-mist-800 bg-mist-900 text-mist-100 rounded-lg p-2 font-mono" />
                        <p class="text-[11px] text-mist-400">
                            Benchmark rate: {{ formatIDR(currentGoldPricePerGram) }}/g.
                            Automatically estimated from total amount.
                        </p>
                    </div>

                    <div>
                        <label class="text-xs font-semibold text-mist-400 block mb-1">
                            Amount (IDR)
                        </label>
                        <input
                            v-model="formAmount"
                            type="number"
                            required
                            placeholder="0"
                            class="w-full text-xs border border-mist-800 bg-mist-850 text-mist-100 rounded-md p-2.5 font-mono"
                            @input="handleAmountChange" />
                    </div>

                    <div>
                        <label class="block text-xs font-medium text-mist-400">
                            Date
                            <div class="relative mt-1">
                                <input
                                    v-model="formDate"
                                    type="date"
                                    class="w-full appearance-none rounded-md border border-mist-800 bg-mist-950/50 py-2 px-3 text-sm text-mist-200 focus:border-lime-500 focus:outline-none transition-colors"
                                    required />
                                <div
                                    class="pointer-events-none absolute inset-y-0 right-2 flex items-center text-mist-500">
                                    <fa-icon
                                        class="text-sm"
                                        icon="calendar-days" />
                                </div>
                            </div>
                        </label>
                    </div>

                    <div>
                        <label class="text-xs font-semibold text-mist-400 block mb-1">Notes</label>
                        <input
                            v-model="formNotes"
                            type="text"
                            placeholder="e.g. Monthly emergency fund deposit"
                            class="w-full text-xs border border-mist-800 bg-mist-850 text-mist-100 rounded-md p-2.5" />
                    </div>

                    <div class="flex justify-end space-x-2 pt-3">
                        <button
                            type="button"
                            class="text-xs px-3 py-2 text-mist-400 hover:text-mist-200"
                            @click="isModalOpen = false">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            :disabled="isLoading || isSubmitting"
                            class="bg-lime-400 hover:bg-lime-300 disabled:opacity-50 disabled:cursor-not-allowed text-mist-950 text-xs px-4 py-2 rounded-md font-semibold transition flex items-center gap-1.5">
                            <span
                                v-if="isSubmitting"
                                class="w-3 h-3 border-2 border-mist-800 border-t-transparent rounded-full animate-spin"></span>
                            <span>{{ isEditing ? 'Save Changes' : 'Add Entry' }}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</template>
