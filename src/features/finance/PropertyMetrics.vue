<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useMonthlyMetrics } from '@/composables/useMonthlyMetrics';
import { usePropertyDetails } from '@/composables/usePropertyDetails';
import { useBookingStore } from '@/stores/useBookingStore';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { formatIDR } from '@/utils/money';

const bookingStore = useBookingStore();
const { bookings } = storeToRefs(bookingStore);
const financeStore = useFinanceStore();
const {
    monthlyPropertyExpenses,
    propertyRevenueGrowthPct,
    propertyExpenseGrowthPct,
    netPropertyProfit,
    monthlyPropertyRevenue,
} = storeToRefs(financeStore);
const { totalPayout } = useMonthlyMetrics(bookings, {
    propertyId: () => 'all',
});
const { totalYearRevenue } = usePropertyDetails(() => 'all');
</script>

<template>
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div class="rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md space-y-1">
            <div class="flex justify-between items-center">
                <h3
                    class="flex justify-between text-xs font-semibold uppercase tracking-wider text-mist-400">
                    Earnings
                </h3>
            </div>
            <p class="font-mono text-lg font-semibold text-white">
                {{ formatIDR(monthlyPropertyRevenue) }}
            </p>
            <p class="flex items-center gap-1 text-xs">
                <span
                    v-if="propertyRevenueGrowthPct !== null"
                    class="font-medium"
                    :class="
                        propertyRevenueGrowthPct > 0
                            ? 'text-emerald-400'
                            : propertyRevenueGrowthPct < 0
                              ? 'text-rose-400'
                              : 'text-mist-400'
                    ">
                    <fa-icon
                        :icon="
                            propertyRevenueGrowthPct >= 0 ? 'arrow-trend-up' : 'arrow-trend-down'
                        " />
                    {{ Math.abs(propertyRevenueGrowthPct) }}%
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
                    Expenses
                </h3>
            </div>
            <p class="font-mono text-lg font-semibold text-white">
                {{ formatIDR(monthlyPropertyExpenses) }}
            </p>
            <p class="flex items-center gap-1 text-xs">
                <span
                    v-if="propertyExpenseGrowthPct !== null"
                    class="font-medium"
                    :class="
                        propertyExpenseGrowthPct > 0
                            ? 'text-rose-400'
                            : propertyExpenseGrowthPct < 0
                              ? 'text-emerald-400'
                              : 'text-mist-400'
                    ">
                    <fa-icon
                        :icon="
                            propertyExpenseGrowthPct >= 0 ? 'arrow-trend-up' : 'arrow-trend-down'
                        " />
                    {{ Math.abs(propertyExpenseGrowthPct) }}%
                </span>
                <span
                    v-else
                    class="font-medium text-mist-500">
                    -
                </span>
                <span class="text-mist-500">vs last month</span>
            </p>
        </div>

        <div class="rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md space-y-1">
            <div class="flex justify-between items-center">
                <h3
                    class="flex justify-between text-xs font-semibold uppercase tracking-wider text-mist-400">
                    Net Profit
                </h3>
            </div>
            <p class="font-mono text-lg font-semibold text-white">
                {{ formatIDR(netPropertyProfit) }}
            </p>
            <p class="text-xs text-mist-500">This month</p>
        </div>

        <div class="rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md space-y-1">
            <div class="flex justify-between items-center">
                <h3
                    class="flex justify-between text-xs font-semibold uppercase tracking-wider text-mist-400">
                    Total Balance
                </h3>
            </div>
            <p class="font-mono text-lg font-semibold text-white">
                {{ formatIDR(totalYearRevenue) }}
            </p>
            <p class="flex items-center gap-1 text-xs">
                <span class="font-medium text-emerald-400">
                    {{ totalPayout >= 0 ? '+' : '' }}{{ formatIDR(totalPayout) }}
                </span>
                <span class="text-mist-500">as latest payout</span>
            </p>
        </div>
    </div>
</template>
