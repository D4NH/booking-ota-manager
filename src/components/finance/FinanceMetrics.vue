<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { formatIDR } from '@/utils/money';

const financeStore = useFinanceStore();
const {
    monthlyPropertyRevenue,
    monthlyPropertyExpenses,
    monthlyOwnerDraws,
    netPropertyProfit,
    danhNetBalance,
    citraNetBalance,
    sharedNetBalance,
    totalOwnerDraws,
} = storeToRefs(financeStore);
</script>

<template>
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div class="rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md space-y-1">
            <div class="flex justify-between items-center">
                <h3
                    class="flex justify-between text-xs font-bold uppercase tracking-wider text-mist-400">
                    Mai House Jogja
                </h3>
            </div>
            <p class="font-mono text-lg font-bold text-white">
                {{ formatIDR(netPropertyProfit) }}
            </p>
            <p class="text-xs text-mist-500">Operating Profit</p>
            <!-- Outflows -->
            <!-- <div class="pt-3 mt-3 border-t border-mist-800 grid grid-cols-2 gap-2 text-xs">
                <div>
                    Rev:
                    <span class="font-bold text-lime-400 font-mono">{{
                        formatIDR(monthlyPropertyRevenue)
                    }}</span>
                </div>
                <div>
                    Exp:
                    <span class="font-bold text-rose-400 font-mono">{{
                        formatIDR(monthlyPropertyExpenses)
                    }}</span>
                </div>
            </div> -->
        </div>

        <div class="rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md space-y-1">
            <div class="flex justify-between items-center">
                <h3
                    class="flex justify-between text-xs font-bold uppercase tracking-wider text-mist-400">
                    Shared Household
                </h3>
            </div>
            <p class="font-mono text-lg font-bold text-white">
                {{ formatIDR(sharedNetBalance) }}
            </p>
            <p class="text-xs text-mist-500">Remaining Balance</p>
            <!-- Outflows -->
            <!-- <div class="pt-3 mt-3 border-t border-mist-800 text-xs text-mist-400">
                Total Joint Outflows:
                <span class="font-bold text-lime-400 font-mono">
                    {{ formatIDR(totalOwnerDraws) }}
                </span>
            </div> -->
        </div>

        <div class="rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md space-y-1">
            <div class="flex justify-between items-center">
                <h3
                    class="flex justify-between text-xs font-bold uppercase tracking-wider text-mist-400">
                    Danh Nguyen
                </h3>
            </div>
            <p
                class="font-mono text-lg font-bold text-white"
                :class="danhNetBalance >= 0 ? 'text-mist-100' : 'text-rose-400'">
                {{ formatIDR(danhNetBalance) }}
            </p>
            <p class="text-xs text-mist-500">Discretionary Net</p>
            <!-- Outflows -->
            <!-- <div class="pt-3 mt-3 border-t border-mist-800 text-[11px] text-mist-400">
                Personal Inflows minus Expenses
            </div> -->
        </div>

        <div class="rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md space-y-1">
            <div class="flex justify-between items-center">
                <h3
                    class="flex justify-between text-xs font-bold uppercase tracking-wider text-mist-400">
                    Citra Ayu Wardani
                </h3>
            </div>
            <p
                class="font-mono text-lg font-bold text-white"
                :class="citraNetBalance >= 0 ? 'text-mist-100' : 'text-rose-400'">
                {{ formatIDR(citraNetBalance) }}
            </p>
            <p class="text-xs text-mist-500">Discretionary Net</p>
            <!-- Outflows -->
            <!-- <div class="pt-3 mt-3 border-t border-mist-800 text-[11px] text-mist-400">
                Personal Inflows minus Expenses
            </div> -->
        </div>
    </div>
</template>
