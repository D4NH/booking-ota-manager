<script setup lang="ts">
import { ref, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useFinanceSync } from '@/composables/useFinanceSync';
import { useFinanceStore } from '@/stores/useFinanceStore';
import type { PersonalFinance, SharedFinance, PersonalOwner } from '@/types/finance';
import { formatDate, getCurrentDate } from '@/utils/date';
import { sortNewestFirst } from '@/utils/finance';
import { formatIDR } from '@/utils/money';
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
const { removePersonalTransaction, removeSharedTransaction, executeOwnerTransfer } =
    useFinanceSync();
const {
    filteredPersonalFinances,
    filteredSharedFinances,
    filteredTransfers,
    monthlyProjectedIncome,
    monthlyProjectedExpenses,
    netPropertyProfit,
} = storeToRefs(financeStore);

const isModalOpen = ref<boolean>(false);
const editingItem = ref<PersonalFinance | SharedFinance | null>(null);
const showRecurring = ref<boolean>(false);
const isTransferModalOpen = ref<boolean>(false);
const transferAmount = ref<number>(0);
const transferDate = ref<string>(getCurrentDate());
const transferNotes = ref<string>('Remaining property profit allocation');
const isTransferring = ref<boolean>(false);

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

const propertyProfitTotal = computed<number>(() => Math.max(0, netPropertyProfit.value));

const danhTransfersTotal = computed<number>(() =>
    filteredTransfers.value
        .filter((t) => t.targetAccount === 'Danh Nguyen')
        .reduce((sum, t) => sum + Number(t.amount || 0), 0)
);

const citraTransfersTotal = computed<number>(() =>
    filteredTransfers.value
        .filter((t) => t.targetAccount === 'Citra Ayu Wardani')
        .reduce((sum, t) => sum + Number(t.amount || 0), 0)
);

const sharedTransfersTotal = computed<number>(() =>
    filteredTransfers.value
        .filter((t) => t.targetAccount === 'Shared')
        .reduce((sum, t) => sum + Number(t.amount || 0), 0)
);

const remainingPayoutForShared = computed<number>(() => {
    const distributed =
        danhTransfersTotal.value + citraTransfersTotal.value + sharedTransfersTotal.value;
    return Math.max(0, propertyProfitTotal.value - distributed);
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

function openSharedTransferModal(): void {
    transferAmount.value = remainingPayoutForShared.value;
    transferDate.value = getCurrentDate();
    transferNotes.value = 'Remaining property net profit allocation';
    isTransferModalOpen.value = true;
}
function closeSharedTransferModal(): void {
    isTransferModalOpen.value = false;
}
async function handleConfirmSharedTransfer(): Promise<void> {
    if (transferAmount.value <= 0 || !transferDate.value || isTransferring.value) return;

    isTransferring.value = true;
    try {
        const success = await executeOwnerTransfer({
            sourcePropertyId: 'piyungan',
            targetAccount: 'Shared',
            amount: transferAmount.value,
            date: transferDate.value,
            notes: transferNotes.value.trim() || 'Remaining property payout',
        });
        if (success) {
            closeSharedTransferModal();
        }
    } finally {
        isTransferring.value = false;
    }
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

        <div
            v-if="owner === 'Shared' && propertyProfitTotal > 0"
            class="my-3 rounded-md border border-mist-800 bg-mist-900/90 p-3 shadow-sm">
            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div class="flex items-center gap-2">
                        <span class="text-xs font-semibold text-mist-200">
                            Property Payout Allocation
                        </span>
                        <span
                            class="rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold"
                            :class="
                                remainingPayoutForShared > 0
                                    ? 'border border-amber-400/20 bg-amber-400/10 text-amber-300'
                                    : 'border border-lime-400/20 bg-lime-400/10 text-lime-400'
                            ">
                            {{ remainingPayoutForShared > 0 ? 'Surplus Available' : 'Allocated' }}
                        </span>
                    </div>
                    <p class="mt-1 font-mono text-[11px] text-mist-400">
                        Net Profit:
                        <span class="text-mist-200">{{ formatIDR(propertyProfitTotal) }}</span>
                        &bull; Danh:
                        <span class="text-lime-400">{{ formatIDR(danhTransfersTotal) }}</span>
                        &bull; Citra:
                        <span class="text-sky-300">{{ formatIDR(citraTransfersTotal) }}</span>
                        &bull; Shared:
                        <span class="text-amber-300">{{ formatIDR(sharedTransfersTotal) }}</span>
                    </p>
                </div>

                <div
                    v-if="remainingPayoutForShared > 0"
                    class="flex items-center gap-2">
                    <span class="font-mono text-xs font-semibold text-amber-300">
                        {{ formatIDR(remainingPayoutForShared) }}
                    </span>
                    <AppButton
                        label="Transfer to Shared"
                        color="amber"
                        @click="openSharedTransferModal">
                        <template #icon>
                            <fa-icon icon="money-bill-transfer" />
                        </template>
                    </AppButton>
                </div>
            </div>
        </div>

        <RecurringChecklist
            v-if="showRecurring"
            :owner="owner"
            class="h-full" />

        <div
            v-else
            class="min-h-0 flex-1 overflow-auto rounded-md border border-mist-800 bg-mist-900 shadow-md">
            <div
                v-if="currentList.length === 0"
                class="flex h-full items-center justify-center text-xs">
                No matching ledger entries logged for {{ owner }}.
            </div>
            <table
                v-else
                class="w-full table-fixed border-collapse text-left text-sm text-mist-200">
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
                <tbody class="divide-y divide-mist-800/60">
                    <tr
                        v-for="item in currentList"
                        :key="item.id"
                        class="group hover:bg-mist-800/50">
                        <td class="px-4 py-2.5 font-mono text-xs text-mist-400">
                            {{
                                formatDate(item.date, {
                                    relativeDay: true,
                                    shortMonth: true,
                                    includeYear: true,
                                })
                            }}
                        </td>
                        <td class="px-4 py-2.5 font-medium">
                            {{ item.category }}
                        </td>
                        <td class="truncate px-4 py-2.5 text-mist-400">
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
                        <td class="px-4 py-2.5 text-right font-mono text-xs font-medium">
                            <span
                                :class="
                                    item.type === 'income' ? 'text-emerald-400' : 'text-rose-400'
                                ">
                                {{ item.type === 'income' ? '+' : '-' }}
                            </span>
                            {{ formatIDR(item.amount) }}
                        </td>
                        <td class="h-7 px-2 py-2.5">
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
                </tbody>
            </table>
        </div>

        <PersonalTransactionModal
            v-model="isModalOpen"
            :owner="owner"
            :item-to-edit="editingItem"
            @delete-item="handleDelete"
            @closed="handleCloseModal" />

        <div
            v-if="isTransferModalOpen"
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
            <div
                class="w-full max-w-sm rounded-lg border border-mist-700 bg-mist-900 p-5 shadow-2xl">
                <h3 class="text-sm font-semibold text-mist-100">Transfer Surplus to Shared</h3>
                <p class="mt-1 text-xs text-mist-400">
                    Allocate residual property profit to the Shared Household ledger.
                </p>

                <div class="mt-4 space-y-3">
                    <div>
                        <label class="block text-xs font-medium text-mist-300">Amount (IDR)</label>
                        <input
                            v-model.number="transferAmount"
                            type="number"
                            min="1"
                            required
                            class="mt-1 w-full rounded-md border border-mist-700 bg-mist-800 px-3 py-2 font-mono text-xs text-mist-100 transition outline-none focus:border-amber-400" />
                    </div>

                    <div>
                        <label class="block text-xs font-medium text-mist-300">Transfer Date</label>
                        <input
                            v-model="transferDate"
                            type="date"
                            required
                            class="mt-1 w-full rounded-md border border-mist-700 bg-mist-800 px-3 py-2 text-xs text-mist-100 transition outline-none focus:border-amber-400" />
                    </div>

                    <div>
                        <label class="block text-xs font-medium text-mist-300">Notes</label>
                        <input
                            v-model="transferNotes"
                            type="text"
                            placeholder="Remaining property net profit allocation"
                            class="mt-1 w-full rounded-md border border-mist-700 bg-mist-800 px-3 py-2 text-xs text-mist-100 transition outline-none focus:border-amber-400" />
                    </div>
                </div>

                <div class="mt-4 flex justify-end gap-2">
                    <AppButton
                        label="Cancel"
                        variant="text"
                        :disabled="isTransferring"
                        @click="closeSharedTransferModal" />
                    <button
                        type="button"
                        :disabled="transferAmount <= 0 || !transferDate || isTransferring"
                        class="cursor-pointer rounded-md bg-amber-400 px-3 py-1.5 text-xs font-semibold text-mist-950 transition hover:bg-amber-300 disabled:opacity-50"
                        @click="handleConfirmSharedTransfer">
                        {{ isTransferring ? 'Transferring...' : 'Confirm Transfer' }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
