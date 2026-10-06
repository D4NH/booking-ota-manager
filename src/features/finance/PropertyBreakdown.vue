<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useFinanceStore } from '@/stores/useFinanceStore';
import type { PropertyId } from '@/types/property';
import type { PropertyFinance } from '@/types/finance';
import { formatIDR } from '@/utils/money';

import CardTitle from '@/components/CardTitle.vue';

interface Props {
    propertyId?: PropertyId | 'all';
}

interface CategoryBreakdown {
    category: string;
    amount: number;
    pct: number;
    color: string;
}

const PALETTE: readonly string[] = [
    '#F43F5E', // Rose (Electricity)
    '#38BDF8', // Sky (Biznet / Wi-Fi)
    '#F59E0B', // Amber (Maintenance)
    '#A855F7', // Purple (Cleaning)
    '#64748B', // Slate (General / Overhead)
] as const;

const { propertyId = 'piyungan' } = defineProps<Props>();

const financeStore = useFinanceStore();
const { filteredPropertyFinances, selectedMonth, monthlyPropertyExpenses } =
    storeToRefs(financeStore);

const scopedFinances = computed<PropertyFinance[]>(() => {
    const list = filteredPropertyFinances.value || [];
    return list.filter((i) => i.propertyId === propertyId);
});
const scopedExpenses = computed<number>(() => {
    let sum = 0;
    const items = scopedFinances.value;
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item) continue;
        if (item.type === 'expense' && item.category !== 'Owner Payout Outflow') {
            sum += Number(item.amount) || 0;
        }
    }
    return sum;
});
const categoryExpenses = computed<CategoryBreakdown[]>(() => {
    const total = scopedExpenses.value;
    const map = new Map<string, number>();

    const expenseItems = scopedFinances.value.filter(
        (i) => i.type === 'expense' && i.category !== 'Owner Payout Outflow'
    );

    for (let i = 0; i < expenseItems.length; i++) {
        const item = expenseItems[i];
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
</script>

<template>
    <div class="flex min-h-0 flex-col">
        <CardTitle>
            <template #title>Financial Breakdown</template>
            <template #subtitle>
                Operational cost allocation & cash retention for cycle {{ selectedMonth }}
            </template>
        </CardTitle>

        <div
            class="flex h-full flex-col justify-between space-y-4 rounded-md border border-mist-800 p-4">
            <div class="flex flex-col items-baseline gap-1">
                <span class="text-md font-mono font-semibold">
                    {{ formatIDR(Math.abs(monthlyPropertyExpenses)) }}
                </span>
                <p class="flex items-center gap-1 text-xs text-mist-500">
                    Total expenses this month
                </p>
            </div>

            <div class="flex flex-col justify-between">
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
                                    :style="{ backgroundColor: item.color }" />
                                {{ item.category }}
                            </span>
                            <div class="flex items-center gap-2 font-mono">
                                <span class="text-mist-400">{{ formatIDR(item.amount) }}</span>
                                <span class="min-w-8 text-right font-semibold text-mist-200">
                                    {{ item.pct }}%
                                </span>
                            </div>
                        </div>

                        <div
                            class="mt-2 h-1.5 w-full space-y-2 overflow-hidden rounded-full bg-mist-950/50">
                            <div
                                class="h-full rounded-full transition-all duration-500"
                                :style="{
                                    width: `${item.pct}%`,
                                    backgroundColor: item.color,
                                }" />
                        </div>
                    </div>

                    <div
                        v-if="categoryExpenses.length === 0"
                        class="py-6 text-center text-xs text-mist-400">
                        No operational expense entries recorded for this cycle.
                    </div>
                </div>
            </div>

            <div
                class="flex justify-between border-t border-mist-800/70 pt-3 text-xs text-mist-400">
                <span>* Excludes Owner Payout Outflows</span>
            </div>
        </div>
    </div>
</template>
