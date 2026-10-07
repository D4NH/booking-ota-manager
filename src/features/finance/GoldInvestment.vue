<script setup lang="ts">
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { formatIDR } from '@/utils/money';
import type { GoldAsset, PersonalOwner } from '@/types/finance';
import AddGoldModal from '@/features/finance/AddGoldModal.vue';

interface Props {
    owner?: PersonalOwner | 'Shared';
}

const { owner = 'Danh Nguyen' } = defineProps<Props>();

const financeStore = useFinanceStore();
const { goldAssets, goldAccountAllocation, currentGoldPricePerGram, isFetchingGoldPrice } =
    storeToRefs(financeStore);
const { fetchLiveGoldPrice } = financeStore;

const isGoldModalOpen = ref<boolean>(false);
const activeView = ref<'info' | 'cert'>('info');
const editingGoldItem = ref<GoldAsset | null>(null);

const scopedGoldAssets = computed<GoldAsset[]>(() => {
    return (goldAssets.value || []).filter((g) => g.owner === owner);
});
const activeData = computed(() => {
    const acc = goldAccountAllocation.value.find((a) => a.owner === owner);
    return {
        label: `${acc?.label || owner} Holdings`,
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
async function handleRefreshGoldPrice(): Promise<void> {
    await fetchLiveGoldPrice(true);
}
function handleCloseModal(): void {
    editingGoldItem.value = null;
}
</script>

<template>
    <div
        class="flex flex-col justify-between rounded-md border border-mist-800 bg-mist-900 p-4 shadow-lg">
        <div>
            <div class="mb-4 flex h-7 items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                    <span class="h-2.5 w-2.5 rounded-full bg-amber-300" />
                    <h3 class="text-xs font-semibold tracking-wider text-mist-400 uppercase">
                        Gold Reserve
                    </h3>
                </div>

                <div class="flex items-center gap-2">
                    <div
                        class="flex items-center rounded-md border border-mist-800 bg-mist-950/50 p-0.5 text-xs">
                        <button
                            type="button"
                            class="cursor-pointer rounded-xs px-3 py-1 transition"
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
                            class="cursor-pointer rounded-md px-3 py-1 transition"
                            :class="[
                                activeView === 'cert'
                                    ? 'bg-mist-800 text-amber-300 shadow-sm'
                                    : 'text-mist-400 hover:text-mist-200',
                            ]"
                            @click="activeView = 'cert'">
                            Cert
                        </button>
                    </div>

                    <button
                        type="button"
                        class="flex items-center rounded-md border border-mist-800 bg-mist-950/50 p-0.5 text-xs"
                        @click="openAddGoldModal">
                        <span
                            class="cursor-pointer rounded-xs bg-mist-800 py-1 pr-3 pl-2 font-semibold text-amber-300 transition hover:bg-mist-700">
                            <fa-icon
                                class="mr-1"
                                icon="plus" />
                            Add Gold
                        </span>
                    </button>
                </div>
            </div>

            <div v-if="activeView === 'info'">
                <div
                    class="relative mb-4 space-y-5 overflow-hidden rounded-md bg-mist-800/50 p-4 font-mono">
                    <div class="flex items-start justify-between">
                        <div>
                            <span class="block text-xs tracking-wider text-mist-400 uppercase">
                                {{ activeData.label }}
                            </span>
                            <span class="text-xs font-semibold tracking-wider text-amber-300">
                                {{ activeData.brands.map((b) => b.brand).join(' / ') || 'None' }}
                            </span>
                        </div>
                        <div class="text-right">
                            <div
                                class="flex items-center justify-end gap-1.5 text-xs text-mist-400">
                                <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
                                <span>Antam Live</span>
                                <button
                                    type="button"
                                    :disabled="isFetchingGoldPrice"
                                    class="cursor-pointer text-mist-500 transition hover:text-amber-300"
                                    @click="handleRefreshGoldPrice">
                                    <fa-icon
                                        icon="arrows-rotate"
                                        class="mt-01 text-xs"
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
                                        :style="{ backgroundColor: b.color }" />
                                    {{ b.pctOfTotal }}% {{ b.brand }}
                                </span>
                            </div>
                        </div>
                        <div class="flex h-1.5 w-full overflow-hidden rounded-full bg-mist-950">
                            <div
                                v-for="b in activeData.brands"
                                :key="b.brand"
                                class="h-full transition-all duration-500"
                                :style="{ width: `${b.pctOfTotal}%`, backgroundColor: b.color }" />
                        </div>
                    </div>

                    <div class="flex items-baseline justify-between font-mono">
                        <div>
                            <span class="block text-xs tracking-wider text-mist-400 uppercase">
                                Current Valuation
                            </span>
                            <div class="mt-0.5 text-lg font-black tracking-tight text-mist-100">
                                {{ formatIDR(activeData.valuation) }}
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="text-sm font-semibold text-amber-300">
                                {{ activeData.grams.toFixed(1) }}g
                            </div>
                            <span class="text-xs text-mist-400">
                                {{ activeData.certCount }}
                                {{ activeData.certCount === 1 ? 'certificate' : 'certificates' }}
                            </span>
                        </div>
                    </div>

                    <div
                        class="grid grid-cols-2 gap-2 border-t border-mist-700/60 pt-2.5 font-mono text-xs">
                        <div>
                            <span class="block text-xs text-mist-400">Cost Basis:</span>
                            <span class="font-semibold text-mist-300">
                                {{ formatIDR(activeData.costBasis) }}
                            </span>
                        </div>
                        <div class="text-right">
                            <span class="block text-xs text-mist-400">Unrealized P&L:</span>
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
                            <th class="w-28 px-3 py-2.5">Date</th>
                            <th class="w-28 px-3 py-2.5">Type</th>
                            <th class="px-3 py-2.5 text-right">Cost Basis</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-mist-800/60">
                        <tr
                            v-for="g in scopedGoldAssets"
                            :key="g.id"
                            class="cursor-pointer hover:bg-mist-800/50"
                            @click="openEditGoldModal(g)">
                            <td class="px-3 py-2.5 font-mono text-mist-400">
                                {{ g.purchaseDate }}
                            </td>
                            <td class="px-3 py-2.5">
                                <span>{{ g.type }}</span> &bull;
                                <span class="text-amber-300">{{ g.weightGrams }}g</span>
                            </td>
                            <td class="px-3 py-2.5 text-right font-mono font-medium text-mist-300">
                                {{ formatIDR(g.buyPriceTotal) }}
                            </td>
                        </tr>
                        <tr v-if="scopedGoldAssets.length === 0">
                            <td
                                colspan="3"
                                class="py-2.5 text-center text-mist-400">
                                No gold holdings recorded for {{ owner }}.
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <div
            class="mt-3 flex items-center justify-between border-t border-mist-800/80 pt-3 font-mono text-xs">
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
                Status: <strong class="font-mono text-amber-300">Physical Holding</strong>
            </span>
        </div>

        <AddGoldModal
            v-model="isGoldModalOpen"
            :item-to-edit="editingGoldItem"
            @closed="handleCloseModal" />
    </div>
</template>
