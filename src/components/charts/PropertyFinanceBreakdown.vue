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
    monthlyOwnerDraws,
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

// 2. SVG Donut Calculations for Expenses (r = 40, C ≈ 251.32)
const circumference = 251.32;

const donutSegments = computed(() => {
    const total = monthlyPropertyExpenses.value || 1;
    let accumulatedOffset = 0;

    return categoryExpenses.value.map((item) => {
        const segmentLen = (item.amount / total) * circumference;
        const strokeDasharray = `${segmentLen} ${circumference - segmentLen}`;
        const strokeDashoffset = -accumulatedOffset;
        accumulatedOffset += segmentLen;

        return {
            ...item,
            strokeDasharray,
            strokeDashoffset,
        };
    });
});

// 3. Margin Metrics
const operatingMarginPct = computed<number>(() => {
    const rev = monthlyPropertyRevenue.value;
    if (rev <= 0) return 0;
    return Math.round((netPropertyProfit.value / rev) * 100);
});

const retainedCash = computed<number>(() => {
    return Math.max(0, netPropertyProfit.value - monthlyOwnerDraws.value);
});
</script>

<template>
    <div class="flex flex-col">
        <CardTitle>
            <template #title>Property Financial Breakdown</template>
            <template #subtitle>
                Operational cost allocation & cash retention for cycle {{ selectedMonth }}
            </template>
        </CardTitle>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <!-- Left Panel: Categorical Donut Chart -->
            <div
                class="bg-mist-850 border border-mist-800 p-5 rounded-md flex flex-col justify-between">
                <span
                    class="text-xs font-semibold text-mist-200 uppercase tracking-wider block mb-2">
                    Expense Breakdown
                </span>

                <div class="flex items-center justify-center gap-4 my-auto">
                    <!-- SVG Donut -->
                    <div class="relative w-50 h-50 flex items-center justify-center shrink-0">
                        <svg
                            class="w-full h-full transform -rotate-90"
                            viewBox="0 0 100 100">
                            <!-- Background Ring -->
                            <circle
                                cx="50"
                                cy="50"
                                r="40"
                                stroke="#1C2731"
                                stroke-width="12"
                                fill="transparent" />

                            <!-- Dynamic Expense Segments -->
                            <circle
                                v-for="seg in donutSegments"
                                :key="seg.category"
                                cx="50"
                                cy="50"
                                r="40"
                                :stroke="seg.color"
                                stroke-width="12"
                                fill="transparent"
                                :stroke-dasharray="seg.strokeDasharray"
                                :stroke-dashoffset="seg.strokeDashoffset"
                                stroke-linecap="butt"
                                class="transition-all duration-500" />
                        </svg>

                        <!-- Center Label -->
                        <div
                            class="absolute inset-0 flex flex-col items-center justify-center font-mono">
                            <span class="text-xs text-mist-400">Total Exp</span>
                            <span class="text-sm font-black text-mist-200">
                                {{ formatIDR(monthlyPropertyExpenses) }}
                            </span>
                        </div>
                    </div>

                    <!-- Donut Legend List -->
                    <div class="space-y-1.5 text-xs font-mono">
                        <div
                            v-for="item in categoryExpenses.slice(0, 4)"
                            :key="item.category"
                            class="flex items-center gap-2">
                            <span
                                class="w-2.5 h-2.5 rounded-full shrink-0"
                                :style="{ backgroundColor: item.color }"></span>
                            <div>
                                <span
                                    class="capitalize text-mist-300 block text-xs truncate"
                                    :title="item.category">
                                    {{ item.category }}
                                </span>
                                <strong class="text-mist-100 text-xs">{{ item.pct }}%</strong>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="text-xs text-mist-400 text-center mt-3 pt-2 border-t border-mist-800">
                    {{ categoryExpenses.length }} active operating expense categories logged
                </div>
            </div>

            <!-- Right Panel: Cash Flow Waterfall & Category Progress -->
            <div
                class="lg:col-span-2 bg-mist-850 border border-mist-800 p-5 rounded-md flex flex-col justify-between">
                <div>
                    <!-- Cash Flow Waterfall Progression -->
                    <span
                        class="text-xs font-semibold text-mist-200 uppercase tracking-wider block mb-3">
                        Revenue Allocation Progression
                    </span>

                    <div
                        class="grid grid-cols-3 gap-3 text-xs font-mono mb-3 divide-x divide-mist-800">
                        <div class="bg-mist-900 p-2.5">
                            <span class="text-xs text-mist-400 block">Retained Balance</span>
                            <span class="text-sm font-semibold text-mist-300 font-mono">
                                {{ formatIDR(retainedCash) }}
                            </span>
                        </div>
                        <div class="bg-mist-900 p-2.5">
                            <span class="text-xs text-mist-400 block">Operating Margin</span>
                            <span class="text-sm font-semibold text-mist-300 font-mono">
                                {{ operatingMarginPct }}%
                            </span>
                        </div>
                    </div>

                    <!-- Category Ranked Progress List -->
                    <span class="text-xs font-semibold text-mist-300 block mb-2">
                        Expense Share per Category
                    </span>

                    <div class="text-xs">
                        <div
                            v-for="item in categoryExpenses"
                            :key="item.category"
                            class="py-1.5">
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

                <!-- Footer Footnote -->
                <div
                    class="pt-3 mt-4 border-t border-mist-800/70 flex justify-between text-xs text-mist-400">
                    <span>* Excludes Owner Payout Outflows</span>
                    <div class="flex items-center gap-2">
                        <span> Net Profit: </span>
                        <span class="font-mono text-mist-200 font-semibold">
                            {{ formatIDR(netPropertyProfit) }}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
