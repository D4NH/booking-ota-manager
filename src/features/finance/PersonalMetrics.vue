<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { formatIDR } from '@/utils/money';
import { isDateInMonth, calculateGrowthPct } from '@/utils/finance';
import type { PersonalOwner, PersonalFinance, SharedFinance } from '@/types/finance';

interface Props {
    owner?: PersonalOwner | 'Shared';
}

interface MetricsTotals {
    inflow: number;
    outflow: number;
    net: number;
    savings: number;
    revenueGrowthPct: number | null;
}

const { owner = 'Danh Nguyen' } = defineProps<Props>();

const financeStore = useFinanceStore();
const { personalFinances, sharedFinances, selectedMonth, previousMonth } =
    storeToRefs(financeStore);

const metrics = computed<MetricsTotals>(() => {
    let inflow = 0;
    let prevInflow = 0;
    let outflow = 0;
    let savings = 0;

    const cycle = selectedMonth.value;
    const prevCycle = previousMonth.value;
    const personal = personalFinances.value || [];
    const shared = sharedFinances.value || [];

    const processItem = (item: PersonalFinance | SharedFinance): void => {
        if (!item?.date) return;
        const category = item.category?.toLowerCase().trim();
        const amount = Number(item.amount) || 0;

        if (isDateInMonth(item.date, cycle)) {
            if (category === 'savings') {
                savings += amount;
                return;
            }
            if (category === 'gold') return;

            if (item.type === 'income') {
                inflow += amount;
            } else if (item.type === 'expense' || item.type === 'fixed_cost') {
                outflow += amount;
            }
        }

        if (isDateInMonth(item.date, prevCycle)) {
            if (category !== 'savings' && category !== 'gold' && item.type === 'income') {
                prevInflow += amount;
            }
        }
    };

    if (owner === 'Danh Nguyen' || owner === 'Citra Ayu Wardani') {
        const targetPersonal = personal.filter((p) => p.owner === owner);
        for (let i = 0; i < targetPersonal.length; i++) {
            const item = targetPersonal[i];
            if (item) processItem(item);
        }
    }

    if (owner === 'Shared') {
        for (let i = 0; i < shared.length; i++) {
            const item = shared[i];
            if (item) processItem(item);
        }
    }

    return {
        inflow,
        outflow,
        net: inflow - outflow,
        savings,
        revenueGrowthPct: calculateGrowthPct(inflow, prevInflow),
    };
});
</script>

<template>
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div class="space-y-1 rounded-md border border-mist-800 bg-mist-900 p-4 shadow-sm">
            <h3 class="text-xs font-semibold tracking-wider text-mist-400 uppercase">
                Total Income
            </h3>
            <p class="font-mono text-lg font-semibold text-mist-200">
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

        <div class="space-y-1 rounded-md border border-mist-800 bg-mist-900 p-4 shadow-sm">
            <h3 class="text-xs font-semibold tracking-wider text-mist-400 uppercase">
                Total Expenses
            </h3>
            <p class="font-mono text-lg font-semibold text-mist-200">
                {{ formatIDR(metrics.outflow) }}
            </p>
            <p class="text-xs text-mist-500">Fixed costs & variable spending</p>
        </div>

        <div class="space-y-1 rounded-md border border-mist-800 bg-mist-900 p-4 shadow-sm">
            <h3 class="text-xs font-semibold tracking-wider text-mist-400 uppercase">
                Net Position
            </h3>
            <div class="flex gap-2 font-mono text-lg font-semibold">
                <span
                    v-if="metrics.net < 0"
                    class="text-rose-400">
                    -
                </span>
                <span>{{ formatIDR(Math.abs(metrics.net)) }}</span>
            </div>
            <p class="text-xs text-mist-500">Current cycle cash retention</p>
        </div>

        <div class="space-y-1 rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md">
            <h3 class="text-xs font-semibold tracking-wider text-mist-400 uppercase">
                Allocated to Savings
            </h3>
            <p class="font-mono text-lg font-semibold text-mist-200">
                {{ formatIDR(metrics.savings) }}
            </p>
            <p class="text-xs text-mist-500">Reserve deposits</p>
        </div>
    </div>
</template>
