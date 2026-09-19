<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useFinanceSync } from '@/composables/useFinanceSync';
import { getPropertyStyle } from '@/config/properties';
import { useFinanceStore } from '@/stores/useFinanceStore';
import type { PropertyFinance, PropertyFinanceType, PropertyCategory } from '@/types/finance';
import { formatIDR } from '@/utils/money';

import CardTitle from '@/components/CardTitle.vue';
import TransactionNote from '@/components/finance/TransactionNote.vue';

const financeStore = useFinanceStore();
const { addPropertyTransaction, editPropertyTransaction, removePropertyTransaction } =
    useFinanceSync();
const { filteredPropertyFinances, isLoading } = storeToRefs(financeStore);

const isModalOpen = ref(false);
const isSubmitting = ref(false);
const filterCategory = ref<string>('ALL');
const editingItem = ref<PropertyFinance | null>(null);

const currentPage = ref(1);
const pageSize = ref(10);
const pageSizeOptions = [5, 10, 20, 50];

const formPropertyId = ref('piyungan');
const formType = ref<PropertyFinanceType>('income');
const formCategory = ref<PropertyCategory>('Supplies');
const formAmount = ref<number | null>(null);
const formDate = ref(new Date().toISOString().slice(0, 10));
const formNotes = ref('');

const categories = [
    'Payout',
    'Cleaning',
    'Maintenance',
    'Electricity',
    'Internet',
    'Supplies',
    'Garbage Disposal',
];

const isEditing = computed(() => editingItem.value !== null);

const displayedTransactions = computed(() => {
    const list =
        filterCategory.value === 'ALL'
            ? filteredPropertyFinances.value
            : filteredPropertyFinances.value.filter((i) => i.category === filterCategory.value);

    return [...list].sort((a, b) => b.date.localeCompare(a.date));
});

const totalItems = computed(() => displayedTransactions.value.length);
const totalPages = computed(() => Math.ceil(totalItems.value / pageSize.value) || 1);

const paginatedTransactions = computed(() => {
    const start = (currentPage.value - 1) * pageSize.value;
    return displayedTransactions.value.slice(start, start + pageSize.value);
});

const startItemIndex = computed(() => {
    if (totalItems.value === 0) return 0;
    return (currentPage.value - 1) * pageSize.value + 1;
});

const endItemIndex = computed(() => {
    return Math.min(currentPage.value * pageSize.value, totalItems.value);
});

watch([filterCategory, pageSize, () => filteredPropertyFinances.value.length], () => {
    currentPage.value = 1;
});

const sanitizeAmount = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const cleanedString = target.value.replace(/\D/g, '');
    formAmount.value = cleanedString ? parseInt(cleanedString, 10) : 0;
    target.value = cleanedString;
};
function goToPage(page: number): void {
    if (page >= 1 && page <= totalPages.value) {
        currentPage.value = page;
    }
}

function openAddModal(): void {
    editingItem.value = null;
    formPropertyId.value = 'piyungan';
    formType.value = 'expense';
    formCategory.value = '';
    formAmount.value = null;
    formDate.value = new Date().toISOString().slice(0, 10);
    formNotes.value = '';
    isModalOpen.value = true;
}

function openEditModal(item: PropertyFinance): void {
    if (item.id.startsWith('dexie-')) return;
    editingItem.value = item;
    formPropertyId.value = item.propertyId;
    formType.value = item.type;
    formCategory.value = item.category;
    formAmount.value = item.amount;
    formDate.value = item.date;
    formNotes.value = item.notes || '';
    isModalOpen.value = true;
}

async function submitTransaction(): Promise<void> {
    if (isSubmitting.value || !formAmount.value || !formDate.value) return;

    isSubmitting.value = true;
    try {
        let success = false;

        if (isEditing.value && editingItem.value) {
            success = await editPropertyTransaction(editingItem.value.id, {
                propertyId: formPropertyId.value,
                type: formType.value,
                category: formCategory.value,
                amount: Number(formAmount.value),
                date: formDate.value,
                notes: formNotes.value,
            });
        } else {
            success = await addPropertyTransaction({
                propertyId: formPropertyId.value,
                type: formType.value,
                category: formCategory.value,
                amount: Number(formAmount.value),
                date: formDate.value,
                notes: formNotes.value,
            });
        }

        if (success) {
            isModalOpen.value = false;
            editingItem.value = null;
            formAmount.value = null;
            formNotes.value = '';
        }
    } finally {
        setTimeout(() => {
            isSubmitting.value = false;
        }, 1000);
    }
}

const triggerDatePicker = (event: MouseEvent): void => {
    const target = event.currentTarget as HTMLInputElement | null;

    try {
        target?.showPicker();
    } catch {
        target?.focus();
    }
};
</script>

<template>
    <div class="flex flex-col">
        <div class="flex items-center justify-between">
            <CardTitle>
                <template #title>Transaction Overview</template>
                <template #subtitle>
                    Bookings auto populated from DexieDB + Google Sheets expenses
                </template>
            </CardTitle>
            <div class="flex gap-4">
                <select
                    v-model="filterCategory"
                    class="text-xs border border-mist-700 rounded-md px-2.5 py-1.5 bg-mist-850 text-mist-200 focus:outline-none focus:border-lime-400">
                    <option value="ALL">All Categories</option>
                    <option
                        v-for="cat in categories"
                        :key="cat"
                        :value="cat">
                        {{ cat }}
                    </option>
                    <option value="Owner Payout Outflow">Owner Payout Outflow</option>
                </select>
                <button
                    class="bg-lime-400 hover:bg-lime-300 text-mist-950 text-xs font-bold px-3 py-1.5 rounded-md transition shadow-sm"
                    @click="openAddModal">
                    + Add Entry
                </button>
            </div>
        </div>

        <div class="overflow-x-auto rounded-md border border-mist-800 bg-mist-900 shadow-md">
            <table class="w-full text-left text-sm text-mist-300 table-fixed">
                <thead
                    class="border-b border-mist-800/50 bg-mist-950/40 text-xs font-semibold uppercase text-mist-400">
                    <tr>
                        <th class="w-35 py-3 px-3">Date</th>
                        <th class="w-35 py-3 px-3">Property</th>
                        <th class="w-45 py-3 px-3">Category</th>
                        <th class="py-3 px-3">Source</th>
                        <th class="py-3 px-3 text-right">Amount</th>
                        <th class="w-30 py-3 px-3 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-mist-800/60">
                    <tr
                        v-for="item in paginatedTransactions"
                        :key="item.id"
                        class="hover:bg-mist-850/50">
                        <td class="py-3 px-3 text-mist-400 text-xs font-mono">{{ item.date }}</td>
                        <td class="py-3 px-3">
                            <!-- <span
                                class="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
                                :class="
                                    item.type === 'income'
                                        ? 'bg-lime-400/10 text-lime-400 border border-lime-400/20'
                                        : 'bg-rose-400/10 text-rose-400 border border-rose-400/20'
                                ">
                                {{ item.type }}
                            </span> -->
                            <RouterLink
                                :to="{ name: 'property-detail', params: { id: item.propertyId } }"
                                :class="getPropertyStyle(item.propertyId)">
                                {{ item.propertyId }}
                            </RouterLink>
                        </td>
                        <td class="py-3 px-3">
                            {{ item.category }}
                        </td>
                        <td class="py-3 px-3 text-mist-400 flex items-center gap-1.5">
                            <span
                                v-if="item.id.startsWith('dexie-')"
                                class="text-[9px] bg-lime-400/10 text-lime-400 border border-lime-400/30 px-1.5 py-0.5 rounded-md font-mono font-bold">
                                DEXIE
                            </span>
                            <TransactionNote :notes="item.notes" />
                        </td>
                        <td
                            class="py-3 px-3 text-right font-bold font-mono text-xs"
                            :class="item.type === 'income' ? 'text-lime-400' : 'text-rose-400'">
                            {{ item.type === 'expense' ? '-' : '+' }}{{ formatIDR(item.amount) }}
                        </td>
                        <td class="py-3 px-3">
                            <div
                                v-if="!item.id.startsWith('dexie')"
                                class="flex items-center justify-end gap-1">
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
                                    @click="removePropertyTransaction(item.id, item.category)">
                                    <fa-icon
                                        icon="trash-can"
                                        class="text-xs" />
                                </button>
                            </div>
                        </td>
                    </tr>
                    <tr v-if="displayedTransactions.length === 0">
                        <td
                            colspan="6"
                            class="py-6 text-center text-mist-400">
                            No records for this month.
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Paginator Footer -->
        <div
            v-if="totalItems > 0"
            class="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 text-xs text-mist-400">
            <div class="flex items-center gap-3">
                <span class="">
                    Showing
                    <strong class="text-mist-200 font-mono">{{ startItemIndex }}</strong>
                    to
                    <strong class="text-mist-200 font-mono">{{ endItemIndex }}</strong>
                    of
                    <strong class="text-mist-200 font-mono">{{ totalItems }}</strong>
                    records
                </span>

                <div class="flex items-center gap-1.5">
                    <label for="page-size">Per page:</label>
                    <select
                        id="page-size"
                        v-model="pageSize"
                        class="bg-mist-850 border border-mist-700 text-mist-200 rounded-md px-1.5 py-0.5 text-xs font-mono focus:outline-none focus:border-lime-400">
                        <option
                            v-for="opt in pageSizeOptions"
                            :key="opt"
                            :value="opt">
                            {{ opt }}
                        </option>
                    </select>
                </div>
            </div>

            <div class="flex items-center gap-1 font-mono">
                <button
                    :disabled="currentPage <= 1"
                    class="pl-1 pr-2.5 py-1 rounded-md bg-mist-850 border border-mist-700 text-mist-200 hover:bg-mist-800 disabled:opacity-40 disabled:hover:bg-mist-850 transition"
                    @click="goToPage(currentPage - 1)">
                    <fa-icon
                        class="text-[10px]"
                        icon="chevron-left" />
                    Prev
                </button>

                <span class="px-3 py-1 text-mist-300">
                    Page <strong class="text-lime-400 font-mono">{{ currentPage }}</strong> of
                    <strong class="font-mono">{{ totalPages }}</strong>
                </span>

                <button
                    :disabled="currentPage >= totalPages"
                    class="pl-2.5 pr-1 py-1 rounded-md bg-mist-850 border border-mist-700 text-mist-200 hover:bg-mist-800 disabled:opacity-40 disabled:hover:bg-mist-850 transition"
                    @click="goToPage(currentPage + 1)">
                    Next
                    <fa-icon
                        class="text-[10px]"
                        icon="chevron-right" />
                </button>
            </div>
        </div>

        <!-- Manual Expense/Income Modal -->
        <div
            v-if="isModalOpen"
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm">
            <div
                class="w-full max-w-2xl rounded-md border border-mist-800 bg-mist-900 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 space-y-4 p-4">
                <div
                    class="flex items-center justify-between border-b border-mist-800 -mt-4 -mr-4 -ml-4 p-4 bg-mist-950/60">
                    <h2 class="text-base font-bold text-mist-100">
                        {{ isEditing ? 'Edit Property Record' : 'Add Property Record' }}
                    </h2>
                    <button
                        type="button"
                        class="cursor-pointer text-mist-400 hover:text-mist-200"
                        @click="isModalOpen = false">
                        <fa-icon icon="xmark" />
                    </button>
                </div>
                <form
                    class="space-y-4"
                    @submit.prevent="submitTransaction">
                    <div class="relative">
                        <label
                            for="property"
                            class="block text-xs font-medium text-mist-400">
                            Transaction
                        </label>
                        <select
                            id="property"
                            v-model="formType"
                            name="property"
                            required
                            class="w-full appearance-none rounded-md border border-mist-800 bg-mist-950/50 mt-1 px-3 py-2 text-sm text-mist-200 focus:border-lime-500 focus:outline-none transition-colors cursor-pointer">
                            <option value="expense">Expense</option>
                            <option value="income">Income</option>
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
                            Category
                        </label>
                        <select
                            id="property"
                            v-model="formCategory"
                            name="property"
                            required
                            class="w-full appearance-none rounded-md border border-mist-800 bg-mist-950/50 mt-1 px-3 py-2 text-sm focus:border-lime-500 focus:outline-none transition-colors cursor-pointer"
                            :class="[formCategory === '' ? 'text-mist-600' : 'text-mist-200']">
                            <option
                                value=""
                                disabled>
                                Select a category
                            </option>
                            <option
                                v-for="cat in categories"
                                :key="cat"
                                :value="cat">
                                {{ cat }}
                            </option>
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
                                v-model="formDate"
                                type="date"
                                class="w-full appearance-none rounded-md border border-mist-800 bg-mist-950/50 mt-1 py-2 px-3 text-sm text-mist-200 font-mono focus:border-lime-500 focus:outline-none transition-colors"
                                required
                                @click="triggerDatePicker" />
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
                                :value="formAmount"
                                type="number"
                                placeholder="100000"
                                class="w-full rounded-md bg-mist-950/50 border border-mist-800 mt-1 pl-8 pr-4 py-2 text-sm text-mist-200 font-mono placeholder-mist-600 focus:border-lime-500 focus:outline-none transition-colors"
                                required
                                @input="sanitizeAmount" />
                        </div>
                    </div>

                    <div>
                        <label class="text-xs font-semibold text-mist-400 block mb-1">Notes</label>
                        <input
                            v-model="formNotes"
                            type="text"
                            placeholder="Notes.."
                            class="w-full appearance-none rounded-md border border-mist-800 bg-mist-950/50 mt-1 py-2 px-3 text-sm text-mist-200 focus:border-lime-500 focus:outline-none placeholder-mist-600 transition-colors" />
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
                            :disabled="isLoading"
                            class="bg-lime-400 hover:bg-lime-300 text-mist-950 text-xs px-4 py-2 rounded-md font-bold transition">
                            {{ isEditing ? 'Update' : 'Add Record' }}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</template>
