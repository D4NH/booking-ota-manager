<script setup lang="ts">
import { computed } from 'vue';
import { usePropertyDetails } from '@/composables/usePropertyDetails';
import { useFinanceStore } from '@/stores/useFinanceStore';
import type { PropertyMonthlyMetrics } from '@/types/finance';
import type { PropertyId } from '@/types/property';
import { formatIDR } from '@/utils/money';

interface Props {
    propertyId?: PropertyId | 'all';
}

const { propertyId = 'all' } = defineProps<Props>();

const financeStore = useFinanceStore();
const { totalYearRevenue } = usePropertyDetails(() => propertyId);

const metrics = computed<PropertyMonthlyMetrics>(() =>
    financeStore.getPropertyFinancialMetrics(propertyId)
);
</script>

<template>
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div class="space-y-1 rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md">
            <h3 class="text-xs font-semibold tracking-wider text-mist-400 uppercase">Earnings</h3>
            <p class="font-mono text-lg font-extrabold text-mist-200">
                {{ formatIDR(metrics.revenue) }}
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
            <h3 class="text-xs font-semibold tracking-wider text-mist-400 uppercase">Expenses</h3>
            <p class="font-mono text-lg font-extrabold text-mist-200">
                {{ formatIDR(metrics.expenses) }}
            </p>
            <p class="flex items-center gap-1 text-xs">
                <span
                    v-if="metrics.expenseGrowthPct !== null"
                    class="font-medium"
                    :class="
                        metrics.expenseGrowthPct > 0
                            ? 'text-rose-400'
                            : metrics.expenseGrowthPct < 0
                              ? 'text-emerald-400'
                              : 'text-mist-400'
                    ">
                    <fa-icon
                        class="text-[10px]"
                        :icon="
                            metrics.expenseGrowthPct >= 0 ? 'arrow-trend-up' : 'arrow-trend-down'
                        " />
                    {{ Math.abs(metrics.expenseGrowthPct) }}%
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
            <p class="font-mono text-lg font-extrabold text-mist-200">
                {{ formatIDR(metrics.netProfit) }}
            </p>
            <p class="text-xs text-mist-500">Operating margin</p>
        </div>

        <div class="space-y-1 rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md">
            <h3 class="text-xs font-semibold tracking-wider text-mist-400 uppercase">
                Annual Run-Rate
            </h3>
            <p class="font-mono text-lg font-extrabold text-mist-200">
                {{ formatIDR(totalYearRevenue) }}
            </p>
            <p class="flex items-center gap-1 text-xs">
                <span class="font-medium text-emerald-400">
                    {{ metrics.revenue >= 0 ? '+' : '' }}{{ formatIDR(metrics.revenue) }}
                </span>
                <span class="text-mist-500">this cycle</span>
            </p>
        </div>
    </div>
</template>
