<script setup lang="ts">
import { ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { formatIDR } from '@/utils/money';

import GoogleSyncButton from '@/components/ui/GoogleSyncButton.vue';
import CardTitle from '@/components/ui/CardTitle.vue';
import PageTitle from '@/components/ui/PageTitle.vue';
import MonthSelector from '@/components/ui/MonthSelector.vue';
import FinancePersonalMetrics from '@/features/finance/PersonalMetrics.vue';
import FinancePersonalTable from '@/features/finance/PersonalTable.vue';
import SbnInvestment from '@/features/finance/SbnInvestment.vue';
import GoldInvestment from '@/features/finance/GoldInvestment.vue';
import InvestmentChart from '@/features/finance/InvestmentChart.vue';
import SavingsList from '@/features/finance/SavingsList.vue';
import TransferModal from '@/features/finance/TransferModal.vue';

const financeStore = useFinanceStore();
const { danhNetBalance, danhMonthlyRevenue, danhMonthlyExpenses } = storeToRefs(financeStore);

const bcaCardNo = import.meta.env.VITE_BCA_CARD_NO;
const bcaCardExpDate = import.meta.env.VITE_BCA_CARD_EXP;
const bcaCardId = import.meta.env.VITE_BCA_CARD_ID;

const isTransferModalOpen = ref(false);
</script>

<template>
    <div class="h-full overflow-y-auto space-y-4 p-4">
        <PageTitle>
            <template #title>Finance Dashboard</template>
            <template #subtitle> Personal, Shared and Mai House Jogja </template>

            <div class="flex items-center gap-2">
                <GoogleSyncButton scope="finance" />
                <MonthSelector />
            </div>
        </PageTitle>

        <div class="space-y-4">
            <FinancePersonalMetrics />

            <div class="grid grid-cols-4 items-stretch gap-4">
                <div class="flex flex-col">
                    <CardTitle>
                        <template #title>My Card</template>
                        <template #subtitle> Active card credentials </template>
                    </CardTitle>
                    <div
                        class="flex-1 rounded-md border border-mist-800 bg-mist-900 p-4 shadow-sm space-y-4">
                        <div class="relative h-48 select-none mt-4 mr-4">
                            <!-- Back Card (Monochrome / Shifted Shadow Card) -->
                            <div
                                class="absolute -top-3 -right-3 w-full h-full rounded-xl bg-mist-800 border border-mist-700 shadow-md z-0 overflow-hidden">
                                <!-- Back Card Magnetic Strip Mock -->
                                <div class="w-full h-8 bg-mist-950/50 mt-4 opacity-80" />
                            </div>

                            <!-- Front Card (Monochrome Base) -->
                            <div
                                class="relative w-full h-full rounded-xl bg-mist-900 border border-mist-800 shadow-2xl p-5 flex flex-col justify-between overflow-hidden z-10">
                                <!-- Top Row: Bank/App Name + Card Tier -->
                                <div
                                    class="flex items-center justify-between text-xs font-medium text-mist-300">
                                    <span>BCA</span>
                                    <span class="text-mist-400">Debit</span>
                                </div>

                                <!-- Middle Section: EMV Chip + Contactless Icon -->
                                <div class="flex items-center gap-3 my-auto">
                                    <!-- EMV Chip Mock -->
                                    <div
                                        class="w-9 h-7 rounded bg-linear-to-br from-amber-200 via-amber-400 to-amber-500 border border-amber-600/50 relative overflow-hidden shadow-sm">
                                        <div
                                            class="absolute inset-0 grid grid-cols-2 divide-x divide-amber-700/40 opacity-60">
                                            <div class="border-b border-amber-700/40" />
                                            <div class="border-b border-amber-700/40" />
                                        </div>
                                    </div>

                                    <!-- Contactless Signal Icon -->
                                    <fa-icon
                                        icon="wifi"
                                        class="rotate-90 text-mist-400 text-sm" />
                                </div>

                                <!-- Card Number -->
                                <div
                                    class="font-mono text-lg tracking-widest text-mist-100 font-semibold mb-4">
                                    {{ bcaCardNo }}
                                </div>

                                <!-- Bottom Row: Expiry Date + Colored Mastercard Logo -->
                                <div class="flex items-end justify-between">
                                    <div class="flex flex-col">
                                        <span
                                            class="text-[9px] uppercase tracking-wider text-mist-500 font-medium">
                                            Card Holder
                                        </span>
                                        <span class="font-mono text-xs text-mist-300 font-medium">
                                            {{ bcaCardId }}
                                        </span>
                                    </div>

                                    <div class="flex flex-col">
                                        <span
                                            class="text-[9px] uppercase tracking-wider text-mist-500 font-medium">
                                            Valid Thru
                                        </span>
                                        <span class="font-mono text-xs text-mist-300 font-medium">
                                            {{ bcaCardExpDate }}
                                        </span>
                                    </div>

                                    <!-- Full-Color Mastercard Brand Circles -->
                                    <div
                                        class="flex items-center"
                                        aria-label="Mastercard">
                                        <svg
                                            class="h-7 w-auto"
                                            viewBox="0 0 36 24"
                                            fill="none"
                                            xmlns="http://www.w3.org/2000/svg">
                                            <!-- Left Red Circle -->
                                            <circle
                                                cx="12"
                                                cy="12"
                                                r="10"
                                                fill="#EB001B" />
                                            <!-- Right Yellow Circle -->
                                            <circle
                                                cx="24"
                                                cy="12"
                                                r="10"
                                                fill="#F79E1B" />
                                            <!-- Overlap Orange Center -->
                                            <path
                                                d="M18 4.70801C19.826 6.33 21 8.68001 21 11.31C21 13.94 19.826 16.29 18 17.912C16.174 16.29 15 13.94 15 11.31C15 8.68001 16.174 6.33 18 4.70801Z"
                                                fill="#FF5F00" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="space-y-3">
                            <!-- Balance Row -->
                            <span
                                class="text-[10px] uppercase font-bold text-mist-400 tracking-wider">
                                Available Balance
                            </span>
                            <div class="text-xl font-black font-mono text-mist-100">
                                {{ formatIDR(danhNetBalance) }}
                            </div>

                            <!-- Monthly Outflow Progress / Metric -->
                            <div
                                class="grid grid-cols-2 gap-2 pt-2 border-t border-mist-800/60 text-xs font-mono">
                                <div>
                                    <span class="text-[10px] text-mist-400 block"> In: </span>
                                    <span class="text-lime-400 font-semibold"> + </span>
                                    {{ formatIDR(danhMonthlyRevenue) }}
                                </div>
                                <div class="text-right">
                                    <span class="text-[10px] text-mist-400 block"> Out: </span>
                                    <span class="text-rose-400 font-semibold"> - </span>
                                    {{ formatIDR(danhMonthlyExpenses) }}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <FinancePersonalTable class="col-span-3" />
            </div>

            <InvestmentChart />

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <SbnInvestment />
                <GoldInvestment />
                <SavingsList />
            </div>
        </div>

        <TransferModal v-model="isTransferModalOpen" />
    </div>
</template>
