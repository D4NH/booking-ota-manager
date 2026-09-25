<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { formatIDR } from '@/utils/money';

import CardTitle from '@/components/CardTitle.vue';

const financeStore = useFinanceStore();
const {
    filteredPropertyFinances,
    monthlyPropertyRevenue,
    monthlyPropertyExpenses,
    netPropertyProfit,
    selectedMonth,
} = storeToRefs(financeStore);

// 1. Group & Aggregate Operational Expenses by Category
interface CategoryBreakdown {
    category: string;
    amount: number;
    pct: number;
    color: string;
}

const PALETTE = [
    '#F43F5E', // Rose (Electricity)
    '#38BDF8', // Sky (Biznet / Wi-Fi)
    '#F59E0B', // Amber (Maintenance)
    '#A855F7', // Purple (Cleaning)
    '#64748B', // Slate (General / Overhead)
];

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

// Margin Metrics
const operatingMarginPct = computed<number>(() => {
    const rev = monthlyPropertyRevenue.value;
    if (rev <= 0) return 0;
    return Math.round((netPropertyProfit.value / rev) * 100);
});
</script>

<template>
    <div class="flex flex-col min-h-0">
        <CardTitle>
            <template #title>Property Financial Breakdown</template>
            <template #subtitle>
                Operational cost allocation & cash retention for cycle {{ selectedMonth }}
            </template>
        </CardTitle>

        <div class="h-full border border-mist-800 p-4 rounded-md flex flex-col justify-between">
            <!-- Cash Flow Waterfall Progression -->
            <div>
                <span class="text-xs font-semibold text-mist-200 uppercase tracking-wider block">
                    Revenue Allocation Progression
                </span>
                <div class="grid grid-cols-3 text-xs font-mono space-x-4 divide-x divide-mist-800">
                    <div class="bg-mist-900 pt-2.5 space-y-1">
                        <span class="text-mist-400 block">Operating Margin</span>
                        <span class="font-semibold text-mist-300 font-mono">
                            {{ operatingMarginPct }}%
                        </span>
                    </div>
                </div>
            </div>
            <!-- Category Ranked Progress List -->
            <div>
                <div class="flex flex-col justify-between">
                    <span class="text-xs font-semibold text-mist-300 block mb-2">
                        Expense Share per Category
                    </span>

                    <div class="text-xs">
                        <div
                            v-for="item in categoryExpenses"
                            :key="item.category"
                            class="-mx-2 mb-1.5 px-2 pb-2 pt-0.5 hover:bg-mist-800/40 rounded-md transition cursor-pointer">
                            <div class="flex justify-between items-center">
                                <span
                                    class="capitalize font-medium text-mist-200 py-0.5 flex items-center gap-2">
                                    <span
                                        class="w-2 h-2 rounded-full"
                                        :style="{ backgroundColor: item.color }"></span>
                                    {{ item.category }}
                                </span>
                                <div class="flex items-center gap-2 font-mono">
                                    <span class="text-mist-400">{{ formatIDR(item.amount) }}</span>
                                    <span class="font-semibold text-mist-200 min-w-8 text-right">
                                        {{ item.pct }}%
                                    </span>
                                </div>
                            </div>

                            <!-- Track Bar -->
                            <div
                                class="w-full bg-mist-950/50 h-1.5 rounded-full overflow-hidden mt-2 space-y-2">
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
                            class="py-6 text-center text-mist-400 text-xs">
                            No operational expense entries recorded for this cycle.
                        </div>
                    </div>
                </div>
            </div>
            <!-- Footer Footnote -->
            <div
                class="pt-3 mt-4 border-t border-mist-800/70 flex justify-between text-xs text-mist-400">
                <span>* Excludes Owner Payout Outflows</span>
                <div class="flex items-center gap-2">
                    <span> Total Expenses: </span>
                    <span class="font-mono text-mist-300 font-semibold">
                        {{ formatIDR(monthlyPropertyExpenses) }}
                    </span>
                </div>
            </div>
        </div>
    </div>
</template>
