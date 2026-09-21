<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { formatIDR } from '@/utils/money';

const financeStore = useFinanceStore();
const {
    netPropertyProfit,
    danhNetBalance,
    danhRevenueGrowthPct,
    citraNetBalance,
    sharedNetBalance,
} = storeToRefs(financeStore);
</script>

<template>
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div class="rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md space-y-1">
            <div class="flex justify-between items-center">
                <h3
                    class="flex justify-between text-xs font-semibold uppercase tracking-wider text-mist-400">
                    Mai House Jogja
                </h3>
            </div>
            <p class="font-mono text-lg font-semibold text-white">
                {{ formatIDR(netPropertyProfit) }}
            </p>
            <p class="text-xs text-mist-500">Operating Profit</p>
        </div>

        <div class="rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md space-y-1">
            <div class="flex justify-between items-center">
                <h3
                    class="flex justify-between text-xs font-semibold uppercase tracking-wider text-mist-400">
                    Danh Nguyen
                </h3>
            </div>
            <p
                class="font-mono text-lg font-semibold text-white"
                :class="danhNetBalance >= 0 ? 'text-mist-100' : 'text-rose-400'">
                {{ formatIDR(danhNetBalance) }}
            </p>
            <p class="flex items-center gap-1 text-xs">
                <span
                    v-if="danhRevenueGrowthPct !== null"
                    class="font-medium"
                    :class="
                        danhRevenueGrowthPct > 0
                            ? 'text-lime-400'
                            : danhRevenueGrowthPct < 0
                              ? 'text-rose-400'
                              : 'text-mist-400'
                    ">
                    {{ danhRevenueGrowthPct >= 0 ? '↑' : '↓' }}{{ Math.abs(danhRevenueGrowthPct) }}%
                </span>
                <span
                    v-else
                    class="font-medium text-mist-500">
                    —
                </span>
                <span class="text-mist-500">vs last month</span>
            </p>
        </div>

        <div class="rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md space-y-1">
            <div class="flex justify-between items-center">
                <h3
                    class="flex justify-between text-xs font-semibold uppercase tracking-wider text-mist-400">
                    Citra Ayu Wardani
                </h3>
            </div>
            <p
                class="font-mono text-lg font-semibold text-white"
                :class="citraNetBalance >= 0 ? 'text-mist-100' : 'text-rose-400'">
                {{ formatIDR(citraNetBalance) }}
            </p>
            <p class="text-xs text-mist-500">Discretionary Net</p>
        </div>

        <div class="rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md space-y-1">
            <div class="flex justify-between items-center">
                <h3
                    class="flex justify-between text-xs font-semibold uppercase tracking-wider text-mist-400">
                    Shared Household
                </h3>
            </div>
            <p class="font-mono text-lg font-semibold text-white">
                {{ formatIDR(sharedNetBalance) }}
            </p>
            <p class="text-xs text-mist-500">Remaining Balance</p>
        </div>
    </div>
</template>
