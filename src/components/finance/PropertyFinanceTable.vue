<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useFinanceSync } from '@/composables/useFinanceSync';
import { getPropertyStyle } from '@/config/properties';
import { useFinanceStore } from '@/stores/useFinanceStore';
import type { PropertyFinanceType, PropertyCategory } from '@/types/finance';
import { formatIDR } from '@/utils/money';

import CardTitle from '@/components/CardTitle.vue';
import TransactionNote from '@/components/finance/TransactionNote.vue';

const financeStore = useFinanceStore();
const { addPropertyTransaction, persistDexieBookings } = useFinanceSync();
const { filteredPropertyFinances, isLoading } = storeToRefs(financeStore);

const isModalOpen = ref(false);
const filterCategory = ref<string>('ALL');

const currentPage = ref(1);
const pageSize = ref(10);
const pageSizeOptions = [5, 10, 20, 50];

const formPropertyId = ref('piyungan');
const formType = ref<PropertyFinanceType>('income');
const formCategory = ref<PropertyCategory>('Payout');
const formAmount = ref<number | null>(null);
const formDate = ref(new Date().toISOString().slice(0, 10));
const formNotes = ref('');

const categories = ['Payout', 'Cleaning', 'Maintenance', 'Electricity', 'Internet'];

const displayedTransactions = computed(() => {
    if (filterCategory.value === 'ALL') return filteredPropertyFinances.value;
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

const endItemIndex = computed(() => {
    return Math.min(currentPage.value * pageSize.value, totalItems.value);
});

watch([filterCategory, pageSize, () => filteredPropertyFinances.value.length], () => {
    currentPage.value = 1;
});

function goToPage(page: number): void {
    if (page >= 1 && page <= totalPages.value) {
        currentPage.value = page;
    }
}

async function submitTransaction(): Promise<void> {
    if (!formAmount.value || !formDate.value) return;
    const success = await addPropertyTransaction({
        propertyId: formPropertyId.value,
        type: formType.value,
        category: formCategory.value,
        amount: formAmount.value,
        date: formDate.value,
        notes: formNotes.value,
    });
    if (success) {
        isModalOpen.value = false;
        formAmount.value = null;
        formNotes.value = '';
    }
}

async function handleSyncDexieToSheet(): Promise<void> {
    await persistDexieBookings();
}
</script>

<template>
    <div class="flex flex-col">
        <div class="flex items-center justify-between">
            <CardTitle>
                <template #title>Property Wallet</template>
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
                    :disabled="isLoading"
                    title="Commit Dexie bookings to Google Sheets Property_Finances tab"
                    class="bg-mist-800 hover:bg-mist-700 text-mist-200 border border-mist-700 text-xs font-semibold px-3 py-1.5 rounded-md transition disabled:opacity-50"
                    @click="handleSyncDexieToSheet">
                    Persist Bookings
                </button>
                <button
                    class="bg-lime-400 hover:bg-lime-300 text-mist-950 text-xs font-bold px-3 py-1.5 rounded-md transition shadow-sm"
                    @click="isModalOpen = true">
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
                        <th class="w-55 py-3 px-3">Category</th>
                        <th class="py-3 px-3">Source</th>
                        <th class="py-3 px-3 text-right">Amount</th>
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
                    </tr>
                    <tr v-if="displayedTransactions.length === 0">
                        <td
                            colspan="5"
                            class="py-6 text-center text-mist-400 font-sans">
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
                <span class="font-sans">
                    Showing
                    <strong class="text-mist-200 font-mono">{{ startItemIndex }}</strong>
                    to
                    <strong class="text-mist-200 font-mono">{{ endItemIndex }}</strong>
                    of
                    <strong class="text-mist-200 font-mono">{{ totalItems }}</strong>
                    records
                </span>

                <div class="flex items-center gap-1.5 font-sans">
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
                    class="px-2.5 py-1 rounded-md bg-mist-850 border border-mist-700 text-mist-200 hover:bg-mist-800 disabled:opacity-40 disabled:hover:bg-mist-850 transition"
                    @click="goToPage(currentPage - 1)">
                    ‹ Prev
                </button>

                <span class="px-3 py-1 font-sans text-mist-300">
                    Page <strong class="text-lime-400 font-mono">{{ currentPage }}</strong> of
                    <strong class="font-mono">{{ totalPages }}</strong>
                </span>

                <button
                    :disabled="currentPage >= totalPages"
                    class="px-2.5 py-1 rounded-md bg-mist-850 border border-mist-700 text-mist-200 hover:bg-mist-800 disabled:opacity-40 disabled:hover:bg-mist-850 transition"
                    @click="goToPage(currentPage + 1)">
                    Next ›
                </button>
            </div>
        </div>

        <!-- Manual Expense/Income Modal -->
        <div
            v-if="isModalOpen"
            class="fixed inset-0 z-50 bg-mist-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div
                class="bg-mist-900 border border-mist-800 rounded-md shadow-2xl w-full max-w-md p-6">
                <h4 class="font-bold text-mist-100 text-sm mb-4">Add Property Record</h4>
                <form
                    class="space-y-4"
                    @submit.prevent="submitTransaction">
                    <div>
                        <label class="text-xs font-semibold text-mist-400 block mb-1"
                            >Transaction Nature</label
                        >
                        <select
                            v-model="formType"
                            class="w-full text-xs border border-mist-700 bg-mist-850 text-mist-100 rounded-md p-2.5">
                            <option value="expense">Expense</option>
                            <option value="income">Income</option>
                        </select>
                    </div>
                    <div>
                        <label class="text-xs font-semibold text-mist-400 block mb-1"
                            >Category</label
                        >
                        <select
                            v-model="formCategory"
                            class="w-full text-xs border border-mist-700 bg-mist-850 text-mist-100 rounded-md p-2.5">
                            <option
                                v-for="cat in categories"
                                :key="cat"
                                :value="cat">
                                {{ cat }}
                            </option>
                        </select>
                    </div>
                    <div>
                        <label class="text-xs font-semibold text-mist-400 block mb-1"
                            >Amount (IDR)</label
                        >
                        <input
                            v-model="formAmount"
                            type="number"
                            required
                            class="w-full text-xs border border-mist-700 bg-mist-850 text-mist-100 rounded-md p-2.5 font-mono" />
                    </div>
                    <div>
                        <label class="text-xs font-semibold text-mist-400 block mb-1">Date</label>
                        <input
                            v-model="formDate"
                            type="date"
                            required
                            class="w-full text-xs border border-mist-700 bg-mist-850 text-mist-100 rounded-md p-2.5 font-mono" />
                    </div>
                    <div>
                        <label class="text-xs font-semibold text-mist-400 block mb-1">Notes</label>
                        <input
                            v-model="formNotes"
                            type="text"
                            class="w-full text-xs border border-mist-700 bg-mist-850 text-mist-100 rounded-md p-2.5" />
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
                            Commit
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</template>
