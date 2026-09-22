<script setup lang="ts">
import { ref, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useFinanceSync } from '@/composables/useFinanceSync';
import type { ProjectedRecurringItem } from '@/types/finance';
import { formatDate } from '@/utils/date';
import { formatIDR } from '@/utils/money';

import CardTitle from '@/components/CardTitle.vue';

const financeStore = useFinanceStore();
const { settleRecurringCommitment } = useFinanceSync();
const { monthlyProjectedIncome, monthlyProjectedExpenses, isLoading, selectedMonth } =
    storeToRefs(financeStore);

const activeSectionTab = ref<'all' | 'income' | 'expenses'>('all');
const showSettled = ref(false);

const baseList = computed<ProjectedRecurringItem[]>(() => {
    if (activeSectionTab.value === 'income') return monthlyProjectedIncome.value;
    if (activeSectionTab.value === 'expenses') return monthlyProjectedExpenses.value;
    return [...monthlyProjectedIncome.value, ...monthlyProjectedExpenses.value];
});
const visibleList = computed<ProjectedRecurringItem[]>(() => {
    if (showSettled.value) return baseList.value;
    return baseList.value.filter((item) => !item.isSettled);
});
const totalPendingCount = computed(() => baseList.value.filter((i) => !i.isSettled).length);
const totalSettledCount = computed(() => baseList.value.filter((i) => i.isSettled).length);

const handleSettle = async (item: ProjectedRecurringItem): Promise<void> => {
    await settleRecurringCommitment(item);
};
</script>

<template>
    <div class="flex flex-col">
        <div class="flex justify-between">
            <CardTitle>
                <template #title>
                    Recurring Cash Flow & Inflows
                    <span
                        class="text-[10px] font-mono px-2 py-0.5 rounded font-semibold"
                        :class="
                            totalPendingCount > 0
                                ? 'bg-amber-400/10 text-amber-300 border border-amber-400/20'
                                : 'bg-lime-400/10 text-lime-400 border border-lime-400/20'
                        ">
                        {{ totalPendingCount }} Action Required
                    </span>
                </template>
                <template #subtitle>
                    <p class="text-xs text-mist-400 mt-0.5">
                        Unbilled commitments and uncollected returns for
                        {{ formatDate(selectedMonth, { monthHeader: true }) }}
                    </p>
                </template>
            </CardTitle>
            <button
                v-if="totalSettledCount > 0"
                type="button"
                class="text-[11px] font-semibold text-mist-400 hover:text-mist-200 transition flex items-center gap-1.5"
                @click="showSettled = !showSettled">
                <span
                    class="w-2 h-2 rounded-full"
                    :class="showSettled ? 'bg-lime-400' : 'bg-mist-700'"></span>
                {{ showSettled ? 'Hide Settled' : `Show ${totalSettledCount} Settled` }}
            </button>
        </div>

        <!-- Filter Subtabs & Settled Toggle -->
        <div class="flex flex-col rounded-md border border-mist-800 bg-mist-900 shadow-md mb-4">
            <div class="flex flex-col divide-y divide-mist-800/60">
                <div
                    v-for="item in visibleList"
                    :key="item.id"
                    class="flex grow items-center justify-between px-3 py-3 hover:bg-mist-800/40 transition group">
                    <div class="min-w-0 flex items-center gap-3">
                        <div
                            class="h-8 w-8 rounded-full bg-mist-800 flex items-center justify-center text-xs font-semibold text-mist-300 shrink-0">
                            {{
                                item.owner ? item.owner.split(' ')[0]?.charAt(0).toUpperCase() : 'S'
                            }}
                        </div>
                        <div class="truncate">
                            <div class="flex items-center gap-2">
                                <span
                                    class="font-semibold text-sm text-mist-100 truncate group-hover:text-lime-400 transition gap-1">
                                    <!-- {{ item.notes || item.category }} -->
                                    {{ item.category }}
                                </span>
                                <span
                                    v-if="item.notes !== 'Savings'"
                                    class="text-sm text-mist-100 truncate group-hover:text-lime-400 transition gap-1">
                                    <!-- {{ item.notes || item.category }} -->
                                    {{ item.notes }}
                                </span>
                                <span
                                    v-if="item.frequency === 'yearly'"
                                    class="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold uppercase bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                    Annual
                                </span>
                                <span
                                    class="text-[11px] px-1.5 py-0.2 rounded font-mono font-semibold uppercase"
                                    :class="
                                        item.type === 'income'
                                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                    ">
                                    {{ item.type === 'income' ? 'Inflow' : 'Bill' }}
                                </span>
                            </div>
                            <div class="flex items-center gap-1 mt-1">
                                <span
                                    class="text-[11px] px-1.5 py-0.2 rounded font-mono font-medium text-mist-300 bg-mist-800 border border-mist-800">
                                    {{ item.targetLedger }}
                                </span>
                                <span
                                    v-if="item.owner"
                                    class="text-[11px] text-mist-400">
                                    &bull; {{ item.owner.split(' ')[0] }}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div class="text-right shrink-0">
                        <span class="font-mono text-xs font-semibold text-mist-100 block">
                            {{ item.type === 'income' ? '+' : '-' }}{{ formatIDR(item.amount) }}
                        </span>
                        <span
                            v-if="item.isSettled"
                            class="text-xs font-semibold text-lime-400 font-mono">
                            ✓ Settled
                        </span>
                        <span
                            v-else
                            :disabled="isLoading"
                            class="cursor-pointer text-xs font-semibold transition shadow-sm disabled:opacity-50"
                            :class="
                                item.type === 'income'
                                    ? 'text-emerald-400 hover:text-emerald-300'
                                    : 'text-rose-400 hover:text-rose-300'
                            "
                            @click="handleSettle(item)">
                            {{ item.type === 'income' ? 'Collect' : 'Pay' }}
                        </span>
                    </div>
                </div>
            </div>

            <!-- Pending Items Grid -->
            <!-- <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <div
                    v-for="item in visibleList"
                    :key="item.id"
                    class="p-3.5 rounded-md border border-mist-800 bg-mist-850 transition flex items-center justify-between">
                    <div class="pr-2 min-w-0">
                        <div class="flex items-center gap-1.5 mb-1 flex-wrap">
                            <span
                                class="text-[9px] px-1.5 py-0.2 rounded font-mono font-semibold uppercase"
                                :class="
                                    item.type === 'income'
                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                ">
                                {{ item.type === 'income' ? 'Inflow' : 'Bill' }}
                            </span>
                            <span
                                class="text-[9px] px-1.5 py-0.2 rounded font-mono font-medium text-mist-300 bg-mist-800 border border-mist-800">
                                {{ item.targetLedger }}
                            </span>
                            <span
                                v-if="item.owner"
                                class="text-mist-300 mr-1">
                                &bull; {{ item.owner.split(' ')[0] }}
                            </span>
                        </div>
                        <span
                            class="text-xs font-semibold text-mist-100 truncate max-w-[130px]"
                            :title="item.notes || item.category">
                            {{ item.notes || item.category }}
                        </span>

                        <div class="text-[11px] text-mist-400 font-mono">
                            <strong class="text-mist-100">
                                {{ item.type === 'income' ? '+' : '-' }}{{ formatIDR(item.amount) }}
                            </strong>
                        </div>
                    </div>

                    <div class="shrink-0">
                        <span
                            v-if="item.isSettled"
                            class="text-xs font-semibold text-lime-400 font-mono">
                            ✓ Settled
                        </span>
                        <button
                            v-else
                            :disabled="isLoading"
                            class="text-mist-950 text-xs font-semibold px-3 py-1.5 rounded-md transition shadow-sm disabled:opacity-50"
                            :class="
                                item.type === 'income'
                                    ? 'bg-emerald-400 hover:bg-emerald-300'
                                    : 'bg-lime-400 hover:bg-lime-300'
                            "
                            @click="handleSettle(item)">
                            {{ item.type === 'income' ? 'Collect' : 'Pay' }}
                        </button>
                    </div>
                </div>
            </div> -->

            <!-- All Clear State -->
            <div
                v-if="visibleList.length === 0"
                class="py-8 text-center bg-mist-850/40 rounded-md border border-mist-800">
                <p class="text-xs font-semibold text-lime-400 mb-1">
                    {{
                        totalSettledCount > 0 && !showSettled
                            ? 'All recurring items for this cycle are settled.'
                            : 'No recurring obligations found.'
                    }}
                </p>
                <p class="text-[11px] text-mist-400">
                    {{
                        totalSettledCount > 0 && !showSettled
                            ? 'Click "Show Settled" to inspect posted entries.'
                            : 'Add active templates in the Recurring_Templates tab.'
                    }}
                </p>
            </div>
        </div>
    </div>
</template>
