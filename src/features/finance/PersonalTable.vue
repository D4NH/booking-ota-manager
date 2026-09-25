<script setup lang="ts">
import { ref, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useFinanceSync } from '@/composables/useFinanceSync';
import type { PersonalFinance, SharedFinance } from '@/types/finance';
import { formatIDR } from '@/utils/money';

import CardTitle from '@/components/CardTitle.vue';
import TransactionNote from '@/components/TransactionNote.vue';
import RecurringChecklist from '@/features/finance/RecurringChecklist.vue';
import PersonalTransactionModal from '@/features/finance/PersonalTransactionModal.vue';

const financeStore = useFinanceStore();
const { removePersonalTransaction, removeSharedTransaction } = useFinanceSync();
const {
    filteredPersonalFinances,
    filteredSharedFinances,
    monthlyProjectedIncome,
    monthlyProjectedExpenses,
} = storeToRefs(financeStore);

const activeTab = ref<'Danh Nguyen' | 'Citra Ayu Wardani' | 'Shared'>('Danh Nguyen');
const isModalOpen = ref(false);
const editingItem = ref<PersonalFinance | SharedFinance | null>(null);
const showRecurring = ref(false);

const currentList = computed<(PersonalFinance | SharedFinance)[]>(() => {
    if (activeTab.value === 'Shared') return filteredSharedFinances.value;
    return filteredPersonalFinances.value.filter((i) => i.owner === activeTab.value);
});
const totalRecurringCount = computed(() => {
    const recurringItems = [...monthlyProjectedIncome.value, ...monthlyProjectedExpenses.value];
    return recurringItems.filter((i) => !i.isSettled).length;
});

function openAddModal(): void {
    editingItem.value = null;
    isModalOpen.value = true;
}
function openEditModal(item: PersonalFinance | SharedFinance): void {
    editingItem.value = item;
    isModalOpen.value = true;
}
async function handleDelete(item: PersonalFinance | SharedFinance): Promise<void> {
    if (activeTab.value === 'Shared') {
        await removeSharedTransaction(item.id, item.category);
    } else {
        await removePersonalTransaction(item.id, item.category);
    }
}
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
                    v-for="tab in ['Danh Nguyen', 'Citra Ayu Wardani', 'Shared'] as const"
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
                    class="bg-lime-400 hover:bg-lime-300 text-mist-950 text-xs font-semibold px-3 py-2 rounded-md transition shadow-sm cursor-pointer"
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
                        class="hover:bg-mist-800/50 group">
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
                                :class="
                                    item.type === 'income' ? 'text-emerald-400' : 'text-rose-400'
                                ">
                                {{ item.type === 'income' ? '+' : '-' }}
                            </span>
                            {{ formatIDR(item.amount) }}
                        </td>
                        <td class="px-4 py-2.5 align-middle text-center">
                            <div class="flex items-center justify-end gap-1 h-7">
                                <button
                                    type="button"
                                    title="Edit Transaction"
                                    class="opacity-70 group-hover:opacity-100 text-mist-400 hover:text-lime-400 p-1 rounded hover:bg-mist-800 transition cursor-pointer"
                                    @click="openEditModal(item)">
                                    <fa-icon
                                        icon="pen-to-square"
                                        class="text-xs" />
                                </button>
                                <span class="text-mist-700">|</span>
                                <button
                                    type="button"
                                    title="Delete Transaction"
                                    class="opacity-70 group-hover:opacity-100 text-mist-400 hover:text-rose-400 p-1 rounded hover:bg-mist-800 transition cursor-pointer"
                                    @click="handleDelete(item)">
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

        <!-- External Modal -->
        <PersonalTransactionModal
            v-model="isModalOpen"
            :owner="activeTab"
            :item-to-edit="editingItem"
            @closed="editingItem = null" />
    </div>
</template>
