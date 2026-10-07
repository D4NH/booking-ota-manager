<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { calculateSbnMaturity } from '@/utils/finance';
import { formatIDR } from '@/utils/money';
import type { PersonalOwner } from '@/types/finance';

interface Props {
    owner?: PersonalOwner | 'Shared';
}

const { owner = 'Danh Nguyen' } = defineProps<Props>();

const financeStore = useFinanceStore();
const { sbnAccountAllocation } = storeToRefs(financeStore);

const activeData = computed(() => {
    const acc = sbnAccountAllocation.value.find((a) => a.owner === owner);
    const seriesNames = [...new Set((acc?.investments || []).map((s) => s.series))].join(' / ');
    const primary = acc?.investments[0];

    return {
        label: `${acc?.label || owner} Holdings`,
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
            <div class="mb-4 flex h-7 items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                    <span class="h-2.5 w-2.5 rounded-full bg-teal-400" />
                    <h3 class="text-xs font-semibold tracking-wider text-mist-400 uppercase">
                        SBN Investment
                    </h3>
                </div>
                <span
                    class="flex items-center gap-1.5 rounded border border-mist-700 bg-mist-800 px-2 py-1.5 text-xs font-semibold text-teal-300">
                    Coupon {{ activeData.couponRate }}% p.a.
                </span>
            </div>

            <div
                class="relative mb-4 space-y-5 overflow-hidden rounded-md bg-mist-800/50 p-4 font-mono">
                <div class="flex items-start justify-between">
                    <div>
                        <span class="block text-[10px] tracking-wider text-mist-400 uppercase"
                            >Series</span
                        >
                        <span class="text-xs font-semibold tracking-wider text-teal-400">
                            {{ activeData.series }}
                        </span>
                    </div>
                    <div class="text-right">
                        <span class="block text-[10px] tracking-wider text-mist-400 uppercase"
                            >Coupon Payout</span
                        >
                        <span class="text-xs font-semibold text-mist-200">
                            Day {{ activeData.payoutDay }} of month
                        </span>
                    </div>
                </div>

                <div class="space-y-1.5">
                    <div class="flex justify-between font-mono text-xs text-mist-400">
                        <span>Maturity Progress</span>
                        <span class="text-mist-200">
                            {{ maturity.progressPct }}% ({{ maturity.monthsLeft }} months left)
                        </span>
                    </div>
                    <div class="h-1.5 w-full overflow-hidden rounded-full bg-mist-950/50">
                        <div
                            class="h-full bg-teal-500 transition-all duration-500"
                            :style="{ width: `${maturity.progressPct}%` }" />
                    </div>
                </div>

                <div class="flex items-baseline justify-between font-mono">
                    <div>
                        <span class="block text-[10px] tracking-wider text-mist-400 uppercase"
                            >Principal</span
                        >
                        <div class="mt-0.5 text-lg font-black tracking-tight text-mist-100">
                            {{ formatIDR(activeData.principal) }}
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="text-sm font-semibold text-teal-400">
                            +{{ formatIDR(activeData.monthlyNet) }}/mo
                        </div>
                        <span class="text-[10px] text-mist-400">Net after 10% tax</span>
                    </div>
                </div>

                <div
                    class="grid grid-cols-2 gap-2 border-t border-mist-700/50 pt-2.5 font-mono text-xs">
                    <div>
                        <span class="block text-[10px] text-mist-400">Monthly Gross:</span>
                        <span class="font-semibold text-mist-300">
                            {{ formatIDR(activeData.monthlyGross) }}
                        </span>
                    </div>
                    <div class="text-right">
                        <span class="block text-[10px] text-mist-400">Collected Yield:</span>
                        <span class="font-semibold text-teal-400">
                            {{ formatIDR(activeData.collected) }}
                        </span>
                    </div>
                </div>
            </div>
        </div>

        <div
            class="mt-3 flex items-center justify-between border-t border-mist-800 pt-3 font-mono text-xs">
            <span class="text-mist-400">
                Scope: <strong class="text-mist-200">{{ activeData.label }}</strong>
            </span>
            <span class="text-mist-400">
                Status: <strong class="text-teal-400">Active</strong>
            </span>
        </div>
    </div>
</template>
