<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useFinanceSync } from '@/composables/useFinanceSync';
import { getPropertyStyle } from '@/config/properties';
import { useFinanceStore } from '@/stores/useFinanceStore';
import type { PropertyFinance, PropertyFinanceType, PropertyCategory } from '@/types/finance';
import { formatIDR } from '@/utils/money';

import DatePicker from '@/components/ui/DatePicker.vue';
import SelectDropdown from '@/components/ui/SelectDropdown.vue';
import TextInput from '@/components/ui/TextInput.vue';
import CardTitle from '@/components/CardTitle.vue';
import TransactionNote from '@/components/TransactionNote.vue';
import TransferModal from '@/features/finance/TransferModal.vue';

const financeStore = useFinanceStore();
const { addPropertyTransaction, editPropertyTransaction, removePropertyTransaction } =
    useFinanceSync();
const { filteredPropertyFinances, isLoading } = storeToRefs(financeStore);

const categoryOptions = [
    'All categories',
    // Operations & Guest Amenities
    'Cleaning',
    'Guest Amenities & Toiletries',
    'Food & Beverages',
    'Linens & Soft Goods',

    // Utilities & Recurring Costs
    'Utilities', // Electricity, Water, Gas
    'Connectivity & Media',
    'Garbage Disposal',

    // Maintenance & Upkeep
    'Property Maintenance',

    // Administrative & Platform
    'Payout',

    // Capital & Legal
    'Furniture',
    'Taxes, Permits & Insurance',
].map((status) => ({
    label: status,
    value: status,
}));
const transactionOptions = [
    { label: 'Expense', value: 'expense' },
    { label: 'Income', value: 'income' },
];

const isModalOpen = ref(false);
const isTransferModalOpen = ref(false);
const isSubmitting = ref(false);
const filterCategory = ref<string>('All categories');
const editingItem = ref<PropertyFinance | null>(null);
const currentPage = ref(1);
const pageSize = ref(10);
const formPropertyId = ref('piyungan');
const formType = ref<PropertyFinanceType>('income');
const formCategory = ref<PropertyCategory>('Supplies');
const formAmount = ref<number | null>(null);
const formDate = ref(new Date().toISOString().slice(0, 10));
const formNotes = ref('');

const isEditing = computed(() => editingItem.value !== null);
const displayedTransactions = computed(() => {
    if (filterCategory.value === 'All categories') return filteredPropertyFinances.value;
    return filteredPropertyFinances.value.filter((i) => i.category === filterCategory.value);
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
const endItemIndex = computed(() => Math.min(currentPage.value * pageSize.value, totalItems.value));

const goToPage = (page: number): void => {
    if (page >= 1 && page <= totalPages.value) {
        currentPage.value = page;
    }
};
const openAddModal = (): void => {
    editingItem.value = null;
    formPropertyId.value = 'piyungan';
    formType.value = 'expense';
    formCategory.value = '';
    formAmount.value = null;
    formDate.value = new Date().toISOString().slice(0, 10);
    formNotes.value = '';
    isModalOpen.value = true;
};
const openEditModal = (item: PropertyFinance): void => {
    if (item.id.startsWith('dexie-')) return;
    editingItem.value = item;
    formPropertyId.value = item.propertyId;
    formType.value = item.type;
    formCategory.value = item.category;
    formAmount.value = item.amount;
    formDate.value = item.date;
    formNotes.value = item.notes || '';
    isModalOpen.value = true;
};
const submitTransaction = async (): Promise<void> => {
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
};

watch([filterCategory, pageSize, () => filteredPropertyFinances.value.length], () => {
    currentPage.value = 1;
});
</script>

<template>
    <div class="min-h-0 flex flex-col">
        <div class="flex items-center justify-between">
            <CardTitle>
                <template #title>Transaction Overview</template>
                <template #subtitle> Bookings auto populated from DexieDB and expenses </template>
            </CardTitle>
            <div class="flex items-center gap-2">
                <SelectDropdown
                    v-model="filterCategory"
                    input-label=""
                    class="w-60"
                    :options="categoryOptions" />
                <button
                    class="shrink-0 bg-lime-400 hover:bg-lime-300 text-mist-950 text-xs font-semibold px-3 py-2 rounded-md transition shadow-sm"
                    @click="openAddModal">
                    + Add Entry
                </button>
                <button
                    class="shrink-0 bg-lime-400 hover:bg-lime-300 text-mist-950 text-xs font-semibold px-3 py-2 rounded-md transition shadow"
                    @click="isTransferModalOpen = true">
                    Transfer Funds
                </button>
            </div>
        </div>

        <div class="flex-1 rounded-md border border-mist-800 bg-mist-900 shadow-md">
            <table class="w-full text-left text-sm text-mist-300 table-fixed border-collapse">
                <thead
                    class="border-b border-mist-800 bg-mist-950/40 text-xs font-bold uppercase text-mist-400">
                    <tr>
                        <th class="w-28 px-4 py-2.5">Date</th>
                        <th class="w-28 px-4 py-2.5">Property</th>
                        <th class="w-50 px-4 py-2.5">Category</th>
                        <th class="w-auto px-4 py-2.5">Source</th>
                        <th class="w-35 px-4 py-2.5 text-right">Amount</th>
                        <th class="w-23 px-4 py-2.5 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-mist-800/60 align-middle">
                    <tr
                        v-for="item in paginatedTransactions"
                        :key="item.id"
                        class="hover:bg-mist-800/40 align-middle">
                        <td class="px-4 py-2.5 align-middle text-mist-400 text-xs font-mono">
                            {{ item.date }}
                        </td>
                        <td class="px-4 py-2.5 align-middle">
                            <RouterLink
                                :to="{ name: 'property-detail', params: { id: item.propertyId } }"
                                :class="getPropertyStyle(item.propertyId)">
                                {{ item.propertyId }}
                            </RouterLink>
                        </td>
                        <td class="px-4 py-2.5 align-middle truncate">
                            {{ item.category }}
                        </td>
                        <td class="px-4 py-2.5 align-middle text-mist-400 truncate">
                            <div class="flex items-center gap-1.5">
                                <span
                                    v-if="item.id.startsWith('dexie-')"
                                    class="text-[9px] bg-lime-400/10 text-lime-400 px-1.5 py-0.5 rounded-xs font-mono font-bold shrink-0">
                                    DEXIE
                                </span>
                                <TransactionNote :notes="item.notes" />
                            </div>
                        </td>
                        <td class="px-4 py-2.5 text-right font-bold font-mono text-xs">
                            <span
                                :class="
                                    item.type === 'income' ? 'text-emerald-400' : 'text-rose-400'
                                ">
                                {{ item.type === 'expense' ? '-' : '+' }}
                            </span>
                            {{ formatIDR(item.amount) }}
                        </td>
                        <td class="px-4 py-2.5 align-middle">
                            <div class="flex items-center justify-end gap-1 h-7">
                                <button
                                    v-if="!item.id.startsWith('dexie')"
                                    type="button"
                                    title="Edit Transaction"
                                    class="opacity-70 group-hover:opacity-100 text-mist-400 hover:text-lime-400 p-1 rounded hover:bg-mist-800 transition"
                                    @click="openEditModal(item)">
                                    <fa-icon
                                        icon="pen-to-square"
                                        class="text-xs" />
                                </button>
                                <span
                                    v-if="!item.id.startsWith('dexie')"
                                    class="text-mist-700">
                                    |
                                </span>
                                <button
                                    v-if="!item.id.startsWith('dexie')"
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
                        class="bg-mist-800 border border-mist-800 text-mist-200 rounded-md px-1.5 py-0.5 text-xs font-mono focus:outline-none focus:border-lime-400">
                        <option
                            v-for="opt in [5, 10, 20, 50]"
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
                    class="pl-1 pr-2.5 py-1 rounded-md bg-mist-800 border border-mist-800 text-mist-200 hover:bg-mist-800 disabled:opacity-40 disabled:hover:bg-mist-800 transition"
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
                    class="pl-2.5 pr-1 py-1 rounded-md bg-mist-800 border border-mist-800 text-mist-200 hover:bg-mist-800 disabled:opacity-40 disabled:hover:bg-mist-800 transition"
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
            class="fixed inset-0 z-50 flex items-center justify-center bg-mist-950/75 backdrop-blur-sm">
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
                    class="max-h-[80vh] overflow-y-auto space-y-4"
                    @submit.prevent="submitTransaction">
                    <SelectDropdown
                        v-model="formType"
                        input-label="Transaction"
                        placeholder="Select transaction"
                        :options="transactionOptions" />

                    <SelectDropdown
                        v-model="formCategory"
                        input-label="Category"
                        placeholder="Select category"
                        :options="categoryOptions" />

                    <div class="grid grid-cols-2 gap-4">
                        <DatePicker
                            v-model="formDate"
                            input-label="Date"
                            :width="311"
                            :select-today-by-default="true" />

                        <TextInput
                            id="payout"
                            v-model.number="formAmount"
                            input-label="Amount"
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
                        v-model.trim="formNotes"
                        input-label="Notes"
                        type="text"
                        placeholder="..." />

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
                            class="bg-lime-400 hover:bg-lime-300 text-mist-950 text-xs px-4 py-2 rounded-md font-semibold transition">
                            {{ isEditing ? 'Update' : 'Add Record' }}
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <TransferModal v-model="isTransferModalOpen" />
    </div>
</template>
