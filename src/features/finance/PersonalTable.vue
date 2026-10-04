<script setup lang="ts">
import { ref, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useFinanceSync } from '@/composables/useFinanceSync';
import type { PersonalFinance, SharedFinance } from '@/types/finance';
import { formatIDR } from '@/utils/money';

import AppButton from '@/components/ui/AppButton.vue';
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
    isModalOpen.value = false;
}
</script>

<template>
    <div class="flex h-full min-h-0 flex-col space-y-4">
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
                    class="cursor-pointer rounded-md border border-mist-800 px-3 py-2 text-xs text-mist-300 shadow-sm transition hover:bg-mist-800"
                    :class="[showRecurring ? 'bg-mist-800' : 'bg-mist-900']"
                    title="Filter by Status"
                    @click="showRecurring = !showRecurring">
                    <fa-icon
                        class="mr-1 text-xs"
                        icon="arrows-rotate" />
                    Recurring Payments ({{ totalRecurringCount }})
                </button>
                <AppButton
                    label="Add Record"
                    variant="primary"
                    @click="openAddModal">
                    <template #icon>
                        <fa-icon icon="plus" />
                    </template>
                </AppButton>
            </div>
        </div>

        <RecurringChecklist
            v-if="showRecurring"
            class="min-h-0 flex-1 overflow-auto" />

        <div
            v-else
            class="min-h-0 flex-1 overflow-auto rounded-md border border-mist-800 bg-mist-900 shadow-md">
            <table class="w-full table-fixed border-collapse text-left text-sm text-mist-200">
                <thead
                    class="sticky top-0 z-10 border-b border-mist-800 bg-mist-950/50 text-xs font-semibold text-mist-400 uppercase backdrop-blur-sm">
                    <tr>
                        <th class="w-28 px-4 py-2.5">Date</th>
                        <th class="w-36 px-4 py-2.5">Category</th>
                        <th class="w-auto px-4 py-2.5">Notes</th>
                        <th class="w-35 px-4 py-2.5 text-right">Amount</th>
                        <th class="w-23 px-4 py-2.5 text-center">Actions</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-mist-800/60 align-middle">
                    <tr
                        v-for="item in currentList"
                        :key="item.id"
                        class="group hover:bg-mist-800/50">
                        <td class="px-4 py-2.5 align-middle font-mono text-xs text-mist-400">
                            {{ item.date }}
                        </td>
                        <td class="px-4 py-2.5 align-middle font-medium text-mist-100">
                            <div class="flex items-center gap-1.5">
                                <span>{{ item.category }}</span>
                                <span
                                    v-if="item.category === 'Gold'"
                                    class="rounded-md border border-amber-400/20 bg-amber-400/10 px-1 font-mono text-[9px] font-semibold text-amber-400">
                                    GOLD
                                </span>
                            </div>
                        </td>
                        <td class="px-4 py-2.5 align-middle text-mist-400">
                            <span
                                v-if="'savingsInstitution' in item && item.savingsInstitution"
                                class="mr-1 font-semibold text-blue-400">
                                [{{ item.savingsInstitution }}]
                            </span>
                            <span
                                v-if="'goldWeightGrams' in item && item.goldWeightGrams"
                                class="mr-1 font-semibold text-amber-400">
                                [{{ item.goldWeightGrams }}g]
                            </span>
                            <TransactionNote :notes="item.notes" />
                        </td>
                        <td
                            class="px-4 py-2.5 text-right align-middle font-mono text-xs font-medium">
                            <span
                                :class="
                                    item.type === 'income' ? 'text-emerald-400' : 'text-rose-400'
                                ">
                                {{ item.type === 'income' ? '+' : '-' }}
                            </span>
                            {{ formatIDR(item.amount) }}
                        </td>
                        <td class="h-7 px-4 py-2.5 text-center align-middle">
                            <div class="flex items-center justify-end gap-1">
                                <AppButton
                                    variant="icon"
                                    @click="openEditModal(item)">
                                    <template #icon>
                                        <fa-icon icon="pen-to-square" />
                                    </template>
                                </AppButton>
                                <span class="text-mist-700">|</span>
                                <AppButton
                                    variant="danger-icon"
                                    @click="handleDelete(item)">
                                    <template #icon>
                                        <fa-icon icon="trash-can" />
                                    </template>
                                </AppButton>
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
            @delete-item="handleDelete"
            @closed="editingItem = null" />
    </div>
</template>
