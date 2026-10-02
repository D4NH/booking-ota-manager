<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { formatIDR } from '@/utils/money';

import CardTitle from '@/components/CardTitle.vue';

const PALETTE = [
    '#F43F5E', // Rose (Electricity)
    '#38BDF8', // Sky (Biznet / Wi-Fi)
    '#F59E0B', // Amber (Maintenance)
    '#A855F7', // Purple (Cleaning)
    '#64748B', // Slate (General / Overhead)
];

interface CategoryBreakdown {
    category: string;
    amount: number;
    pct: number;
    color: string;
}

const financeStore = useFinanceStore();
const {
    filteredPropertyFinances,
    monthlyPropertyRevenue,
    monthlyPropertyExpenses,
    netPropertyProfit,
    selectedMonth,
} = storeToRefs(financeStore);

const categoryExpenses = computed<CategoryBreakdown[]>(() => {
    const total = monthlyPropertyExpenses.value;
    const map = new Map<string, number>();

    const expenses = filteredPropertyFinances.value.filter(
        (i) => i.type === 'expense' && i.category !== 'Owner Payout Outflow'
    );

    for (let i = 0; i < expenses.length; i++) {
        const item = expenses[i];
        if (!item) continue;
        const cat = item.category.trim().toLowerCase();
        const current = map.get(cat) || 0;
        map.set(cat, current + Number(item.amount));
    }

    const result: CategoryBreakdown[] = [];
    let idx = 0;
    map.forEach((amount, category) => {
        const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
        result.push({
            category,
            amount,
            pct,
            color: PALETTE[idx % PALETTE.length] ?? '#A3E635',
        });
        idx++;
    });

    return result.sort((a, b) => b.amount - a.amount);
});
const operatingMarginPct = computed<number>(() => {
    const rev = monthlyPropertyRevenue.value;
    if (rev <= 0) return 0;
    return Math.round((netPropertyProfit.value / rev) * 100);
});
</script>

<template>
    <div class="flex min-h-0 flex-col">
        <CardTitle>
            <template #title>Property Financial Breakdown</template>
            <template #subtitle>
                Operational cost allocation & cash retention for cycle {{ selectedMonth }}
            </template>
        </CardTitle>

        <div class="flex h-full flex-col justify-between rounded-md border border-mist-800 p-4">
            <!-- Cash Flow Waterfall Progression -->
            <div>
                <span class="block text-xs font-semibold tracking-wider text-mist-200 uppercase">
                    Revenue Allocation Progression
                </span>
                <div class="grid grid-cols-3 space-x-4 divide-x divide-mist-800 font-mono text-xs">
                    <div class="space-y-1 bg-mist-900 pt-2.5">
                        <span class="block text-mist-400">Operating Margin</span>
                        <span class="font-mono font-semibold text-mist-300">
                            {{ operatingMarginPct }}%
                        </span>
                    </div>
                </div>
            </div>
            <!-- Category Ranked Progress List -->
            <div>
                <div class="flex flex-col justify-between">
                    <span class="mb-2 block text-xs font-semibold text-mist-300">
                        Expense Share per Category
                    </span>

                    <div class="text-xs">
                        <div
                            v-for="item in categoryExpenses"
                            :key="item.category"
                            class="-mx-2 mb-1.5 cursor-pointer rounded-md px-2 pt-0.5 pb-2 transition hover:bg-mist-800/40">
                            <div class="flex items-center justify-between">
                                <span
                                    class="flex items-center gap-2 py-0.5 font-medium text-mist-200 capitalize">
                                    <span
                                        class="h-2 w-2 rounded-full"
                                        :style="{ backgroundColor: item.color }"></span>
                                    {{ item.category }}
                                </span>
                                <div class="flex items-center gap-2 font-mono">
                                    <span class="text-mist-400">{{ formatIDR(item.amount) }}</span>
                                    <span class="min-w-8 text-right font-semibold text-mist-200">
                                        {{ item.pct }}%
                                    </span>
                                </div>
                            </div>

                            <!-- Track Bar -->
                            <div
                                class="mt-2 h-1.5 w-full space-y-2 overflow-hidden rounded-full bg-mist-950/50">
                                <div
                                    class="h-full rounded-full transition-all duration-500"
                                    :style="{
                                        width: `${item.pct}%`,
                                        backgroundColor: item.color,
                                    }"></div>
                            </div>
                        </div>

                        <div
                            v-if="categoryExpenses.length === 0"
                            class="py-6 text-center text-xs text-mist-400">
                            No operational expense entries recorded for this cycle.
                        </div>
                    </div>
                </div>
            </div>
            <!-- Footer Footnote -->
            <div
                class="mt-4 flex justify-between border-t border-mist-800/70 pt-3 text-xs text-mist-400">
                <span>* Excludes Owner Payout Outflows</span>
                <div class="flex items-center gap-2">
                    <span> Total Expenses: </span>
                    <span class="font-mono font-semibold text-mist-300">
                        {{ formatIDR(monthlyPropertyExpenses) }}
                    </span>
                </div>
            </div>
        </div>
    </div>
</template>
