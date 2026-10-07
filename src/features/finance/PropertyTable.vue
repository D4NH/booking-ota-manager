<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useFinanceSync } from '@/composables/useFinanceSync';
import { getPropertyStyle } from '@/config/properties';
import { useFinanceStore } from '@/stores/useFinanceStore';
import type { PropertyFinance } from '@/types/finance';
import type { PropertyId } from '@/types/property';
import { formatDate } from '@/utils/date';
import { formatIDR } from '@/utils/money';

import AppButton from '@/components/ui/AppButton.vue';
import SelectDropdown from '@/components/ui/SelectDropdown.vue';
import CardTitle from '@/components/CardTitle.vue';
import TransactionNote from '@/components/TransactionNote.vue';
import TransferModal from '@/features/finance/TransferModal.vue';
import PropertyTransactionModal from '@/features/finance/PropertyTransactionModal.vue';

interface Props {
    propertyId?: PropertyId | 'all';
}

const categoryOptions = [
    'All categories',
    'Cleaning',
    'Guest Amenities & Toiletries',
    'Food & Beverages',
    'Linens & Soft Goods',
    'Utilities',
    'Connectivity & Media',
    'Garbage Disposal',
    'Property Maintenance',
    'Payout',
    'Furniture',
    'Taxes, Permits & Insurance',
];

const { propertyId = 'piyungan' } = defineProps<Props>();

const financeStore = useFinanceStore();
const { removePropertyTransaction } = useFinanceSync();
const { filteredPropertyFinances } = storeToRefs(financeStore);

const isModalOpen = ref<boolean>(false);
const isTransferModalOpen = ref<boolean>(false);
const filterCategory = ref<string>('All categories');
const editingItem = ref<PropertyFinance | null>(null);
const currentPage = ref<number>(1);
const pageSize = ref<number>(10);

const scopedPropertyFinances = computed<PropertyFinance[]>(() => {
    const list = filteredPropertyFinances.value || [];
    if (propertyId === 'all') return list;
    return list.filter((item) => item.propertyId === propertyId);
});
const displayedTransactions = computed<PropertyFinance[]>(() => {
    if (filterCategory.value === 'All categories') return scopedPropertyFinances.value;
    return scopedPropertyFinances.value.filter((i) => i.category === filterCategory.value);
});
const totalItems = computed<number>(() => displayedTransactions.value.length);
const totalPages = computed<number>(() => Math.ceil(totalItems.value / pageSize.value) || 1);
const paginatedTransactions = computed<PropertyFinance[]>(() => {
    const start = (currentPage.value - 1) * pageSize.value;
    return displayedTransactions.value.slice(start, start + pageSize.value);
});
const startItemIndex = computed<number>(() => {
    if (totalItems.value === 0) return 0;
    return (currentPage.value - 1) * pageSize.value + 1;
});
const endItemIndex = computed<number>(() =>
    Math.min(currentPage.value * pageSize.value, totalItems.value)
);

watch(
    [filterCategory, pageSize, () => scopedPropertyFinances.value.length, () => propertyId],
    () => {
        currentPage.value = 1;
    }
);

function goToPage(page: number): void {
    if (page >= 1 && page <= totalPages.value) {
        currentPage.value = page;
    }
}
function openAddModal(): void {
    editingItem.value = null;
    isModalOpen.value = true;
}
function openEditModal(item: PropertyFinance): void {
    if (item.id.startsWith('dexie-')) return;
    editingItem.value = item;
    isModalOpen.value = true;
}
function openTransferModal(): void {
    isTransferModalOpen.value = true;
}
function handleCloseModal(): void {
    editingItem.value = null;
}
</script>

<template>
    <div class="min-h-0 overflow-auto">
        <div class="flex items-center justify-between">
            <CardTitle>
                <template #title>Transaction Overview</template>
                <template #subtitle>
                    Bookings auto populated from DexieDB and operational expenses
                </template>
            </CardTitle>
            <div class="flex items-center gap-2">
                <SelectDropdown
                    v-model="filterCategory"
                    input-label=""
                    class="w-60"
                    :options="categoryOptions" />
                <AppButton
                    label="Add Entry"
                    @click="openAddModal">
                    <template #icon>
                        <fa-icon icon="plus" />
                    </template>
                </AppButton>
                <AppButton
                    label="Transfer Funds"
                    @click="openTransferModal">
                    <template #icon>
                        <fa-icon icon="arrow-right-arrow-left" />
                    </template>
                </AppButton>
            </div>
        </div>

        <div class="flex-1 rounded-md border border-mist-800 bg-mist-900 shadow-md">
            <table class="w-full table-fixed border-collapse text-left text-sm text-mist-300">
                <thead
                    class="border-b border-mist-800 bg-mist-950/40 text-xs font-bold text-mist-400 uppercase">
                    <tr class="h-12">
                        <th class="w-30 px-4 py-0 align-middle">Date</th>
                        <th class="w-30 px-4 py-0 align-middle">Property</th>
                        <th class="w-52 px-4 py-0 align-middle">Category</th>
                        <th class="w-auto px-4 py-0 align-middle">Source</th>
                        <th class="w-40 px-4 py-0 text-right align-middle">Amount</th>
                        <th class="w-28 px-4 py-0 text-right align-middle">Actions</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-mist-800/60">
                    <tr
                        v-for="item in paginatedTransactions"
                        :key="item.id"
                        class="h-12 hover:bg-mist-800/40">
                        <td class="px-4 py-0 align-middle font-mono text-xs text-mist-400">
                            {{
                                formatDate(item.date, {
                                    relativeDay: true,
                                    shortMonth: true,
                                    includeYear: true,
                                })
                            }}
                        </td>
                        <td class="h-10 px-4 py-0 align-middle">
                            <div class="flex h-full items-center">
                                <RouterLink
                                    :to="{
                                        name: 'property-detail',
                                        params: { id: item.propertyId },
                                    }"
                                    class="inline-flex items-center"
                                    :class="getPropertyStyle(item.propertyId)">
                                    {{ item.propertyId }}
                                </RouterLink>
                            </div>
                        </td>
                        <td class="truncate px-4 py-0 align-middle font-medium">
                            {{ item.category }}
                        </td>
                        <td class="truncate px-4 py-0 align-middle text-mist-400">
                            <div class="flex items-center gap-1.5">
                                <span
                                    v-if="item.id.startsWith('dexie-')"
                                    class="shrink-0 rounded-xs bg-lime-400/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-lime-400">
                                    DEXIE
                                </span>
                                <TransactionNote :notes="item.notes" />
                            </div>
                        </td>
                        <td class="px-4 py-0 text-right align-middle font-mono font-medium">
                            <div class="group relative inline-flex items-center justify-end">
                                <span
                                    class="pr-1 text-xs"
                                    :class="
                                        item.type === 'income'
                                            ? 'text-emerald-400'
                                            : 'text-rose-400'
                                    ">
                                    {{ item.type === 'expense' ? '-' : '+' }}
                                </span>
                                <span class="text-xs">
                                    {{ formatIDR(item.amount) }}
                                </span>

                                <div
                                    v-if="item.category === 'Property Payout'"
                                    class="pointer-events-none absolute top-1/2 right-full z-30 mr-2 w-48 -translate-y-1/2 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100">
                                    <div
                                        class="rounded-md border border-mist-800 bg-mist-900 p-2.5 text-xs text-mist-100 shadow-xl">
                                        <div class="flex items-center justify-between font-mono">
                                            <span class="font-medium text-mist-400">
                                                Payout 15%
                                            </span>
                                            <span class="font-semibold text-mist-200">
                                                {{ formatIDR(item.amount * 0.15) }}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </td>
                        <td class="px-4 py-0 align-middle">
                            <div
                                v-if="!item.id.startsWith('dexie')"
                                class="flex items-center justify-end">
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
                                    @click="removePropertyTransaction(item.id, item.category)">
                                    <template #icon>
                                        <fa-icon icon="trash-can" />
                                    </template>
                                </AppButton>
                            </div>
                        </td>
                    </tr>
                    <tr v-if="displayedTransactions.length === 0">
                        <td
                            colspan="6"
                            class="py-24 text-center text-mist-400">
                            <div class="flex items-center justify-center">
                                <fa-icon
                                    icon="calendar-days"
                                    class="text-xl text-mist-700" />
                                <span class="ml-2 font-medium text-mist-400">
                                    No records for this unit and month cycle
                                </span>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div
            v-if="totalItems > 0"
            class="mt-4 flex flex-col items-center justify-between gap-3 text-xs text-mist-400 sm:flex-row">
            <div class="flex items-center gap-3">
                <span>
                    Showing
                    <strong class="font-mono text-mist-200">{{ startItemIndex }}</strong>
                    to
                    <strong class="font-mono text-mist-200">{{ endItemIndex }}</strong>
                    of
                    <strong class="font-mono text-mist-200">{{ totalItems }}</strong>
                    records
                </span>

                <div class="flex items-center gap-1.5">
                    <label for="page-size">Per page:</label>
                    <select
                        id="page-size"
                        v-model="pageSize"
                        class="rounded-md border border-mist-800 bg-mist-950/50 py-0.5 pr-1.5 pl-1 font-mono text-xs text-mist-200 transition-colors hover:border-mist-700 focus:border-lime-500 focus:outline-hidden">
                        <option
                            v-for="opt in [5, 10, 20, 50]"
                            :key="opt"
                            :value="opt">
                            {{ opt }}
                        </option>
                    </select>
                </div>
            </div>

            <div class="flex items-center gap-1">
                <button
                    type="button"
                    :disabled="currentPage <= 1"
                    class="cursor-pointer rounded-md border border-mist-800 bg-mist-800 pt-0.5 pr-3 pb-1 pl-2 text-xs text-mist-300 shadow-sm transition-colors hover:border-mist-700 disabled:cursor-default disabled:border-0 disabled:opacity-40"
                    @click="goToPage(currentPage - 1)">
                    <fa-icon
                        class="text-[10px]"
                        icon="chevron-left" />
                    Prev
                </button>

                <span class="px-3 py-1 text-mist-300">
                    Page <strong class="font-mono text-lime-400">{{ currentPage }}</strong> of
                    <strong class="font-mono">{{ totalPages }}</strong>
                </span>

                <button
                    type="button"
                    :disabled="currentPage >= totalPages"
                    class="cursor-pointer rounded-md border border-mist-800 bg-mist-800 pt-0.5 pr-2 pb-1 pl-3 text-xs text-mist-300 shadow-sm transition-colors hover:border-mist-700 disabled:cursor-default disabled:border-0 disabled:opacity-40"
                    @click="goToPage(currentPage + 1)">
                    Next
                    <fa-icon
                        class="text-[10px]"
                        icon="chevron-right" />
                </button>
            </div>
        </div>

        <PropertyTransactionModal
            v-model="isModalOpen"
            :default-property-id="propertyId"
            :item-to-edit="editingItem"
            @closed="handleCloseModal" />

        <TransferModal v-model="isTransferModalOpen" />
    </div>
</template>
