<script setup lang="ts">
import { ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { formatIDR } from '@/utils/money';

import CardTitle from '@/components/CardTitle.vue';
import PageTitle from '@/components/PageTitle.vue';
import MonthSelector from '@/components/MonthSelector.vue';
import FinancePersonalMetrics from '@/features/finance/PersonalMetrics.vue';
import FinancePersonalTable from '@/features/finance/PersonalTable.vue';
import SbnInvestment from '@/features/finance/SbnInvestment.vue';
import GoldInvestment from '@/features/finance/GoldInvestment.vue';
import SavingsList from '@/features/finance/SavingsList.vue';
import TransferModal from '@/features/finance/TransferModal.vue';
import PersonalCashFlow from '@/features/finance/PersonalCashFlow.vue';
import PersonalSpendingPacingChart from '@/features/finance/PersonalSpendingPacingChart.vue';

const bcaCardNo = import.meta.env.VITE_BCA_CARD_NO;
const bcaCardExpDate = import.meta.env.VITE_BCA_CARD_EXP;
const bcaCardId = import.meta.env.VITE_BCA_CARD_ID;

const financeStore = useFinanceStore();
const { danhNetBalance, danhMonthlyRevenue, danhMonthlyExpenses } = storeToRefs(financeStore);

const isTransferModalOpen = ref(false);
</script>

<template>
    <div class="h-full space-y-4 overflow-y-auto p-4">
        <PageTitle>
            <template #title>Finance Dashboard</template>
            <template #subtitle> Personal, Shared and Mai House Jogja </template>

            <div class="flex items-center gap-2">
                <MonthSelector />
            </div>
        </PageTitle>

        <div class="space-y-4">
            <FinancePersonalMetrics />

            <div class="grid h-110 grid-cols-4 gap-4">
                <div class="flex flex-col">
                    <CardTitle>
                        <template #title>My Card</template>
                        <template #subtitle> Active card credentials </template>
                    </CardTitle>
                    <div
                        class="flex-1 space-y-4 rounded-md border border-mist-800 bg-mist-900 p-4 shadow-sm">
                        <div class="relative mt-4 mr-4 h-48 select-none">
                            <!-- Back Card (Monochrome / Shifted Shadow Card) -->
                            <div
                                class="absolute -top-3 -right-3 z-0 h-full w-full overflow-hidden rounded-xl border border-mist-700 bg-mist-800 shadow-md">
                                <!-- Back Card Magnetic Strip Mock -->
                                <div class="mt-4 h-8 w-full bg-mist-950/50 opacity-80" />
                            </div>

                            <!-- Front Card (Monochrome Base) -->
                            <div
                                class="relative z-10 flex h-full w-full flex-col justify-between overflow-hidden rounded-xl border border-mist-800 bg-mist-900 p-5 shadow-2xl">
                                <!-- Top Row: Bank/App Name + Card Tier -->
                                <div
                                    class="flex items-center justify-between text-xs font-medium text-mist-300">
                                    <span>BCA</span>
                                    <span class="text-mist-400">Debit</span>
                                </div>

                                <!-- Middle Section: EMV Chip + Contactless Icon -->
                                <div class="my-auto flex items-center gap-3">
                                    <!-- EMV Chip Mock -->
                                    <div
                                        class="relative h-7 w-9 overflow-hidden rounded border border-amber-600/50 bg-linear-to-br from-amber-200 via-amber-400 to-amber-500 shadow-sm">
                                        <div
                                            class="absolute inset-0 grid grid-cols-2 divide-x divide-amber-700/40 opacity-60">
                                            <div class="border-b border-amber-700/40" />
                                            <div class="border-b border-amber-700/40" />
                                        </div>
                                    </div>

                                    <!-- Contactless Signal Icon -->
                                    <fa-icon
                                        icon="wifi"
                                        class="rotate-90 text-sm text-mist-400" />
                                </div>

                                <!-- Card Number -->
                                <div
                                    class="mb-4 font-mono text-lg font-semibold tracking-widest text-mist-100">
                                    {{ bcaCardNo }}
                                </div>

                                <!-- Bottom Row: Expiry Date + Colored Mastercard Logo -->
                                <div class="flex items-end justify-between">
                                    <div class="flex flex-col">
                                        <span
                                            class="text-[9px] font-medium tracking-wider text-mist-500 uppercase">
                                            Card Holder
                                        </span>
                                        <span class="font-mono text-xs font-medium text-mist-300">
                                            {{ bcaCardId }}
                                        </span>
                                    </div>

                                    <div class="flex flex-col">
                                        <span
                                            class="text-[9px] font-medium tracking-wider text-mist-500 uppercase">
                                            Valid Thru
                                        </span>
                                        <span class="font-mono text-xs font-medium text-mist-300">
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
                                class="text-[10px] font-bold tracking-wider text-mist-400 uppercase">
                                Available Balance
                            </span>
                            <div class="font-mono text-xl font-black text-mist-100">
                                {{ formatIDR(danhNetBalance) }}
                            </div>

                            <!-- Monthly Outflow Progress / Metric -->
                            <div
                                class="grid grid-cols-2 gap-2 border-t border-mist-800/60 pt-2 font-mono text-xs">
                                <div>
                                    <span class="block text-[10px] text-mist-400"> In: </span>
                                    <span class="font-semibold text-emerald-400"> + </span>
                                    {{ formatIDR(danhMonthlyRevenue) }}
                                </div>
                                <div class="text-right">
                                    <span class="block text-[10px] text-mist-400"> Out: </span>
                                    <span class="font-semibold text-rose-400"> - </span>
                                    {{ formatIDR(danhMonthlyExpenses) }}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <FinancePersonalTable class="col-span-3" />
            </div>

            <div class="grid grid-cols-2 gap-4">
                <PersonalCashFlow owner="Danh Nguyen" />
                <PersonalSpendingPacingChart owner="Danh Nguyen" />
            </div>

            <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <SbnInvestment />
                <GoldInvestment />
                <SavingsList />
            </div>
        </div>

        <TransferModal v-model="isTransferModalOpen" />
    </div>
</template>
