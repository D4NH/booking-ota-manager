<script setup lang="ts">
import { ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { toast } from 'vue-toastflow';
import type { PersonalOwner, GoldType } from '@/types/finance';

const financeStore = useFinanceStore();
const {
    dynamicSavingsAccounts,
    dynamicSavingsTransactions,
    dynamicTotalSavings,
    goldAssets,
    currentGoldPricePerGram,
    totalGoldGrams,
    estimatedGoldMarketValue,
    goldUnrealizedPnL,
} = storeToRefs(financeStore);

const isGoldModalOpen = ref(false);
const activeSavingsSubTab = ref<'accounts' | 'transactions'>('accounts');

const goldOwner = ref<PersonalOwner | 'Shared'>('Danh Nguyen');
const goldType = ref<GoldType>('Antam');
const goldGrams = ref<number | null>(null);
const goldTotalCost = ref<number | null>(null);
const goldDate = ref(new Date().toISOString().slice(0, 10));
const goldCert = ref('');

function formatIDR(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
    }).format(amount);
}

async function handleSaveGold(): Promise<void> {
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
}
</script>

<template>
    <div class="space-y-6 mb-6">
        <!-- Top Level Wealth Metrics -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
                class="bg-mist-900 border border-mist-800 p-5 rounded-2xl shadow-md relative overflow-hidden">
                <div class="flex items-center justify-between">
                    <span class="text-xs font-bold uppercase tracking-wider text-mist-400">
                        Cash & Reserves
                    </span>
                    <span
                        class="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold">
                        Auto Synced
                    </span>
                </div>
                <div class="text-2xl font-black text-mist-100 font-mono mt-2">
                    {{ formatIDR(dynamicTotalSavings) }}
                </div>
                <p class="text-xs text-mist-400 mt-1">
                    Aggregated from Personal Ledger Savings entries
                </p>
            </div>

            <div
                class="bg-mist-900 border border-mist-800 p-5 rounded-2xl shadow-md relative overflow-hidden">
                <div class="flex items-center justify-between">
                    <span class="text-xs font-bold uppercase tracking-wider text-mist-400">
                        Total Gold Reserves
                    </span>
                    <span
                        class="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-lime-400/10 text-lime-400 border border-lime-400/20 font-bold">
                        Precious Metals
                    </span>
                </div>
                <div class="text-2xl font-black text-lime-400 font-mono mt-2">
                    {{ totalGoldGrams.toFixed(2) }} <span class="text-sm">grams</span>
                </div>
                <p class="text-xs text-mist-400 mt-1">
                    Market Valuation: {{ formatIDR(estimatedGoldMarketValue) }}
                </p>
            </div>

            <div
                class="bg-mist-900 border border-mist-800 p-5 rounded-2xl shadow-md relative overflow-hidden">
                <div class="flex items-center justify-between">
                    <span class="text-xs font-bold uppercase tracking-wider text-mist-400">
                        Gold Unrealized P&L
                    </span>
                    <span class="text-[10px] font-mono text-mist-400">
                        @ {{ formatIDR(currentGoldPricePerGram) }}/g
                    </span>
                </div>
                <div
                    class="text-2xl font-black font-mono mt-2"
                    :class="goldUnrealizedPnL >= 0 ? 'text-lime-400' : 'text-rose-400'">
                    {{ goldUnrealizedPnL >= 0 ? '+' : '' }}{{ formatIDR(goldUnrealizedPnL) }}
                </div>
                <p class="text-xs text-mist-400 mt-1">
                    Current market return over acquisition cost
                </p>
            </div>
        </div>

        <!-- Dual Ledger Panels -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Dynamic Savings Module -->
            <div class="bg-mist-900 rounded-2xl border border-mist-800 p-5 shadow-sm">
                <div
                    class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                    <div>
                        <h3 class="text-sm font-bold text-mist-100 flex items-center gap-2">
                            Liquid Savings
                            <span
                                class="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.2 rounded font-mono font-bold">
                                {{ dynamicSavingsAccounts.length }} Account(s)
                            </span>
                        </h3>
                        <p class="text-xs text-mist-400">
                            Dynamic accumulation from Personal Finance entries
                        </p>
                    </div>

                    <!-- View Switcher -->
                    <div class="flex space-x-1 border border-mist-800 p-1 rounded-lg bg-mist-850">
                        <button
                            class="px-2.5 py-1 text-[11px] font-semibold rounded transition"
                            :class="
                                activeSavingsSubTab === 'accounts'
                                    ? 'bg-mist-700 text-mist-100 shadow'
                                    : 'text-mist-400 hover:text-mist-200'
                            "
                            @click="activeSavingsSubTab = 'accounts'">
                            Accounts
                        </button>
                        <button
                            class="px-2.5 py-1 text-[11px] font-semibold rounded transition"
                            :class="
                                activeSavingsSubTab === 'transactions'
                                    ? 'bg-mist-700 text-mist-100 shadow'
                                    : 'text-mist-400 hover:text-mist-200'
                            "
                            @click="activeSavingsSubTab = 'transactions'">
                            Logs ({{ dynamicSavingsTransactions.length }})
                        </button>
                    </div>
                </div>

                <!-- Accounts Group View -->
                <div
                    v-if="activeSavingsSubTab === 'accounts'"
                    class="overflow-x-auto">
                    <table class="w-full text-left text-xs text-mist-200">
                        <thead
                            class="bg-mist-850 text-mist-400 uppercase font-semibold border-y border-mist-800">
                            <tr>
                                <th class="py-2.5 px-3">Owner</th>
                                <th class="py-2.5 px-3">Institution</th>
                                <th class="py-2.5 px-3">Last Active</th>
                                <th class="py-2.5 px-3 text-right">Total Balance</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-mist-800/60 font-mono">
                            <tr
                                v-for="acc in dynamicSavingsAccounts"
                                :key="acc.key"
                                class="hover:bg-mist-850/50">
                                <td class="py-2.5 px-3 font-medium text-mist-100">
                                    {{ acc.owner }}
                                </td>
                                <td class="py-2.5 px-3 flex items-center gap-1.5">
                                    <span class="w-2 h-2 rounded-full bg-blue-400"></span>
                                    {{ acc.institution }}
                                </td>
                                <td class="py-2.5 px-3 text-mist-400">{{ acc.lastUpdated }}</td>
                                <td class="py-2.5 px-3 text-right font-bold text-lime-400">
                                    {{ formatIDR(acc.balance) }}
                                </td>
                            </tr>
                            <tr v-if="dynamicSavingsAccounts.length === 0">
                                <td
                                    colspan="4"
                                    class="py-6 text-center text-mist-400">
                                    No personal transactions categorized as "Savings" yet.
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- Raw Transactions Log View -->
                <div
                    v-else
                    class="overflow-x-auto">
                    <table class="w-full text-left text-xs text-mist-200">
                        <thead
                            class="bg-mist-850 text-mist-400 uppercase font-semibold border-y border-mist-800">
                            <tr>
                                <th class="py-2.5 px-3">Date</th>
                                <th class="py-2.5 px-3">Owner</th>
                                <th class="py-2.5 px-3">Target / Notes</th>
                                <th class="py-2.5 px-3 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-mist-800/60 font-mono">
                            <tr
                                v-for="tx in dynamicSavingsTransactions"
                                :key="tx.id"
                                class="hover:bg-mist-850/50">
                                <td class="py-2.5 px-3 text-mist-400">{{ tx.date }}</td>
                                <td class="py-2.5 px-3 font-medium text-mist-100">
                                    {{ tx.owner }}
                                </td>
                                <td class="py-2.5 px-3 text-mist-300">
                                    <span class="text-blue-400 font-medium"
                                        >[{{ tx.savingsInstitution || 'BCA' }}]</span
                                    >
                                    {{ tx.notes || 'Savings allocation' }}
                                </td>
                                <td class="py-2.5 px-3 text-right font-bold text-lime-400">
                                    +{{ formatIDR(tx.amount) }}
                                </td>
                            </tr>
                            <tr v-if="dynamicSavingsTransactions.length === 0">
                                <td
                                    colspan="4"
                                    class="py-6 text-center text-mist-400">
                                    No savings records found.
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Gold Asset Module -->
            <div class="bg-mist-900 rounded-2xl border border-mist-800 p-5 shadow-sm">
                <div class="flex items-center justify-between mb-4">
                    <div>
                        <h3 class="text-sm font-bold text-mist-100">Gold Holdings</h3>
                        <p class="text-xs text-mist-400">Physical and digital gold weights</p>
                    </div>
                    <button
                        class="bg-lime-400 hover:bg-lime-300 text-mist-950 text-xs font-bold px-3 py-1.5 rounded-lg transition"
                        @click="isGoldModalOpen = true">
                        + Add Gold
                    </button>
                </div>

                <div class="overflow-x-auto">
                    <table class="w-full text-left text-xs text-mist-200">
                        <thead
                            class="bg-mist-850 text-mist-400 uppercase font-semibold border-y border-mist-800">
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
                                class="hover:bg-mist-850/50">
                                <td class="py-2.5 px-3 text-mist-400">{{ g.purchaseDate }}</td>
                                <td class="py-2.5 px-3 font-semibold text-mist-100">
                                    {{ g.type }}
                                </td>
                                <td class="py-2.5 px-3">{{ g.owner }}</td>
                                <td class="py-2.5 px-3 text-right font-bold text-lime-400">
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
        </div>

        <!-- Add Gold Modal -->
        <div
            v-if="isGoldModalOpen"
            class="fixed inset-0 z-50 bg-mist-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div
                class="bg-mist-900 border border-mist-800 rounded-2xl shadow-2xl w-full max-w-md p-6">
                <h4 class="font-bold text-mist-100 text-sm mb-4">Add Gold Holding</h4>
                <form
                    class="space-y-4"
                    @submit.prevent="handleSaveGold">
                    <div>
                        <label class="text-xs font-semibold text-mist-400 block mb-1">Owner</label>
                        <select
                            v-model="goldOwner"
                            class="w-full text-xs border border-mist-700 bg-mist-850 text-mist-100 rounded-lg p-2.5">
                            <option value="Danh Nguyen">Danh Nguyen</option>
                            <option value="Citra Ayu Wardani">Citra Ayu Wardani</option>
                            <option value="Shared">Shared</option>
                        </select>
                    </div>
                    <div>
                        <label class="text-xs font-semibold text-mist-400 block mb-1">Type</label>
                        <select
                            v-model="goldType"
                            class="w-full text-xs border border-mist-700 bg-mist-850 text-mist-100 rounded-lg p-2.5">
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
                            class="w-full text-xs border border-mist-700 bg-mist-850 text-mist-100 rounded-lg p-2.5 font-mono" />
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
                            class="w-full text-xs border border-mist-700 bg-mist-850 text-mist-100 rounded-lg p-2.5 font-mono" />
                    </div>
                    <div>
                        <label class="text-xs font-semibold text-mist-400 block mb-1">
                            Purchase Date
                        </label>
                        <input
                            v-model="goldDate"
                            type="date"
                            required
                            class="w-full text-xs border border-mist-700 bg-mist-850 text-mist-100 rounded-lg p-2.5 font-mono" />
                    </div>
                    <div>
                        <label class="text-xs font-semibold text-mist-400 block mb-1">
                            Certificate / Serial Number (Optional)
                        </label>
                        <input
                            v-model="goldCert"
                            type="text"
                            placeholder="CERT-12345"
                            class="w-full text-xs border border-mist-700 bg-mist-850 text-mist-100 rounded-lg p-2.5 font-mono" />
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
                            class="bg-lime-400 hover:bg-lime-300 text-mist-950 text-xs px-4 py-2 rounded-lg font-bold">
                            Save
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</template>
