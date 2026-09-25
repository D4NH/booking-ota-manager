<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { formatIDR } from '@/utils/money';
import { formatDate } from '@/utils/date';

const financeStore = useFinanceStore();
const { sbnInvestments, sbnTotalPrincipal, sbnMonthlyNetYield, sbnTotalCollectedYield } =
    storeToRefs(financeStore);

const primarySbn = computed(() => sbnInvestments.value[0]);
const maturityProgress = computed(() => {
    if (!primarySbn.value) return 0;
    const start = new Date(primarySbn.value.issueDate).getTime();
    const end = new Date(primarySbn.value.maturityDate).getTime();
    const now = Date.now();
    const elapsed = Math.max(0, now - start);
    const total = end - start;
    return Math.min(100, Math.round((elapsed / total) * 100));
});
const monthsRemaining = computed(() => {
    if (!primarySbn.value) return 0;
    const end = new Date(primarySbn.value.maturityDate);
    const now = new Date();
    return Math.max(
        0,
        (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth())
    );
});
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
                        SBN SR022 6.45%
                    </h3>
                </div>
                <!-- Toggle Buttons -->
                <div
                    class="flex items-center rounded-md border border-mist-800 bg-mist-950/50 p-0.5 text-xs"></div>
            </div>

            <!-- Virtual Government Bond Card Display -->
            <div class="relative overflow-hidden rounded-md p-4 mb-4 bg-mist-800/50">
                <div class="flex justify-between items-start mb-6">
                    <div>
                        <span class="text-xs text-mist-400 uppercase font-mono block">
                            Ministry of Finance
                        </span>
                        <span class="text-xs font-bold text-mist-100 font-mono tracking-wider">
                            SR022-T3 Syariah
                        </span>
                    </div>
                    <div
                        class="px-2 py-0.5 rounded text-xs font-mono font-medium bg-emerald-400/10 text-emerald-400">
                        100% APBN Guaranteed
                    </div>
                </div>

                <div>
                    <span class="text-xs text-mist-400 block"> Total Principal Investment </span>
                    <div class="text-lg font-black font-mono text-mist-100 tracking-tight mt-1">
                        {{ formatIDR(sbnTotalPrincipal) }}
                    </div>
                </div>

                <div
                    class="grid grid-cols-2 gap-2 pt-3 mt-3 border-t border-mist-750/70 text-[11px] font-mono">
                    <div>
                        <span class="text-mist-400 text-xs block"> Net Passive Income: </span>
                        <span class="text-emerald-400 font-bold">
                            +{{ formatIDR(sbnMonthlyNetYield) }} / month
                        </span>
                    </div>
                    <div class="text-right">
                        <span class="text-mist-400 text-xs block"> Maturity Date: </span>
                        <span
                            v-if="primarySbn"
                            class="text-mist-200 font-bold">
                            {{ formatDate(primarySbn.maturityDate, { includeYear: true }) }}</span
                        >
                    </div>
                </div>
            </div>

            <!-- Tenor Timeline Progress Bar -->
            <div class="space-y-1.5 mb-3">
                <div class="flex justify-between text-[11px] font-mono text-mist-400">
                    <span>Maturity Progress</span>
                    <span class="text-mist-200">
                        {{ maturityProgress }}% ({{ monthsRemaining }} months left)
                    </span>
                </div>
                <div class="w-full bg-mist-800 h-1.5 rounded-full overflow-hidden">
                    <div
                        class="h-full rounded-full bg-linear-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
                        :style="{ width: `${maturityProgress}%` }"></div>
                </div>
            </div>
        </div>

        <!-- Metric Footer -->
        <div
            class="pt-3 border-t border-mist-800/80 flex items-center justify-between text-xs font-mono">
            <span class="text-mist-400">
                Payout Day: <strong class="text-mist-200 font-mono">10th every month</strong>
            </span>
            <span class="text-mist-400">
                Collected:
                <strong class="text-mist-200 font-mono">
                    {{ formatIDR(sbnTotalCollectedYield) }}
                </strong>
            </span>
        </div>
    </div>
</template>
