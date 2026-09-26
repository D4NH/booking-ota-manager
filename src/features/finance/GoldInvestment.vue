<script setup lang="ts">
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { formatIDR } from '@/utils/money';

import AddGoldModal from '@/features/finance/AddGoldModal.vue';

const financeStore = useFinanceStore();
const {
    goldAssets,
    totalGoldGrams,
    totalGoldCostBasis,
    estimatedGoldMarketValue,
    goldUnrealizedPnL,
    goldPnLPct,
    currentGoldPricePerGram,
} = storeToRefs(financeStore);

const isGoldModalOpen = ref(false);
const activeView = ref<'info' | 'logs'>('info');

const goldBrands = computed(() =>
    [...new Set(goldAssets.value.map((g) => g.type))].sort().join(' / ')
);
</script>

<template>
    <div
        class="bg-mist-900 border border-mist-800 rounded-md p-4 shadow-lg flex flex-col justify-between">
        <div>
            <!-- Header Tag -->
            <div class="flex items-center justify-between gap-2 mb-4 h-7">
                <div class="flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full bg-amber-300"></span>
                    <h3 class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                        Gold Reserve
                    </h3>
                </div>

                <div class="flex items-center gap-2">
                    <!-- Toggle Buttons -->
                    <div
                        class="flex items-center rounded-md border border-mist-800 bg-mist-950/50 p-0.5 text-xs">
                        <button
                            type="button"
                            class="cursor-pointer rounded-md px-3 py-1.5 transition"
                            :class="[
                                activeView === 'info'
                                    ? 'bg-mist-800 text-amber-300 shadow-sm'
                                    : 'text-mist-400 hover:text-mist-200',
                            ]"
                            @click="activeView = 'info'">
                            Info
                        </button>
                        <button
                            type="button"
                            class="cursor-pointer rounded-md px-3 py-1.5 transition"
                            :class="[
                                activeView === 'logs'
                                    ? 'bg-mist-800 text-amber-300 shadow-sm'
                                    : 'text-mist-400 hover:text-mist-200',
                            ]"
                            @click="activeView = 'logs'">
                            Cert
                        </button>
                    </div>
                    <button
                        v-if="activeView === 'logs'"
                        class="bg-amber-300 hover:bg-amber-400 text-mist-950 text-xs font-semibold px-3 py-2 rounded-md transition"
                        @click="isGoldModalOpen = true">
                        + Add Gold
                    </button>
                </div>
            </div>

            <div v-if="activeView === 'info'">
                <!-- Virtual Gold Ingot Display -->
                <div class="relative overflow-hidden rounded-md p-4 mb-4 bg-mist-800/50 space-y-6">
                    <div class="flex justify-between items-start">
                        <div>
                            <span class="text-xs text-mist-400 uppercase font-mono block">
                                Physical Holding
                            </span>
                            <span class="text-xs font-bold text-amber-300 font-mono tracking-wider">
                                {{ goldBrands }}
                            </span>
                        </div>
                        <div class="text-right">
                            <span class="text-xs text-mist-400 block">Benchmark:</span>
                            <span class="text-xs font-mono font-bold text-mist-200">
                                {{ formatIDR(currentGoldPricePerGram) }}/g
                            </span>
                        </div>
                    </div>

                    <!-- Horizontal Stacked Bar -->
                    <div class="space-y-1.5">
                        <div class="flex justify-between text-[11px] font-mono text-mist-400">
                            <span> Allocation</span>
                            <span class="font-mono text-mist-200">67% Semar · 33% UBS</span>
                        </div>
                        <div class="flex h-1.5 w-full overflow-hidden rounded-full bg-mist-800">
                            <div
                                class="h-full bg-amber-400"
                                style="width: 67%"></div>
                            <div
                                class="h-full bg-amber-600"
                                style="width: 33%"></div>
                        </div>
                    </div>

                    <div class="flex items-baseline justify-between h-15">
                        <div>
                            <span class="text-xs text-mist-400 block"> Current Valuation </span>
                            <div
                                class="text-lg font-black font-mono text-mist-100 tracking-tight mt-1">
                                {{ formatIDR(estimatedGoldMarketValue) }}
                            </div>
                        </div>
                        <div class="text-right font-mono">
                            <div class="text-lg font-bold text-amber-300">
                                {{ totalGoldGrams.toFixed(2) }}g
                            </div>
                            <span class="text-xs text-mist-400">
                                {{ goldAssets.length }} certificate(s)
                            </span>
                        </div>
                    </div>

                    <div
                        class="grid grid-cols-2 gap-2 pt-3 mt-3 border-t border-mist-750/70 text-[11px] font-mono">
                        <div>
                            <span class="text-mist-400 text-xs block">Cost Basis:</span>
                            <span class="text-mist-300 font-bold">
                                {{ formatIDR(totalGoldCostBasis) }}
                            </span>
                        </div>
                        <div class="text-right">
                            <span class="text-mist-400 text-xs block"> Unrealized P&L: </span>
                            <span
                                class="font-bold"
                                :class="
                                    goldUnrealizedPnL >= 0 ? 'text-amber-300' : 'text-rose-400'
                                ">
                                {{ goldUnrealizedPnL >= 0 ? '+' : ''
                                }}{{ formatIDR(goldUnrealizedPnL) }} ({{ goldPnLPct }}%)
                            </span>
                        </div>
                    </div>
                </div>
                <!-- Gram Weight Distribution Indicators -->
                <!-- <div class="space-y-1.5 mb-3">
                    <div class="flex justify-end text-[11px] font-mono text-mist-400">
                        <span class="text-mist-200">Total Net Weight: {{ totalGoldGrams }}g</span>
                    </div>
                </div> -->
            </div>
            <div
                v-else
                class="overflow-x-auto">
                <table class="w-full text-left text-xs text-mist-200">
                    <thead
                        class="bg-mist-800 text-mist-400 uppercase font-semibold border-y border-mist-800">
                        <tr>
                            <th class="py-2.5 px-3">Date</th>
                            <th class="py-2.5 px-3">Type</th>
                            <th class="py-2.5 px-3">Owner</th>
                            <th class="py-2.5 px-3 text-right">Weight</th>
                            <th class="py-2.5 px-3 text-right">Cost Basis</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-mist-800/60 font-mono">
                        <tr
                            v-for="g in goldAssets"
                            :key="g.id"
                            class="hover:bg-mist-800/50">
                            <td class="py-2.5 px-3 text-mist-400">{{ g.purchaseDate }}</td>
                            <td class="py-2.5 px-3 font-semibold text-mist-100">
                                {{ g.type }}
                            </td>
                            <td class="py-2.5 px-3">{{ g.owner }}</td>
                            <td class="py-2.5 px-3 text-right font-semibold text-amber-300">
                                {{ g.weightGrams }}g
                            </td>
                            <td class="py-2.5 px-3 text-right text-mist-300">
                                {{ formatIDR(g.buyPriceTotal) }}
                            </td>
                        </tr>
                        <tr v-if="goldAssets.length === 0">
                            <td
                                colspan="5"
                                class="py-6 text-center text-mist-400">
                                No gold holdings recorded.
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
        <!-- Metric Footer -->
        <div
            class="pt-3 border-t border-mist-800/80 flex items-center justify-between text-xs font-mono">
            <span class="text-mist-400">
                Avg Cost:
                <strong class="text-mist-200 font-mono">
                    {{
                        totalGoldGrams > 0
                            ? formatIDR(Math.round(totalGoldCostBasis / totalGoldGrams))
                            : 0
                    }}/g
                </strong>
            </span>
            <span class="text-mist-400">
                Status: <strong class="text-amber-300 font-mono">Secured</strong>
            </span>
        </div>

        <!-- Add Gold Modal -->
        <AddGoldModal v-model="isGoldModalOpen" />
    </div>
</template>
