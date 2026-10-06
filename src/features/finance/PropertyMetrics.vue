<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { usePropertyDetails } from '@/composables/usePropertyDetails';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { isDateInMonth, calculateGrowthPct } from '@/utils/financeCalculators';
import { formatIDR } from '@/utils/money';
import type { PropertyId } from '@/types/property';
import type { PropertyFinance } from '@/types/finance';

interface Props {
    propertyId?: PropertyId;
}

const { propertyId = 'piyungan' } = defineProps<Props>();

const financeStore = useFinanceStore();
const { unifiedPropertyFinances, selectedMonth, previousMonth } = storeToRefs(financeStore);
const { totalYearRevenue } = usePropertyDetails(() => propertyId);

const currentMonthItems = computed<PropertyFinance[]>(() => {
    const list = unifiedPropertyFinances.value || [];
    return list.filter((item) => {
        if (!item?.date) return false;
        if (item.propertyId !== propertyId) return false;
        return isDateInMonth(item.date, selectedMonth.value);
    });
});
const previousMonthItems = computed<PropertyFinance[]>(() => {
    const list = unifiedPropertyFinances.value || [];
    return list.filter((item) => {
        if (!item?.date) return false;
        if (item.propertyId !== propertyId) return false;
        return isDateInMonth(item.date, previousMonth.value);
    });
});
const monthlyRevenue = computed<number>(() => {
    let sum = 0;
    const items = currentMonthItems.value;
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item) continue;
        if (
            item.type === 'income' &&
            item.category !== 'Owner Payout' &&
            item.category !== 'Mai House Jogja Share'
        ) {
            sum += Number(item.amount) || 0;
        }
    }
    return sum;
});
const monthlyExpenses = computed<number>(() => {
    let sum = 0;
    const items = currentMonthItems.value;
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item) continue;
        if (item.type === 'expense' && item.category !== 'Owner Payout Outflow') {
            sum += Number(item.amount) || 0;
        }
    }
    return sum;
});
const netPropertyProfit = computed<number>(() => monthlyRevenue.value - monthlyExpenses.value);
const previousMonthRevenue = computed<number>(() => {
    let sum = 0;
    const items = previousMonthItems.value;
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item) continue;
        if (
            item.type === 'income' &&
            item.category !== 'Owner Payout' &&
            item.category !== 'Mai House Jogja Share'
        ) {
            sum += Number(item.amount) || 0;
        }
    }
    return sum;
});
const previousMonthExpenses = computed<number>(() => {
    let sum = 0;
    const items = previousMonthItems.value;
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item) continue;
        if (item.type === 'expense' && item.category !== 'Owner Payout Outflow') {
            sum += Number(item.amount) || 0;
        }
    }
    return sum;
});
const revenueGrowthPct = computed<number | null>(() =>
    calculateGrowthPct(monthlyRevenue.value, previousMonthRevenue.value)
);
const expenseGrowthPct = computed<number | null>(() =>
    calculateGrowthPct(monthlyExpenses.value, previousMonthExpenses.value)
);
</script>

<template>
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div class="space-y-1 rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md">
            <h3 class="text-xs font-semibold tracking-wider text-mist-400 uppercase">Earnings</h3>
            <p class="font-mono text-lg font-semibold text-mist-200">
                {{ formatIDR(monthlyRevenue) }}
            </p>
            <p class="flex items-center gap-1 text-xs">
                <span
                    v-if="revenueGrowthPct !== null"
                    class="font-medium"
                    :class="
                        revenueGrowthPct > 0
                            ? 'text-emerald-400'
                            : revenueGrowthPct < 0
                              ? 'text-rose-400'
                              : 'text-mist-400'
                    ">
                    <fa-icon
                        :icon="revenueGrowthPct >= 0 ? 'arrow-trend-up' : 'arrow-trend-down'" />
                    {{ Math.abs(revenueGrowthPct) }}%
                </span>
                <span
                    v-else
                    class="font-medium text-mist-500">
                    —
                </span>
                <span class="text-mist-500">vs last month</span>
            </p>
        </div>

        <div class="space-y-1 rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md">
            <h3 class="text-xs font-semibold tracking-wider text-mist-400 uppercase">Expenses</h3>
            <p class="font-mono text-lg font-semibold text-mist-200">
                {{ formatIDR(monthlyExpenses) }}
            </p>
            <p class="flex items-center gap-1 text-xs">
                <span
                    v-if="expenseGrowthPct !== null"
                    class="font-medium"
                    :class="
                        expenseGrowthPct > 0
                            ? 'text-rose-400'
                            : expenseGrowthPct < 0
                              ? 'text-emerald-400'
                              : 'text-mist-400'
                    ">
                    <fa-icon
                        :icon="expenseGrowthPct >= 0 ? 'arrow-trend-up' : 'arrow-trend-down'" />
                    {{ Math.abs(expenseGrowthPct) }}%
                </span>
                <span
                    v-else
                    class="font-medium text-mist-500">
                    —
                </span>
                <span class="text-mist-500">vs last month</span>
            </p>
        </div>

        <div class="space-y-1 rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md">
            <h3 class="text-xs font-semibold tracking-wider text-mist-400 uppercase">Net Profit</h3>
            <p
                class="font-mono text-lg font-semibold"
                :class="netPropertyProfit >= 0 ? 'text-mist-200' : 'text-rose-400'">
                {{ formatIDR(netPropertyProfit) }}
            </p>
            <p class="text-xs text-mist-500">Operating margin</p>
        </div>

        <div class="space-y-1 rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md">
            <h3 class="text-xs font-semibold tracking-wider text-mist-400 uppercase">
                Annual Run-Rate
            </h3>
            <p class="font-mono text-lg font-semibold text-mist-200">
                {{ formatIDR(totalYearRevenue) }}
            </p>
            <p class="flex items-center gap-1 text-xs">
                <span class="font-medium text-emerald-400">
                    {{ monthlyRevenue >= 0 ? '+' : '' }}{{ formatIDR(monthlyRevenue) }}
                </span>
                <span class="text-mist-500">this cycle</span>
            </p>
        </div>
    </div>
</template>
