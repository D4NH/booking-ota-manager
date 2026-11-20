<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useFinanceStore } from '@/stores/useFinanceStore';
import type { PersonalOwner, OwnerMonthlyMetrics } from '@/types/finance';
import { formatIDR } from '@/utils/money';

interface Props {
    owner?: PersonalOwner | 'Shared';
}

const { owner = 'Danh Nguyen' } = defineProps<Props>();

const financeStore = useFinanceStore();
const { goldAccountAllocation, sbnAccountAllocation, dynamicSavingsAccounts } =
    storeToRefs(financeStore);

const metrics = computed<OwnerMonthlyMetrics>(() => financeStore.getOwnerFinancialMetrics(owner));
const totalAssets = computed<number>(() => calculateAssets(owner));

function calculateAssets(targetOwner: PersonalOwner | 'Shared'): number {
    const gold = goldAccountAllocation.value.find((a) => a.owner === targetOwner);
    const sbn = sbnAccountAllocation.value.find((a) => a.owner === targetOwner);
    const savingAccounts = dynamicSavingsAccounts.value.filter((a) => a.owner === targetOwner);

    const savingsTotal = savingAccounts.reduce((sum, acc) => sum + Number(acc.balance || 0), 0);
    const goldValuation = Number(gold?.valuation || 0);
    const sbnPrincipal = Number(sbn?.principalAmount || 0);

    return goldValuation + sbnPrincipal + savingsTotal;
}
</script>

<template>
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div class="space-y-1 rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md">
            <h3 class="text-xs font-semibold tracking-wider text-mist-400 uppercase">
                Total Income
            </h3>
            <p class="font-mono text-lg font-extrabold text-mist-200">
                {{ formatIDR(metrics.inflow) }}
            </p>
            <p class="flex items-center gap-1 text-xs">
                <span
                    v-if="metrics.revenueGrowthPct !== null"
                    class="font-medium"
                    :class="
                        metrics.revenueGrowthPct > 0
                            ? 'text-emerald-400'
                            : metrics.revenueGrowthPct < 0
                              ? 'text-rose-400'
                              : 'text-mist-400'
                    ">
                    <fa-icon
                        class="text-[10px]"
                        :icon="
                            metrics.revenueGrowthPct >= 0 ? 'arrow-trend-up' : 'arrow-trend-down'
                        " />
                    {{ Math.abs(metrics.revenueGrowthPct) }}%
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
            <h3 class="text-xs font-semibold tracking-wider text-mist-400 uppercase">
                Total Expenses
            </h3>
            <p class="font-mono text-lg font-extrabold text-mist-200">
                {{ formatIDR(metrics.outflow + metrics.savings) }}
            </p>
            <p class="text-xs text-mist-500">Fixed costs &amp; variable spending</p>
        </div>

        <div class="space-y-1 rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md">
            <h3 class="text-xs font-semibold tracking-wider text-mist-400 uppercase">
                Net Position
            </h3>
            <div class="flex gap-1 font-mono text-lg font-extrabold">
                <span
                    v-if="metrics.net < 0"
                    class="text-rose-400">
                    -
                </span>
                <span class="text-mist-200">{{ formatIDR(Math.abs(metrics.net)) }}</span>
            </div>
            <p class="text-xs text-mist-500">Current cycle cash retention</p>
        </div>

        <div class="space-y-1 rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md">
            <h3 class="text-xs font-semibold tracking-wider text-mist-400 uppercase">
                Total Assets
            </h3>
            <p class="font-mono text-lg font-extrabold text-mist-200">
                {{ formatIDR(totalAssets) }}
            </p>
            <p class="text-xs text-mist-500">Reserve deposits</p>
        </div>
    </div>
</template>
