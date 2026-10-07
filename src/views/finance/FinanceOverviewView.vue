<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { formatIDR } from '@/utils/money';

import CardTitle from '@/components/CardTitle.vue';
import NetWorthTrajectoryChart from '@/features/finance/NetWorthTrajectoryChart.vue';
import IncomeEngineMatrixChart from '@/features/finance/IncomeEngineMatrixChart.vue';

const router = useRouter();
const financeStore = useFinanceStore();

const {
    netPropertyProfit,
    monthlyPropertyRevenue,
    monthlyPropertyExpenses,
    combinedMonthlyRevenue,
    totalOwnerDraws,
    portfolioSummary,
    dynamicTotalSavings,
} = storeToRefs(financeStore);

const totalHouseholdNetWorth = computed<number>(() => {
    const sbn = portfolioSummary.value.sbnTotalPrincipal || 0;
    const gold = portfolioSummary.value.goldCurrentValuation || 0;
    const savings = dynamicTotalSavings.value || 0;
    return sbn + gold + savings;
});

const monthlyHouseholdOutflows = computed<number>(() => {
    return (
        financeStore.danhMonthlyExpenses +
        financeStore.citraMonthlyExpenses +
        financeStore.sharedMonthlyExpenses
    );
});

const totalUnifiedCashFlow = computed<number>(() => {
    return netPropertyProfit.value + combinedMonthlyRevenue.value - monthlyHouseholdOutflows.value;
});

const savingsAllocationPct = computed<number>(() => {
    if (totalHouseholdNetWorth.value <= 0) return 0;
    return Math.round((dynamicTotalSavings.value / totalHouseholdNetWorth.value) * 100);
});

const sbnAllocationPct = computed<number>(() => {
    if (totalHouseholdNetWorth.value <= 0) return 0;
    return Math.round(
        (portfolioSummary.value.sbnTotalPrincipal / totalHouseholdNetWorth.value) * 100
    );
});

const goldAllocationPct = computed<number>(() => {
    if (totalHouseholdNetWorth.value <= 0) return 0;
    return Math.max(0, 100 - savingsAllocationPct.value - sbnAllocationPct.value);
});

function handleNavigate(targetRouteName: string): void {
    router.push({ name: targetRouteName });
}
</script>

<template>
    <div class="space-y-4">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div class="space-y-1 rounded-md border border-mist-800 bg-mist-900 p-4 shadow-sm">
                <h3 class="text-xs font-semibold tracking-wider text-mist-400 uppercase">
                    Total Net Worth
                </h3>
                <p class="font-mono text-lg font-semibold text-mist-200">
                    {{ formatIDR(totalHouseholdNetWorth) }}
                </p>
                <p class="text-xs text-mist-500">Savings + Sukuk SBN + Antam Gold</p>
            </div>

            <div class="space-y-1 rounded-md border border-mist-800 bg-mist-900 p-4 shadow-sm">
                <h3 class="text-xs font-semibold tracking-wider text-mist-400 uppercase">
                    Consolidated Cash Flow
                </h3>
                <p class="font-mono text-lg font-semibold text-mist-200">
                    <span
                        v-if="totalUnifiedCashFlow < 0"
                        class="text-rose-400">
                        -
                    </span>
                    <span>{{ formatIDR(Math.abs(totalUnifiedCashFlow)) }}</span>
                </p>
                <p class="text-xs text-mist-500">Villa net margin + Family cash flow</p>
            </div>

            <div class="space-y-1 rounded-md border border-mist-800 bg-mist-900 p-4 shadow-sm">
                <h3 class="text-xs font-semibold tracking-wider text-mist-400 uppercase">
                    Owner Draws
                </h3>
                <p class="font-mono text-lg font-semibold text-mist-200">
                    {{ formatIDR(totalOwnerDraws) }}
                </p>
                <p class="text-xs text-mist-500">Transferred to Personal accounts</p>
            </div>

            <div class="space-y-1 rounded-md border border-mist-800 bg-mist-900 p-4 shadow-sm">
                <h3 class="text-xs font-semibold tracking-wider text-mist-400 uppercase">
                    Cash Reserves
                </h3>
                <p class="font-mono text-lg font-semibold text-mist-200">
                    {{ formatIDR(dynamicTotalSavings) }}
                </p>
                <p class="text-xs text-mist-500">Available in BCA, Jago & Blu deposits</p>
            </div>
        </div>

        <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div class="flex flex-col">
                <CardTitle>
                    <template #title>Asset Allocation</template>
                    <template #subtitle>Cash, sukuk investments, and gold holdings</template>
                </CardTitle>
                <div
                    class="flex flex-1 flex-col justify-between space-y-4 rounded-md border border-mist-800 bg-mist-900 p-4 shadow-sm">
                    <div class="grid grid-cols-3 gap-2 font-mono text-xs">
                        <div class="flex items-center gap-1.5 text-amber-400">
                            <span class="h-2 w-2 rounded-full bg-amber-400" />
                            <span>Gold ({{ goldAllocationPct }}%)</span>
                        </div>
                        <div class="flex items-center justify-center gap-1.5 text-blue-400">
                            <span class="h-2 w-2 rounded-full bg-blue-400" />
                            <span>Savings ({{ savingsAllocationPct }}%)</span>
                        </div>
                        <div class="flex items-center justify-end gap-1.5 text-teal-400">
                            <span class="h-2 w-2 rounded-full bg-teal-400" />
                            <span>SBN Sukuk ({{ sbnAllocationPct }}%)</span>
                        </div>
                    </div>

                    <div
                        class="flex h-3 w-full overflow-hidden rounded-full border border-mist-800 bg-mist-950 p-0.5">
                        <div
                            class="h-full rounded-l-full bg-amber-400 transition-all duration-500"
                            :style="{ width: `${goldAllocationPct}%` }" />
                        <div
                            class="h-full bg-blue-400 transition-all duration-500"
                            :style="{ width: `${savingsAllocationPct}%` }" />
                        <div
                            class="h-full rounded-r-full bg-teal-400 transition-all duration-500"
                            :style="{ width: `${sbnAllocationPct}%` }" />
                    </div>

                    <div
                        class="grid grid-cols-3 gap-2 border-t border-mist-800/60 pt-2 font-mono text-xs">
                        <div class="space-y-1">
                            <span class="block text-xs text-mist-500 uppercase">Gold Value</span>
                            <span class="font-semibold text-mist-200">
                                {{ formatIDR(portfolioSummary.goldCurrentValuation) }}
                            </span>
                        </div>
                        <div class="space-y-1 text-center">
                            <span class="block text-xs text-mist-500 uppercase">Savings</span>
                            <span class="font-semibold text-mist-200">
                                {{ formatIDR(dynamicTotalSavings) }}
                            </span>
                        </div>
                        <div class="space-y-1 text-right">
                            <span class="block text-xs text-mist-500 uppercase">SBN Principal</span>
                            <span class="font-semibold text-mist-200">
                                {{ formatIDR(portfolioSummary.sbnTotalPrincipal) }}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="flex flex-col">
                <CardTitle>
                    <template #title>Cash Distribution</template>
                    <template #subtitle>
                        Villa operating profits vs. family living outflows
                    </template>
                </CardTitle>
                <div
                    class="flex flex-1 flex-col justify-between space-y-4 rounded-md border border-mist-800 bg-mist-900 p-4 shadow-sm">
                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-1 border-r border-mist-800/80 pr-2">
                            <span
                                class="text-xs font-semibold tracking-wider text-mist-400 uppercase">
                                Villa Net Profit
                            </span>
                            <p class="text-md font-mono font-semibold text-mist-200">
                                {{ formatIDR(netPropertyProfit) }}
                            </p>
                            <span class="block text-xs text-mist-500">
                                Gross: {{ formatIDR(monthlyPropertyRevenue) }}
                            </span>
                        </div>
                        <div class="space-y-1 pl-2">
                            <span
                                class="text-xs font-semibold tracking-wider text-mist-400 uppercase">
                                Household Outflows
                            </span>
                            <p class="text-md font-mono font-semibold text-mist-200">
                                {{ formatIDR(monthlyHouseholdOutflows) }}
                            </p>
                            <span class="block text-xs text-mist-500">
                                Inflows: {{ formatIDR(combinedMonthlyRevenue) }}
                            </span>
                        </div>
                    </div>

                    <div
                        class="flex items-center justify-between border-t border-mist-800/60 pt-2 text-xs">
                        <span class="text-mist-400">Consolidated Operating Margin:</span>
                        <div class="flex gap-2 font-mono font-semibold">
                            <span
                                v-if="totalUnifiedCashFlow < 0"
                                class="text-rose-400">
                                -
                            </span>
                            <span class="text-mist-200">
                                {{ formatIDR(Math.abs(totalUnifiedCashFlow)) }}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div class="flex flex-col">
                <CardTitle>
                    <template #title>Villa Operations</template>
                    <template #subtitle>Piyungan, Wonosari and Bantul rental ledgers</template>
                </CardTitle>
                <div
                    class="flex flex-1 flex-col justify-between space-y-4 rounded-md border border-mist-800 bg-mist-900 p-4 shadow-sm">
                    <div class="grid grid-cols-3 gap-2 font-mono text-xs">
                        <div class="space-y-1">
                            <span class="block text-xs text-mist-500 uppercase">Revenue</span>
                            <span class="font-semibold text-mist-200">
                                {{ formatIDR(monthlyPropertyRevenue) }}
                            </span>
                        </div>
                        <div class="space-y-1 text-center">
                            <span class="block text-xs text-mist-500 uppercase">Expenses</span>
                            <span class="font-semibold text-mist-200">
                                {{ formatIDR(monthlyPropertyExpenses) }}
                            </span>
                        </div>
                        <div class="space-y-1 text-right">
                            <span class="block text-xs text-mist-500 uppercase">Net Margin</span>
                            <span class="font-semibold text-mist-200">
                                {{ formatIDR(netPropertyProfit) }}
                            </span>
                        </div>
                    </div>

                    <div class="flex justify-end border-t border-mist-800/60 pt-2">
                        <button
                            type="button"
                            class="cursor-pointer rounded-md bg-mist-800 px-3 py-1.5 text-xs font-semibold text-mist-200 transition hover:bg-mist-700 hover:text-mist-100"
                            @click="handleNavigate('finance-property')">
                            Open Property Wallet &rarr;
                        </button>
                    </div>
                </div>
            </div>

            <div class="flex flex-col">
                <CardTitle>
                    <template #title>Personal & Family</template>
                    <template #subtitle>Danh Nguyen, Citra Ayu Wardani and Shared budgets</template>
                </CardTitle>
                <div
                    class="flex flex-1 flex-col justify-between space-y-4 rounded-md border border-mist-800 bg-mist-900 p-4 shadow-sm">
                    <div class="grid grid-cols-3 gap-2 font-mono text-xs">
                        <div class="space-y-1">
                            <span class="block text-xs text-mist-500 uppercase">
                                Inflow Receipts
                            </span>
                            <span class="font-semibold text-mist-200">
                                {{ formatIDR(combinedMonthlyRevenue) }}
                            </span>
                        </div>
                        <div class="space-y-1 text-center">
                            <span class="block text-xs text-mist-500 uppercase">
                                Living Outflows
                            </span>
                            <span class="font-semibold text-mist-200">
                                {{ formatIDR(monthlyHouseholdOutflows) }}
                            </span>
                        </div>
                        <div class="space-y-1 text-right">
                            <span class="block text-xs text-mist-500 uppercase">
                                Active Savings
                            </span>
                            <span class="font-semibold text-mist-200">
                                {{ formatIDR(dynamicTotalSavings) }}
                            </span>
                        </div>
                    </div>

                    <div class="flex justify-end border-t border-mist-800/60 pt-2">
                        <button
                            type="button"
                            class="cursor-pointer rounded-md bg-mist-800 px-3 py-1.5 text-xs font-semibold text-mist-200 transition hover:bg-mist-700 hover:text-mist-100"
                            @click="handleNavigate('finance-personal')">
                            Open Personal Wallet &rarr;
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <NetWorthTrajectoryChart />
            <IncomeEngineMatrixChart />
        </div>
    </div>
</template>
