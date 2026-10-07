<script setup lang="ts">
import { ref, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useFinanceSync } from '@/composables/useFinanceSync';
import { sortNewestFirst } from '@/utils/finance';
import { formatIDR } from '@/utils/money';
import type { PersonalFinance, SharedFinance, PersonalOwner } from '@/types/finance';
import AppButton from '@/components/ui/AppButton.vue';
import CardTitle from '@/components/CardTitle.vue';
import TransactionNote from '@/components/TransactionNote.vue';
import RecurringChecklist from '@/features/finance/RecurringChecklist.vue';
import PersonalTransactionModal from '@/features/finance/PersonalTransactionModal.vue';

interface Props {
    owner?: PersonalOwner | 'Shared';
}

const { owner = 'Danh Nguyen' } = defineProps<Props>();

const financeStore = useFinanceStore();
const { removePersonalTransaction, removeSharedTransaction } = useFinanceSync();
const {
    filteredPersonalFinances,
    filteredSharedFinances,
    monthlyProjectedIncome,
    monthlyProjectedExpenses,
} = storeToRefs(financeStore);

const isModalOpen = ref<boolean>(false);
const editingItem = ref<PersonalFinance | SharedFinance | null>(null);
const showRecurring = ref<boolean>(false);

const currentList = computed<(PersonalFinance | SharedFinance)[]>(() => {
    if (owner === 'Shared') {
        return [...filteredSharedFinances.value].sort(sortNewestFirst);
    }
    return filteredPersonalFinances.value.filter((i) => i.owner === owner).sort(sortNewestFirst);
});
const totalRecurringCount = computed<number>(() => {
    const recurringItems = [...monthlyProjectedIncome.value, ...monthlyProjectedExpenses.value];
    return recurringItems.filter((i) => {
        if (i.isSettled) return false;
        if (owner === 'Shared') return i.targetLedger === 'Shared';
        return i.owner === owner;
    }).length;
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
    if ('owner' in item && item.owner) {
        await removePersonalTransaction(item.id, item.category);
    } else {
        await removeSharedTransaction(item.id, item.category);
    }
    isModalOpen.value = false;
}
function handleCloseModal(): void {
    editingItem.value = null;
}
</script>

<template>
    <div class="flex h-full min-h-0 flex-col">
        <div class="flex shrink-0 items-center justify-between">
            <CardTitle>
                <template #title>Budget Overview</template>
                <template #subtitle> Operating ledger & commitments for {{ owner }} </template>
            </CardTitle>
            <div class="flex items-center gap-2">
                <button
                    type="button"
                    class="cursor-pointer rounded-md border border-mist-800 px-3 py-1.5 text-xs text-mist-300 shadow-sm transition hover:bg-mist-800"
                    :class="[
                        showRecurring ? 'border-mist-700 bg-mist-800 text-lime-400' : 'bg-mist-900',
                    ]"
                    title="Toggle recurring commitments"
                    @click="showRecurring = !showRecurring">
                    <fa-icon
                        class="mr-1 text-xs"
                        icon="arrows-rotate" />
                    <span>Recurring ({{ totalRecurringCount }})</span>
                </button>

                <AppButton
                    label="Add Record"
                    @click="openAddModal">
                    <template #icon>
                        <fa-icon icon="plus" />
                    </template>
                </AppButton>
            </div>
        </div>

        <RecurringChecklist
            v-if="showRecurring"
            :owner="owner"
            class="h-full" />

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
                        <th class="w-24 px-4 py-2.5 text-center">Actions</th>
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
                                    class="rounded border border-amber-400/20 bg-amber-400/10 px-1 font-mono text-[9px] font-semibold text-amber-400">
                                    GOLD
                                </span>
                            </div>
                        </td>
                        <td class="truncate px-4 py-2.5 align-middle text-mist-400">
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
                            <div class="flex items-center justify-end">
                                <AppButton
                                    variant="icon"
                                    @click="openEditModal(item)">
                                    <template #icon>
                                        <fa-icon icon="pen-to-square" />
                                    </template>
                                </AppButton>
                                <span class="text-mist-700">|</span>
                                <AppButton
                                    variant="icon"
                                    color="rose"
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
                            class="py-12 text-center text-mist-400">
                            No matching ledger entries logged for {{ owner }}.
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <PersonalTransactionModal
            v-model="isModalOpen"
            :owner="owner"
            :item-to-edit="editingItem"
            @delete-item="handleDelete"
            @closed="handleCloseModal" />
    </div>
</template>
