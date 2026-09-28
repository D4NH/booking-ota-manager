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
        class="bg-mist-900 border border-mist-800 rounded-md p-4 shadow-lg flex flex-col justify-between">
        <div>
            <!-- Header Tag -->
            <div class="flex items-center justify-between gap-2 mb-4 h-7">
                <div class="flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                    <h3 class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                        SBN Investment
                    </h3>
                </div>
                <span
                    class="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 font-semibold">
                    Fixed Coupon {{ activeData.couponRate }}% p.a.
                </span>
            </div>

            <!-- Account Selector Tabs -->
            <div class="flex items-center gap-1.5 mb-3.5 pb-2 border-b border-mist-800/60 text-xs">
                <button
                    type="button"
                    class="px-2 py-0.5 rounded text-[11px] font-mono transition cursor-pointer"
                    :class="
                        selectedAccount === 'all'
                            ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30'
                            : 'text-mist-400 hover:text-mist-200'
                    "
                    @click="selectedAccount = 'all'">
                    All ({{ formatIDR(sbnTotalPrincipal) }})
                </button>
                <button
                    v-for="acc in sbnAccountAllocation"
                    :key="acc.owner"
                    type="button"
                    class="px-2 py-0.5 rounded text-[11px] font-mono transition cursor-pointer"
                    :class="
                        selectedAccount === acc.owner
                            ? 'bg-mist-800 text-emerald-300 border border-mist-700'
                            : 'text-mist-400 hover:text-mist-200'
                    "
                    @click="selectedAccount = acc.owner">
                    {{ acc.label }}
                </button>
            </div>
            <!-- Virtual Bond Display -->
            <div
                class="relative overflow-hidden rounded-md p-4 mb-4 bg-mist-800/50 space-y-6 font-mono">
                <div class="flex justify-between items-start">
                    <div>
                        <span class="text-xs text-mist-400 uppercase block">Series</span>
                        <span class="text-xs font-semibold text-emerald-400 tracking-wider">
                            {{ activeData.series }}
                        </span>
                    </div>
                    <div class="text-right">
                        <span class="text-mist-400 block text-xs">Coupon Payout</span>
                        <span class="font-semibold text-xs text-mist-200">
                            Day {{ activeData.payoutDay }} of month
                        </span>
                    </div>
                </div>
                <!-- Progress Bar -->
                <div class="space-y-1.5">
                    <div class="flex justify-between text-xs font-mono text-mist-400">
                        <span>Maturity Progress</span>
                        <span class="text-mist-200">
                            {{ maturity.progressPct }}% ({{ maturity.monthsLeft }}
                            months left)
                        </span>
                    </div>
                    <div class="w-full bg-mist-950/50 h-1.5 rounded-full overflow-hidden">
                        <div
                            class="h-full bg-emerald-500 transition-all duration-500"
                            :style="{ width: `${maturity.progressPct}%` }"></div>
                    </div>
                </div>

                <div class="flex items-baseline justify-between font-mono">
                    <div>
                        <span class="text-xs text-mist-400 block">Total Principal</span>
                        <div class="text-lg font-black text-mist-100 tracking-tight mt-0.5">
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
                    class="grid grid-cols-2 gap-2 pt-2.5 border-t border-mist-700/50 text-xs font-mono">
                    <div>
                        <span class="text-mist-400 block text-[11px]">Monthly Gross Yield:</span>
                        <span class="text-mist-300 font-semibold">
                            {{ formatIDR(activeData.monthlyGross) }}
                        </span>
                    </div>
                    <div class="text-right">
                        <span class="text-mist-400 block text-[11px]">Total Collected Yield:</span>
                        <span class="font-semibold text-emerald-400">
                            {{ formatIDR(activeData.collected) }}
                        </span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Metric Footer -->
        <div
            class="pt-3 mt-3 border-t border-mist-800 flex items-center justify-between text-xs font-mono">
            <span class="text-mist-400">
                Asset: <strong class="text-mist-200">Government Sukuk</strong>
            </span>
            <span class="text-mist-400">
                Status: <strong class="text-emerald-400">Active</strong>
            </span>
        </div>
    </div>
</template>
