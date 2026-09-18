<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useMonthlyMetrics } from '@/composables/useMonthlyMetrics';
import { usePropertyDetails } from '@/composables/usePropertyDetails';
import { useBookingStore } from '@/stores/useBookingStore';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { formatIDR } from '@/utils/money';

const financeStore = useFinanceStore();
const {
    monthlyPropertyRevenue,
    monthlyPropertyExpenses,
    propertyRevenueGrowthPct,
    propertyExpenseGrowthPct,
    monthlyOwnerDraws,
    netPropertyProfit,
    danhNetBalance,
    citraNetBalance,
    sharedNetBalance,
    totalOwnerDraws,
} = storeToRefs(financeStore);

const bookingStore = useBookingStore();
const { bookings } = storeToRefs(bookingStore);
const { totalPayout, revenueGrowthPercent } = useMonthlyMetrics(bookings, {
    propertyId: () => 'all',
});
const {
    selectedProperty,
    unitBookings,
    totalRevenue,
    adr,
    totalNights,
    annualOccupancy,
    nextUpcoming,
    lockboxPin,
    isOccupied,
    staySections,
    todayTurnover,
    currentDay,
} = usePropertyDetails(() => 'all');
</script>

<template>
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div class="rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md space-y-1">
            <div class="flex justify-between items-center">
                <h3
                    class="flex justify-between text-xs font-semibold uppercase tracking-wider text-mist-400">
                    Total Balance
                </h3>
            </div>
            <p class="font-mono text-lg font-bold text-white">
                {{ formatIDR(totalRevenue) }}
            </p>
            <p class="flex items-center gap-1 text-xs">
                <span class="font-medium text-lime-400">
                    {{ totalPayout >= 0 ? '+' : '' }}{{ formatIDR(totalPayout) }}
                </span>
                <span class="text-mist-500">this month</span>
            </p>
        </div>

        <div class="rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md space-y-1">
            <div class="flex justify-between items-center">
                <h3
                    class="flex justify-between text-xs font-semibold uppercase tracking-wider text-mist-400">
                    Earnings
                </h3>
            </div>
            <p class="font-mono text-lg font-bold text-white">
                {{ formatIDR(totalPayout) }}
            </p>
            <p class="flex items-center gap-1 text-xs">
                <span
                    class="font-medium"
                    :class="
                        revenueGrowthPercent > 0
                            ? 'text-lime-400'
                            : revenueGrowthPercent < 0
                              ? 'text-rose-400'
                              : 'text-mist-400'
                    ">
                    {{ revenueGrowthPercent >= 0 ? '+' : '' }}{{ revenueGrowthPercent }}%
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
            <p class="font-mono text-lg font-bold text-white">
                {{ formatIDR(monthlyPropertyExpenses) }}
            </p>
            <p class="flex items-center gap-1 text-xs">
                <span
                    class="font-medium"
                    :class="
                        propertyExpenseGrowthPct > 0
                            ? 'text-rose-400'
                            : propertyExpenseGrowthPct < 0
                              ? 'text-lime-400'
                              : 'text-mist-400'
                    ">
                    {{ propertyExpenseGrowthPct >= 0 ? '↑' : '↓'
                    }}{{ Math.abs(propertyExpenseGrowthPct) }}%
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
            <p class="font-mono text-lg font-bold text-white">
                {{ formatIDR(netPropertyProfit) }}
            </p>
            <p class="text-xs text-mist-500">Total Balance</p>
        </div>
    </div>
</template>
