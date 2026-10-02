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
        class="flex flex-col justify-between rounded-md border border-mist-800 bg-mist-900 p-4 shadow-lg">
        <div>
            <!-- Header Tag -->
            <div class="mb-4 flex h-7 items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                    <span class="h-2.5 w-2.5 rounded-full bg-amber-300"></span>
                    <h3 class="text-xs font-semibold tracking-wider text-mist-400 uppercase">
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
                        class="rounded-md bg-amber-300 px-3 py-2 text-xs font-semibold text-mist-950 transition hover:bg-amber-400"
                        @click="openAddGoldModal">
                        + Add Gold
                    </button>
                </div>
            </div>

            <div v-if="activeView === 'info'">
                <!-- Account Selector Tabs -->
                <div
                    class="mb-3.5 flex items-center gap-1.5 border-b border-mist-800/60 pb-2 text-xs">
                    <button
                        type="button"
                        class="cursor-pointer rounded px-2 py-0.5 font-mono text-[11px] transition"
                        :class="
                            selectedAccount === 'all'
                                ? 'border border-amber-400/30 bg-amber-400/20 text-amber-300'
                                : 'text-mist-400 hover:text-mist-200'
                        "
                        @click="selectedAccount = 'all'">
                        All ({{ totalGoldGrams }}g)
                    </button>
                    <button
                        v-for="acc in goldAccountAllocation"
                        :key="acc.owner"
                        type="button"
                        class="cursor-pointer rounded px-2 py-0.5 font-mono text-[11px] transition"
                        :class="
                            selectedAccount === acc.owner
                                ? 'border border-mist-700 bg-mist-800 text-amber-300'
                                : 'text-mist-400 hover:text-mist-200'
                        "
                        @click="selectedAccount = acc.owner">
                        {{ acc.label }} ({{ acc.weightGrams }}g)
                    </button>
                </div>
                <!-- Virtual Gold Ingot Display -->
                <div
                    class="relative mb-4 space-y-6 overflow-hidden rounded-md bg-mist-800/50 p-4 font-mono">
                    <div class="flex items-start justify-between">
                        <div>
                            <span class="block text-xs text-mist-400 uppercase">
                                {{ activeData.label }} Holdings
                            </span>
                            <span class="text-xs font-semibold tracking-wider text-amber-300">
                                {{ activeData.brands.map((b) => b.brand).join(' / ') || 'None' }}
                            </span>
                        </div>
                        <div class="text-right">
                            <div class="-my-1 flex items-center justify-end gap-1.5">
                                <div
                                    class="flex items-center justify-end gap-1.5 text-xs text-mist-400">
                                    <span
                                        class="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400">
                                    </span>
                                    Antam Live
                                </div>
                                <button
                                    type="button"
                                    :disabled="isFetchingGoldPrice"
                                    class="cursor-pointer text-mist-500 transition hover:text-amber-300"
                                    @click="handleRefreshGoldPrice">
                                    <fa-icon
                                        icon="arrows-rotate"
                                        class="mb-0.5 text-[10px]"
                                        :class="{
                                            'animate-spin text-amber-300': isFetchingGoldPrice,
                                        }" />
                                </button>
                            </div>
                            <span class="text-xs font-semibold tracking-wider text-mist-300">
                                {{ formatIDR(currentGoldPricePerGram) }}/g
                            </span>
                        </div>
                    </div>
                    <!-- Horizontal Stacked Bar -->
                    <div class="space-y-1.5">
                        <div class="flex justify-between font-mono text-xs text-mist-400">
                            <span>Brand Allocation</span>
                            <div class="flex items-center gap-2 text-mist-200">
                                <span
                                    v-for="b in activeData.brands"
                                    :key="b.brand"
                                    class="flex items-center gap-1">
                                    <span
                                        class="h-1.5 w-1.5 rounded-full"
                                        :style="{ backgroundColor: b.color }"></span>
                                    {{ b.pctOfTotal }}% {{ b.brand }}
                                </span>
                            </div>
                        </div>
                        <!-- Segmented Stack Bar -->
                        <div class="flex h-1.5 w-full overflow-hidden rounded-full bg-mist-950">
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
                            <span class="block text-xs text-mist-400">Current Valuation</span>
                            <div class="mt-0.5 text-lg font-black tracking-tight text-mist-100">
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
                        class="border-mist-750/70 mt-3 grid grid-cols-2 gap-2 border-t pt-3 font-mono text-xs">
                        <div>
                            <span class="block text-[11px] text-mist-400">Cost Basis:</span>
                            <span class="font-semibold text-mist-300">
                                {{ formatIDR(activeData.costBasis) }}
                            </span>
                        </div>
                        <div class="text-right">
                            <span class="block text-[11px] text-mist-400"> Unrealized P&L: </span>
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
                <table class="w-full table-fixed border-collapse text-left text-xs text-mist-200">
                    <thead
                        class="border-y border-mist-800 bg-mist-950/50 font-semibold text-mist-400 uppercase">
                        <tr>
                            <th class="w-25 px-3 py-2.5">Date</th>
                            <th class="w-26 px-3 py-2.5">Owner</th>
                            <th class="px-3 py-2.5">Type</th>
                            <th class="px-3 py-2.5 text-right">Cost Basis</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-mist-800/60 font-mono">
                        <tr
                            v-for="g in goldAssets"
                            :key="g.id"
                            class="cursor-pointer hover:bg-mist-800/50"
                            @click="openEditGoldModal(g)">
                            <td class="px-3 py-2 text-mist-400">
                                {{ g.purchaseDate }}
                            </td>
                            <td class="px-3 py-2">
                                <span class="font-medium text-mist-100">
                                    {{ g.owner }}
                                </span>
                            </td>
                            <td class="px-3 py-2">
                                <span class="text-mist-400">{{ g.type }}</span> &bull;
                                <span class="text-amber-300">{{ g.weightGrams }}g</span>
                            </td>
                            <td class="px-3 py-2 text-mist-300">
                                <div class="flex items-baseline justify-end gap-2">
                                    <span class="mb-1 block text-nowrap">
                                        {{ formatIDR(g.buyPriceTotal) }}
                                    </span>
                                    <span
                                        class="transition-color py-1 pl-1 text-mist-400 hover:text-amber-300">
                                        <fa-icon
                                            class="text-xs"
                                            icon="pen-to-square" />
                                    </span>
                                </div>
                            </td>
                        </tr>
                        <tr
                            v-if="goldAssets.length === 0"
                            class="">
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
            class="flex items-center justify-between border-t border-mist-800/80 pt-3 font-mono text-xs">
            <span class="text-mist-400">
                Avg Cost:
                <strong class="font-mono text-mist-200">
                    {{
                        activeData.grams > 0
                            ? formatIDR(Math.round(activeData.costBasis / activeData.grams))
                            : 0
                    }}/g
                </strong>
            </span>
            <span class="text-mist-400">
                Status: <strong class="font-mono text-amber-300">Secured</strong>
            </span>
        </div>

        <!-- Add Gold Modal -->
        <AddGoldModal
            v-model="isGoldModalOpen"
            :item-to-edit="editingGoldItem"
            @closed="editingGoldItem = null" />
    </div>
</template>
