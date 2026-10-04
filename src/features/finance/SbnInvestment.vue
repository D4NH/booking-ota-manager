<script setup lang="ts">
import { ref, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { calculateSbnMaturity } from '@/utils/financeCalculators';
import { formatIDR } from '@/utils/money';

const financeStore = useFinanceStore();
const {
    sbnInvestments,
    sbnTotalPrincipal,
    sbnMonthlyNetYield,
    sbnTotalCollectedYield,
    sbnAccountAllocation,
    sbnMonthlyGrossYield,
} = storeToRefs(financeStore);

const selectedAccount = ref<string>('Danh Nguyen');

const activeData = computed(() => {
    if (selectedAccount.value === 'all') {
        const activeItems = sbnInvestments.value.filter((s) => s.active);
        const seriesNames = [...new Set(activeItems.map((s) => s.series))].join(' / ');
        const primary = activeItems[0];

        return {
            label: 'Total SBN Reserve',
            series: seriesNames || 'SR022',
            couponRate: primary?.couponRatePct || 6.45,
            principal: sbnTotalPrincipal.value,
            monthlyGross: sbnMonthlyGrossYield.value,
            monthlyNet: sbnMonthlyNetYield.value,
            collected: sbnTotalCollectedYield.value,
            activeCount: activeItems.length,
            payoutDay: primary?.payoutDayOfMonth || 10,
            issueDate: primary?.issueDate,
            maturityDate: primary?.maturityDate,
        };
    }

    const acc = sbnAccountAllocation.value.find((a) => a.owner === selectedAccount.value);
    const seriesNames = [...new Set((acc?.investments || []).map((s) => s.series))].join(' / ');
    const primary = acc?.investments[0];

    return {
        label: `${acc?.label || 'Account'} Holdings`,
        series: seriesNames || 'None',
        couponRate: primary?.couponRatePct || 6.45,
        principal: acc?.principalAmount || 0,
        monthlyGross: acc?.monthlyGrossYield || 0,
        monthlyNet: acc?.monthlyNetYield || 0,
        collected: acc?.totalCollectedYield || 0,
        activeCount: acc?.activeCount || 0,
        payoutDay: primary?.payoutDayOfMonth || 10,
        issueDate: primary?.issueDate,
        maturityDate: primary?.maturityDate,
    };
});
const maturity = computed(() =>
    calculateSbnMaturity(activeData.value.issueDate, activeData.value.maturityDate)
);
</script>

<template>
    <div
        class="flex flex-col justify-between rounded-md border border-mist-800 bg-mist-900 p-4 shadow-lg">
        <div>
            <!-- Header Tag -->
            <div class="mb-4 flex h-7 items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                    <span class="h-2.5 w-2.5 rounded-full bg-emerald-400"></span>
                    <h3 class="text-xs font-semibold tracking-wider text-mist-400 uppercase">
                        SBN Investment
                    </h3>
                </div>
                <span
                    class="rounded bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-300">
                    Fixed Coupon {{ activeData.couponRate }}% p.a.
                </span>
            </div>

            <!-- Account Selector Tabs -->
            <div class="mb-3.5 flex items-center gap-1.5 border-b border-mist-800/60 pb-2 text-xs">
                <button
                    type="button"
                    class="cursor-pointer rounded px-2 py-0.5 font-mono text-[11px] transition"
                    :class="
                        selectedAccount === 'all'
                            ? 'border border-emerald-400/30 bg-emerald-400/20 text-emerald-300'
                            : 'text-mist-400 hover:text-mist-200'
                    "
                    @click="selectedAccount = 'all'">
                    All
                </button>
                <button
                    v-for="acc in sbnAccountAllocation"
                    :key="acc.owner"
                    type="button"
                    class="cursor-pointer rounded px-2 py-0.5 font-mono text-[11px] transition"
                    :class="
                        selectedAccount === acc.owner
                            ? 'border border-mist-700 bg-mist-800 text-emerald-300'
                            : 'text-mist-400 hover:text-mist-200'
                    "
                    @click="selectedAccount = acc.owner">
                    {{ acc.label }}
                </button>
            </div>
            <!-- Virtual Bond Display -->
            <div
                class="relative mb-4 space-y-6 overflow-hidden rounded-md bg-mist-800/50 p-4 font-mono">
                <div class="flex items-start justify-between">
                    <div>
                        <span class="block text-xs text-mist-400 uppercase">Series</span>
                        <span class="text-xs font-semibold tracking-wider text-emerald-400">
                            {{ activeData.series }}
                        </span>
                    </div>
                    <div class="text-right">
                        <span class="block text-xs text-mist-400">Coupon Payout</span>
                        <span class="text-xs font-semibold text-mist-200">
                            Day {{ activeData.payoutDay }} of month
                        </span>
                    </div>
                </div>
                <!-- Progress Bar -->
                <div class="space-y-1.5">
                    <div class="flex justify-between font-mono text-xs text-mist-400">
                        <span>Maturity Progress</span>
                        <span class="text-mist-200">
                            {{ maturity.progressPct }}% ({{ maturity.monthsLeft }}
                            months left)
                        </span>
                    </div>
                    <div class="h-1.5 w-full overflow-hidden rounded-full bg-mist-950/50">
                        <div
                            class="h-full bg-emerald-500 transition-all duration-500"
                            :style="{ width: `${maturity.progressPct}%` }"></div>
                    </div>
                </div>

                <div class="flex items-baseline justify-between font-mono">
                    <div>
                        <span class="block text-xs text-mist-400">Total Principal</span>
                        <div class="mt-0.5 text-lg font-black tracking-tight text-mist-100">
                            {{ formatIDR(activeData.principal) }}
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="text-sm font-semibold text-emerald-400">
                            +{{ formatIDR(activeData.monthlyNet) }} / month
                        </div>
                        <span class="text-xs text-mist-400">Net after 10% tax</span>
                    </div>
                </div>

                <div
                    class="grid grid-cols-2 gap-2 border-t border-mist-700/50 pt-2.5 font-mono text-xs">
                    <div>
                        <span class="block text-[11px] text-mist-400">Monthly Gross Yield:</span>
                        <span class="font-semibold text-mist-300">
                            {{ formatIDR(activeData.monthlyGross) }}
                        </span>
                    </div>
                    <div class="text-right">
                        <span class="block text-[11px] text-mist-400">Total Collected Yield:</span>
                        <span class="font-semibold text-emerald-400">
                            {{ formatIDR(activeData.collected) }}
                        </span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Metric Footer -->
        <div
            class="mt-3 flex items-center justify-between border-t border-mist-800 pt-3 font-mono text-xs">
            <span class="text-mist-400">
                Asset: <strong class="text-mist-200">Government Sukuk</strong>
            </span>
            <span class="text-mist-400">
                Status: <strong class="text-emerald-400">Active</strong>
            </span>
        </div>
    </div>
</template>
