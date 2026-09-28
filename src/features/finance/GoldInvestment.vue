<script setup lang="ts">
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { formatIDR } from '@/utils/money';
import type { GoldAsset } from '@/types/finance';

import AddGoldModal from '@/features/finance/AddGoldModal.vue';

const financeStore = useFinanceStore();
const {
    goldAssets,
    totalGoldGrams,
    totalGoldCostBasis,
    estimatedGoldMarketValue,
    goldUnrealizedPnL,
    goldPnLPct,
    goldBrandAllocation,
    goldAccountAllocation,
    currentGoldPricePerGram,
    isFetchingGoldPrice,
} = storeToRefs(financeStore);
const { fetchLiveGoldPrice } = financeStore;

const isGoldModalOpen = ref(false);
const activeView = ref<'info' | 'logs'>('info');
const selectedAccount = ref<string>('Danh Nguyen');
const editingGoldItem = ref<GoldAsset | null>(null);

const activeData = computed(() => {
    if (selectedAccount.value === 'all') {
        return {
            label: 'Total Reserve',
            grams: totalGoldGrams.value,
            valuation: estimatedGoldMarketValue.value,
            costBasis: totalGoldCostBasis.value,
            pnl: goldUnrealizedPnL.value,
            pnlPct: goldPnLPct.value,
            certCount: goldAssets.value.length,
            brands: goldBrandAllocation.value,
        };
    }

    const acc = goldAccountAllocation.value.find((a) => a.owner === selectedAccount.value);
    return {
        label: acc?.label || 'Account',
        grams: acc?.weightGrams || 0,
        valuation: acc?.valuation || 0,
        costBasis: acc?.buyPriceTotal || 0,
        pnl: acc?.unrealizedPnL || 0,
        pnlPct: acc?.pnLPct || 0,
        certCount: acc?.certificateCount || 0,
        brands: acc?.brands || [],
    };
});

function openAddGoldModal(): void {
    editingGoldItem.value = null;
    isGoldModalOpen.value = true;
}
function openEditGoldModal(item: GoldAsset): void {
    editingGoldItem.value = item;
    isGoldModalOpen.value = true;
}
async function handleRefreshGoldPrice() {
    await fetchLiveGoldPrice(true);
}
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
                        @click="openAddGoldModal">
                        + Add Gold
                    </button>
                </div>
            </div>

            <div v-if="activeView === 'info'">
                <!-- Account Selector Tabs -->
                <div
                    class="flex items-center gap-1.5 mb-3.5 pb-2 border-b border-mist-800/60 text-xs">
                    <button
                        type="button"
                        class="px-2 py-0.5 rounded text-[11px] font-mono transition cursor-pointer"
                        :class="
                            selectedAccount === 'all'
                                ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                                : 'text-mist-400 hover:text-mist-200'
                        "
                        @click="selectedAccount = 'all'">
                        All ({{ totalGoldGrams }}g)
                    </button>
                    <button
                        v-for="acc in goldAccountAllocation"
                        :key="acc.owner"
                        type="button"
                        class="px-2 py-0.5 rounded text-[11px] font-mono transition cursor-pointer"
                        :class="
                            selectedAccount === acc.owner
                                ? 'bg-mist-800 text-amber-300 border border-mist-700'
                                : 'text-mist-400 hover:text-mist-200'
                        "
                        @click="selectedAccount = acc.owner">
                        {{ acc.label }} ({{ acc.weightGrams }}g)
                    </button>
                </div>
                <!-- Virtual Gold Ingot Display -->
                <div
                    class="relative overflow-hidden rounded-md p-4 mb-4 bg-mist-800/50 space-y-6 font-mono">
                    <div class="flex justify-between items-start">
                        <div>
                            <span class="text-xs text-mist-400 uppercase block">
                                {{ activeData.label }} Holdings
                            </span>
                            <span class="text-xs font-semibold text-amber-300 tracking-wider">
                                {{ activeData.brands.map((b) => b.brand).join(' / ') || 'None' }}
                            </span>
                        </div>
                        <div class="text-right">
                            <div class="flex items-center justify-end gap-1.5 -my-1">
                                <div
                                    class="flex items-center justify-end gap-1.5 text-xs text-mist-400">
                                    <span
                                        class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse">
                                    </span>
                                    Antam Live
                                </div>
                                <button
                                    type="button"
                                    :disabled="isFetchingGoldPrice"
                                    class="text-mist-500 hover:text-amber-300 transition cursor-pointer"
                                    @click="handleRefreshGoldPrice">
                                    <fa-icon
                                        icon="arrows-rotate"
                                        class="text-[10px] mb-0.5"
                                        :class="{
                                            'animate-spin text-amber-300': isFetchingGoldPrice,
                                        }" />
                                </button>
                            </div>
                            <span class="text-xs font-semibold text-mist-300 tracking-wider">
                                {{ formatIDR(currentGoldPricePerGram) }}/g
                            </span>
                        </div>
                    </div>
                    <!-- Horizontal Stacked Bar -->
                    <div class="space-y-1.5">
                        <div class="flex justify-between text-xs font-mono text-mist-400">
                            <span>Brand Allocation</span>
                            <div class="flex items-center gap-2 text-mist-200">
                                <span
                                    v-for="b in activeData.brands"
                                    :key="b.brand"
                                    class="flex items-center gap-1">
                                    <span
                                        class="w-1.5 h-1.5 rounded-full"
                                        :style="{ backgroundColor: b.color }"></span>
                                    {{ b.pctOfTotal }}% {{ b.brand }}
                                </span>
                            </div>
                        </div>
                        <!-- Segmented Stack Bar -->
                        <div class="w-full bg-mist-950 h-1.5 rounded-full overflow-hidden flex">
                            <div
                                v-for="b in activeData.brands"
                                :key="b.brand"
                                class="h-full transition-all duration-500"
                                :style="{ width: `${b.pctOfTotal}%`, backgroundColor: b.color }"
                                :title="`${b.brand}: ${b.weightGrams}g (${b.pctOfTotal}%)`"></div>
                        </div>
                    </div>

                    <div class="flex items-baseline justify-between font-mono">
                        <div>
                            <span class="text-xs text-mist-400 block">Current Valuation</span>
                            <div class="text-lg font-black text-mist-100 tracking-tight mt-0.5">
                                {{ formatIDR(activeData.valuation) }}
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="text-sm font-semibold text-amber-300">
                                {{ activeData.grams.toFixed(0) }}g
                            </div>
                            <span class="text-xs text-mist-400">
                                {{ activeData.certCount }} certificate(s)
                            </span>
                        </div>
                    </div>

                    <div
                        class="grid grid-cols-2 gap-2 pt-3 mt-3 border-t border-mist-750/70 text-xs font-mono">
                        <div>
                            <span class="text-mist-400 text-[11px] block">Cost Basis:</span>
                            <span class="text-mist-300 font-semibold">
                                {{ formatIDR(activeData.costBasis) }}
                            </span>
                        </div>
                        <div class="text-right">
                            <span class="text-mist-400 text-[11px] block"> Unrealized P&L: </span>
                            <span
                                class="font-semibold"
                                :class="activeData.pnl >= 0 ? 'text-amber-300' : 'text-rose-400'">
                                {{ activeData.pnl >= 0 ? '+' : ''
                                }}{{ formatIDR(activeData.pnl) }} ({{ activeData.pnlPct }}%)
                            </span>
                        </div>
                    </div>
                </div>
            </div>
            <div
                v-else
                class="overflow-x-auto">
                <table class="w-full text-left text-xs text-mist-200 table-fixed border-collapse">
                    <thead
                        class="bg-mist-950/50 text-mist-400 uppercase font-semibold border-y border-mist-800">
                        <tr>
                            <th class="w-25 py-2.5 px-3">Date</th>
                            <th class="w-26 py-2.5 px-3">Owner</th>
                            <th class="py-2.5 px-3">Type</th>
                            <th class="py-2.5 px-3 text-right">Cost Basis</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-mist-800/60 font-mono">
                        <tr
                            v-for="g in goldAssets"
                            :key="g.id"
                            class="hover:bg-mist-800/50 align-middle cursor-pointer"
                            @click="openEditGoldModal(g)">
                            <td class="py-2 px-3 text-mist-400 align-middle">
                                {{ g.purchaseDate }}
                            </td>
                            <td class="py-2 px-3 align-middle">
                                <span class="font-medium text-mist-100">
                                    {{ g.owner }}
                                </span>
                            </td>
                            <td class="py-2 px-3 align-middle">
                                <span class="text-mist-400">{{ g.type }}</span> &bull;
                                <span class="text-amber-300">{{ g.weightGrams }}g</span>
                            </td>
                            <td class="py-2 px-3 text-mist-300 align-middle">
                                <div class="flex items-baseline justify-end gap-2">
                                    <span class="block mb-1 text-nowrap">
                                        {{ formatIDR(g.buyPriceTotal) }}
                                    </span>
                                    <span
                                        class="text-mist-400 hover:text-amber-300 pl-1 py-1 transition-color">
                                        <fa-icon
                                            class="text-xs"
                                            icon="pen-to-square" />
                                    </span>
                                </div>
                            </td>
                        </tr>
                        <tr
                            v-if="goldAssets.length === 0"
                            class="align-middle">
                            <td
                                colspan="5"
                                class="py-6 text-center text-mist-400 align-middle">
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
                        activeData.grams > 0
                            ? formatIDR(Math.round(activeData.costBasis / activeData.grams))
                            : 0
                    }}/g
                </strong>
            </span>
            <span class="text-mist-400">
                Status: <strong class="text-amber-300 font-mono">Secured</strong>
            </span>
        </div>

        <!-- Add Gold Modal -->
        <AddGoldModal
            v-model="isGoldModalOpen"
            :item-to-edit="editingGoldItem"
            @closed="editingGoldItem = null" />
    </div>
</template>
