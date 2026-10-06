<script setup lang="ts">
import { ref, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useFinanceSync } from '@/composables/useFinanceSync';
import type { ProjectedRecurringItem, PersonalOwner } from '@/types/finance';
import { formatDate } from '@/utils/date';
import { formatIDR } from '@/utils/money';
import CardTitle from '@/components/CardTitle.vue';

interface Props {
    owner?: PersonalOwner | 'Shared';
}

const { owner = 'Danh Nguyen' } = defineProps<Props>();

const financeStore = useFinanceStore();
const { settleRecurringCommitment } = useFinanceSync();
const { monthlyProjectedIncome, monthlyProjectedExpenses, isLoading, selectedMonth } =
    storeToRefs(financeStore);

const showSettled = ref<boolean>(false);

const baseList = computed<ProjectedRecurringItem[]>(() => {
    let source: ProjectedRecurringItem[] = [];
    source = [...monthlyProjectedIncome.value, ...monthlyProjectedExpenses.value];

    return source.filter((item) => matchesOwner(item));
});
const visibleList = computed<ProjectedRecurringItem[]>(() => {
    if (showSettled.value) return baseList.value;
    return baseList.value.filter((item) => !item.isSettled);
});
const totalPendingCount = computed<number>(
    () => baseList.value.filter((item) => !item.isSettled).length
);
const totalSettledCount = computed<number>(
    () => baseList.value.filter((item) => item.isSettled).length
);

function matchesOwner(item: ProjectedRecurringItem): boolean {
    if (owner === 'Shared') return item.targetLedger === 'Shared';
    return item.targetLedger === 'Personal' && item.owner === owner;
}
async function handleSettle(item: ProjectedRecurringItem): Promise<void> {
    await settleRecurringCommitment(item);
}
</script>

<template>
    <div class="flex min-h-0 flex-1 flex-col overflow-auto">
        <div class="-mt-5 flex justify-between">
            <CardTitle>
                <template #title>
                    Recurring Commitments & Inflows
                    <span
                        class="rounded px-2 py-0.5 font-mono text-[10px] font-semibold"
                        :class="
                            totalPendingCount > 0
                                ? 'border border-amber-400/20 bg-amber-400/10 text-amber-300'
                                : 'border border-lime-400/20 bg-lime-400/10 text-lime-400'
                        ">
                        {{ totalPendingCount }} Action Required
                    </span>
                </template>
                <template #subtitle>
                    <p class="mt-0.5 text-xs text-mist-400">
                        Unbilled obligations and expected receipts for {{ owner }} in
                        {{ formatDate(selectedMonth, { monthHeader: true }) }}
                    </p>
                </template>
            </CardTitle>
            <button
                v-if="totalSettledCount > 0"
                type="button"
                class="flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-mist-400 transition hover:text-mist-200"
                @click="showSettled = !showSettled">
                <span
                    class="h-2 w-2 rounded-full"
                    :class="showSettled ? 'bg-lime-400' : 'bg-mist-700'" />
                {{ showSettled ? 'Hide Settled' : `Show ${totalSettledCount} Settled` }}
            </button>
        </div>

        <div
            class="flex h-full flex-1 flex-col rounded-md border border-mist-800 bg-mist-900 shadow-md">
            <div class="flex flex-col divide-y divide-mist-800/60">
                <div
                    v-for="item in visibleList"
                    :key="item.id"
                    class="group flex grow items-center justify-between px-3 py-3 transition hover:bg-mist-800/40">
                    <div class="flex min-w-0 items-center gap-3">
                        <div
                            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mist-800 text-xs font-semibold text-mist-300">
                            {{
                                item.owner ? item.owner.split(' ')[0]?.charAt(0).toUpperCase() : 'S'
                            }}
                        </div>
                        <div class="truncate">
                            <div class="flex items-center gap-2">
                                <span
                                    class="truncate text-sm font-semibold text-mist-100 transition group-hover:text-lime-400">
                                    {{ item.category }}
                                </span>
                                <span
                                    v-if="item.notes && item.notes !== 'Savings'"
                                    class="truncate text-sm text-mist-300 transition group-hover:text-mist-100">
                                    {{ item.notes }}
                                </span>
                                <span
                                    v-if="item.frequency === 'yearly'"
                                    class="rounded border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-amber-300 uppercase">
                                    Annual
                                </span>
                                <span
                                    class="rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase"
                                    :class="
                                        item.type === 'income'
                                            ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                                            : 'border border-rose-500/20 bg-rose-500/10 text-rose-400'
                                    ">
                                    {{ item.type === 'income' ? 'Inflow' : 'Bill' }}
                                </span>
                            </div>
                            <div
                                class="mt-1 flex items-center gap-1 font-mono text-[11px] text-mist-400">
                                <span
                                    class="rounded border border-mist-800 bg-mist-800 px-1.5 py-0.5 text-mist-300">
                                    {{ item.targetLedger }}
                                </span>
                                <span v-if="item.owner">
                                    &bull; {{ item.owner.split(' ')[0] }}
                                </span>
                                <span
                                    v-if="item.dueDate"
                                    class="text-mist-500">
                                    &bull; Due {{ item.dueDate.slice(8, 10) }}th
                                </span>
                            </div>
                        </div>
                    </div>

                    <div class="shrink-0 text-right">
                        <span class="block font-mono text-xs font-semibold text-mist-100">
                            {{ item.type === 'income' ? '+' : '-' }}{{ formatIDR(item.amount) }}
                        </span>
                        <span
                            v-if="item.isSettled"
                            class="font-mono text-xs font-semibold text-lime-400">
                            ✓ Settled
                        </span>
                        <button
                            v-else
                            type="button"
                            :disabled="isLoading"
                            class="cursor-pointer text-xs font-semibold transition disabled:opacity-50"
                            :class="
                                item.type === 'income'
                                    ? 'text-emerald-400 hover:text-emerald-300'
                                    : 'text-rose-400 hover:text-rose-300'
                            "
                            @click="handleSettle(item)">
                            {{ item.type === 'income' ? 'Collect' : 'Pay' }}
                        </button>
                    </div>
                </div>
            </div>

            <div
                v-if="visibleList.length === 0"
                class="rounded-md border border-mist-800 bg-mist-800/40 py-8 text-center">
                <p class="mb-1 text-xs font-semibold text-lime-400">
                    {{
                        totalSettledCount > 0 && !showSettled
                            ? `All recurring items for ${owner} are settled.`
                            : `No recurring obligations found for ${owner}.`
                    }}
                </p>
                <p class="text-[11px] text-mist-400">
                    {{
                        totalSettledCount > 0 && !showSettled
                            ? 'Click "Show Settled" to inspect posted entries.'
                            : 'Add active templates in the Recurring_Templates sheet.'
                    }}
                </p>
            </div>
        </div>
    </div>
</template>
