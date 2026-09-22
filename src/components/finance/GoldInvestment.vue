<script setup lang="ts">
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { toast } from 'vue-toastflow';
import { useFinanceStore } from '@/stores/useFinanceStore';
import type { PersonalOwner, GoldType } from '@/types/finance';
import { formatIDR } from '@/utils/money';

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
const goldOwner = ref<PersonalOwner | 'Shared'>('Danh Nguyen');
const goldType = ref<GoldType>('Antam');
const goldGrams = ref<number | null>(null);
const goldTotalCost = ref<number | null>(null);
const goldDate = ref(new Date().toISOString().slice(0, 10));
const goldCert = ref('');

const goldBrands = computed(() =>
    [...new Set(goldAssets.value.map((g) => g.type))].sort().join(' / ')
);

const handleSaveGold = async (): Promise<void> => {
    if (!goldGrams.value || !goldTotalCost.value) return;

    try {
        await toast.loading(
            async () => {
                await financeStore.addGoldPurchase({
                    owner: goldOwner.value,
                    type: goldType.value,
                    weightGrams: Number(goldGrams.value),
                    buyPriceTotal: Number(goldTotalCost.value),
                    purchaseDate: goldDate.value,
                    certificateNumber: goldCert.value,
                });
            },
            {
                loading: {
                    title: 'Saving Gold Asset...',
                    description: 'Adding holding to precious metals ledger & local cache.',
                },
                success: {
                    title: 'Gold Holding Added',
                    description: `Logged ${goldGrams.value}g of ${goldType.value} for ${goldOwner.value}.`,
                },
                error: (err: unknown) => ({
                    title: 'Save Failed',
                    description:
                        err instanceof Error ? err.message : 'Failed to write to Google Sheets.',
                }),
            }
        );

        goldGrams.value = null;
        goldTotalCost.value = null;
        goldCert.value = '';
        isGoldModalOpen.value = false;
    } catch (err: unknown) {
        console.error('Failed to add gold holding:', err);
    }
};
</script>

<template>
    <div
        class="bg-mist-900 border border-mist-800 rounded-md p-4 shadow-lg flex flex-col justify-between">
        <!-- Header Tag -->
        <div class="flex items-center justify-between gap-2 mb-4 h-7">
            <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
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
                                ? 'bg-mist-800 text-lime-400 shadow-sm'
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
                                ? 'bg-mist-800 text-lime-400 shadow-sm'
                                : 'text-mist-400 hover:text-mist-200',
                        ]"
                        @click="activeView = 'logs'">
                        Cert
                    </button>
                </div>
                <button
                    v-if="activeView === 'logs'"
                    class="bg-lime-400 hover:bg-lime-300 text-mist-950 text-xs font-semibold px-3 py-2 rounded-md transition"
                    @click="isGoldModalOpen = true">
                    + Add Gold
                </button>
            </div>
        </div>

        <div v-if="activeView === 'info'">
            <!-- Virtual Gold Ingot Display -->
            <div class="relative overflow-hidden rounded-md p-4 mb-4 bg-mist-800/50">
                <div class="flex justify-between items-start mb-6">
                    <div>
                        <span class="text-xs text-mist-200 uppercase font-mono block">
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

                <div class="flex items-baseline justify-between">
                    <div>
                        <span class="text-xs text-mist-400 block"> Current Valuation </span>
                        <div class="text-lg font-black font-mono text-mist-100 tracking-tight mt-1">
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
                            :class="goldUnrealizedPnL >= 0 ? 'text-mist-200' : 'text-rose-400'">
                            {{ goldUnrealizedPnL >= 0 ? '+' : ''
                            }}{{ formatIDR(goldUnrealizedPnL) }} ({{ goldPnLPct }}%)
                        </span>
                    </div>
                </div>
            </div>

            <!-- Gram Weight Distribution Indicators -->
            <div class="space-y-1.5 mb-3">
                <div class="flex justify-between text-[11px] font-mono text-mist-400">
                    <span>Reserve Density</span>
                    <span class="text-mist-200">Total Net Weight: {{ totalGoldGrams }}g</span>
                </div>
                <div class="w-full bg-mist-950/50 h-1.5 rounded-full overflow-hidden">
                    <div
                        class="h-full rounded-full bg-amber-300 transition-all duration-500"
                        :style="{ width: `${Math.min(100, (totalGoldGrams / 50) * 100)}%` }"></div>
                </div>
            </div>
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
                        <td class="py-2.5 px-3 text-right font-semibold text-lime-400">
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
                Status: <strong class="text-lime-400 font-mono">Secured</strong>
            </span>
        </div>

        <!-- Add Gold Modal -->
        <div
            v-if="isGoldModalOpen"
            class="fixed inset-0 z-50 bg-mist-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div
                class="bg-mist-900 border border-mist-800 rounded-md shadow-2xl w-full max-w-md p-6">
                <h4 class="font-semibold text-mist-100 text-sm mb-4">Add Gold Holding</h4>
                <form
                    class="space-y-4"
                    @submit.prevent="handleSaveGold">
                    <div>
                        <label class="text-xs font-semibold text-mist-400 block mb-1">Owner</label>
                        <select
                            v-model="goldOwner"
                            class="w-full text-xs border border-mist-800 bg-mist-800 text-mist-100 rounded-md p-2.5">
                            <option value="Danh Nguyen">Danh Nguyen</option>
                            <option value="Citra Ayu Wardani">Citra Ayu Wardani</option>
                            <option value="Shared">Shared</option>
                        </select>
                    </div>
                    <div>
                        <label class="text-xs font-semibold text-mist-400 block mb-1">Type</label>
                        <select
                            v-model="goldType"
                            class="w-full text-xs border border-mist-800 bg-mist-800 text-mist-100 rounded-md p-2.5">
                            <option value="Antam">Antam</option>
                            <option value="UBS">UBS</option>
                            <option value="Galeri 24">Galeri 24</option>
                            <option value="Semar">Semar</option>
                        </select>
                    </div>
                    <div>
                        <label class="text-xs font-semibold text-mist-400 block mb-1">
                            Weight (Grams)
                        </label>
                        <input
                            v-model="goldGrams"
                            type="number"
                            step="0.01"
                            required
                            placeholder="10"
                            class="w-full text-xs border border-mist-800 bg-mist-800 text-mist-100 rounded-md p-2.5 font-mono" />
                    </div>
                    <div>
                        <label class="text-xs font-semibold text-mist-400 block mb-1">
                            Total Cost (IDR)
                        </label>
                        <input
                            v-model="goldTotalCost"
                            type="number"
                            required
                            placeholder="24500000"
                            class="w-full text-xs border border-mist-800 bg-mist-800 text-mist-100 rounded-md p-2.5 font-mono" />
                    </div>
                    <div>
                        <label class="text-xs font-semibold text-mist-400 block mb-1">
                            Purchase Date
                        </label>
                        <input
                            v-model="goldDate"
                            type="date"
                            required
                            class="w-full text-xs border border-mist-800 bg-mist-800 text-mist-100 rounded-md p-2.5 font-mono" />
                    </div>
                    <div>
                        <label class="text-xs font-semibold text-mist-400 block mb-1">
                            Certificate / Serial Number (Optional)
                        </label>
                        <input
                            v-model="goldCert"
                            type="text"
                            placeholder="CERT-12345"
                            class="w-full text-xs border border-mist-800 bg-mist-800 text-mist-100 rounded-md p-2.5 font-mono" />
                    </div>
                    <div class="flex justify-end space-x-2 pt-3">
                        <button
                            type="button"
                            class="text-xs px-3 py-2 text-mist-400 hover:text-mist-200"
                            @click="isGoldModalOpen = false">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            class="bg-lime-400 hover:bg-lime-300 text-mist-950 text-xs px-4 py-2 rounded-md font-semibold">
                            Save
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</template>
