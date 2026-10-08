<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { formatIDR } from '@/utils/money';
import type { PersonalOwner } from '@/types/finance';
import CardTitle from '@/components/CardTitle.vue';
import FinancePersonalMetrics from '@/features/finance/PersonalMetrics.vue';
import FinancePersonalTable from '@/features/finance/PersonalTable.vue';
import SbnInvestment from '@/features/finance/SbnInvestment.vue';
import GoldInvestment from '@/features/finance/GoldInvestment.vue';
import SavingsList from '@/features/finance/SavingsList.vue';
import PersonalCashFlow from '@/features/finance/PersonalCashFlow.vue';
import PersonalSpending from '@/features/finance/PersonalSpending.vue';

type UserTabId = 'danh' | 'citra' | 'shared';

interface UserTabOption {
    id: UserTabId;
    label: string;
    owner: PersonalOwner | 'Shared';
}

interface CardDisplayInfo {
    bankName: string;
    accountTier: string;
    holderName: string;
    cardNumber: string;
    validThru: string;
}

const USER_TABS: readonly UserTabOption[] = [
    { id: 'danh', label: 'Danh Nguyen', owner: 'Danh Nguyen' },
    { id: 'citra', label: 'Citra Ayu Wardani', owner: 'Citra Ayu Wardani' },
    { id: 'shared', label: 'Shared', owner: 'Shared' },
] as const;

const bcaCardNo = import.meta.env.VITE_BCA_CARD_NO;
const bcaCardExpDate = import.meta.env.VITE_BCA_CARD_EXP;
const bcaCardId = import.meta.env.VITE_BCA_CARD_ID;

const route = useRoute();
const router = useRouter();
const financeStore = useFinanceStore();

const {
    danhNetBalance,
    danhMonthlyRevenue,
    danhMonthlyExpenses,
    citraNetBalance,
    citraMonthlyRevenue,
    citraMonthlyExpenses,
    sharedNetBalance,
    sharedMonthlyRevenue,
    sharedMonthlyExpenses,
} = storeToRefs(financeStore);

const activeUserTab = computed<UserTabId>(() => {
    const queryUser = String(route.query.user || '').toLowerCase();
    const match = USER_TABS.find((t) => t.id === queryUser);
    return match ? match.id : 'danh';
});
const activeOwner = computed<PersonalOwner | 'Shared'>(() => {
    const match = USER_TABS.find((t) => t.id === activeUserTab.value);
    return match ? match.owner : 'Danh Nguyen';
});
const activeMetrics = computed<{ net: number; in: number; out: number }>(() => {
    if (activeOwner.value === 'Citra Ayu Wardani') {
        return {
            net: citraNetBalance.value,
            in: citraMonthlyRevenue.value,
            out: citraMonthlyExpenses.value,
        };
    }
    if (activeOwner.value === 'Shared') {
        return {
            net: sharedNetBalance.value,
            in: sharedMonthlyRevenue.value,
            out: sharedMonthlyExpenses.value,
        };
    }
    return {
        net: danhNetBalance.value,
        in: danhMonthlyRevenue.value,
        out: danhMonthlyExpenses.value,
    };
});
const activeCard = computed<CardDisplayInfo>(() => {
    return {
        bankName: 'BCA',
        accountTier: 'Debit',
        holderName: String(bcaCardId),
        cardNumber: String(bcaCardNo),
        validThru: String(bcaCardExpDate),
    };
});

function handleUserTabChange(tabId: UserTabId): void {
    router.replace({
        query: {
            ...route.query,
            user: tabId === 'danh' ? undefined : tabId,
        },
    });
}
</script>

<template>
    <div class="-mt-4 space-y-4">
        <div
            class="sticky -top-4 z-20 -mx-4 flex items-center justify-between bg-mist-900/25 px-4 py-2.5 backdrop-blur-lg">
            <div
                class="flex items-center rounded-md border border-mist-800 bg-mist-950/50 p-0.5 text-xs select-none">
                <button
                    v-for="tab in USER_TABS"
                    :key="tab.id"
                    type="button"
                    class="flex cursor-pointer items-center gap-1.5 rounded-xs px-3 py-1.5 font-semibold transition"
                    :class="[
                        activeUserTab === tab.id
                            ? 'border border-mist-700/80 bg-mist-800 text-lime-400 shadow-sm'
                            : 'border border-transparent text-mist-400 hover:text-mist-200',
                    ]"
                    @click="handleUserTabChange(tab.id)">
                    <span>{{ tab.label }}</span>
                </button>
            </div>
        </div>

        <FinancePersonalMetrics
            :key="`metrics-${activeOwner}`"
            class="-mt-2"
            :owner="activeOwner" />

        <div class="grid h-110 grid-cols-1 gap-4 lg:grid-cols-4">
            <div class="flex flex-col">
                <CardTitle>
                    <template #title>Active Account</template>
                    <template #subtitle>{{ activeCard.holderName }} credentials</template>
                </CardTitle>
                <div
                    class="flex flex-1 flex-col justify-between space-y-4 overflow-hidden rounded-md border border-mist-800 bg-mist-900 p-4 shadow-sm">
                    <div class="relative mt-4 mr-4 h-48 w-78 self-center select-none">
                        <div
                            class="absolute -top-3 -right-4 z-0 h-full w-full overflow-hidden rounded-xl border border-mist-700 bg-mist-800 shadow-md">
                            <div class="mt-4 h-8 w-full bg-mist-950/60 opacity-80" />
                        </div>

                        <div
                            class="relative z-10 flex h-full w-full flex-col justify-between overflow-hidden rounded-xl border border-mist-800 bg-mist-900 p-5 shadow-2xl">
                            <div
                                class="flex items-center justify-between text-xs font-medium text-mist-300">
                                <span>{{ activeCard.bankName }}</span>
                                <span class="font-mono text-xs text-mist-400">
                                    {{ activeCard.accountTier }}
                                </span>
                            </div>

                            <div class="my-auto flex items-center gap-3">
                                <div
                                    class="relative h-7 w-9 overflow-hidden rounded border border-amber-600/50 bg-linear-to-br from-amber-200 via-amber-400 to-amber-500 shadow-sm">
                                    <div
                                        class="absolute inset-0 grid grid-cols-2 divide-x divide-amber-700/40 opacity-60">
                                        <div class="border-b border-amber-700/40" />
                                        <div class="border-b border-amber-700/40" />
                                    </div>
                                </div>
                                <fa-icon
                                    icon="wifi"
                                    class="rotate-90 text-sm text-mist-400" />
                            </div>

                            <div class="mb-4 font-mono text-lg font-semibold tracking-widest">
                                {{ activeCard.cardNumber }}
                            </div>

                            <div class="flex items-end justify-between">
                                <div class="flex flex-col">
                                    <span
                                        class="text-[9px] font-medium tracking-wider text-mist-500 uppercase">
                                        Holder
                                    </span>
                                    <span class="font-mono text-xs font-medium text-mist-300">
                                        {{ activeCard.holderName }}
                                    </span>
                                </div>
                                <div class="flex flex-col">
                                    <span
                                        class="text-[9px] font-medium tracking-wider text-mist-500 uppercase">
                                        Expires
                                    </span>
                                    <span class="font-mono text-xs font-medium text-mist-300">
                                        {{ activeCard.validThru }}
                                    </span>
                                </div>
                                <div class="flex items-center">
                                    <svg
                                        class="h-7 w-auto"
                                        viewBox="0 0 36 24"
                                        fill="none">
                                        <circle
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            fill="#EB001B" />
                                        <circle
                                            cx="24"
                                            cy="12"
                                            r="10"
                                            fill="#F79E1B" />
                                        <path
                                            d="M18 4.70801C19.826 6.33 21 8.68001 21 11.31C21 13.94 19.826 16.29 18 17.912C16.174 16.29 15 13.94 15 11.31C15 8.68001 16.174 6.33 18 4.70801Z"
                                            fill="#FF5F00" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="space-y-3">
                        <span class="text-xs font-semibold tracking-wider text-mist-400 uppercase">
                            Available Balance
                        </span>
                        <div class="flex gap-2 font-mono text-lg font-semibold">
                            <span
                                v-if="activeMetrics.net < 0"
                                class="text-rose-400">
                                -
                            </span>
                            <span>{{ formatIDR(Math.abs(activeMetrics.net)) }}</span>
                        </div>

                        <div
                            class="grid grid-cols-2 gap-2 border-t border-mist-800/60 pt-2 font-mono text-xs">
                            <div>
                                <span class="block text-xs text-mist-500">In</span>
                                <span class="font-semibold text-emerald-400">+</span>
                                {{ formatIDR(activeMetrics.in) }}
                            </div>
                            <div class="text-right">
                                <span class="block text-xs text-mist-500">Out</span>
                                <span class="font-semibold text-rose-400">-</span>
                                {{ formatIDR(activeMetrics.out) }}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <FinancePersonalTable
                :key="`table-${activeOwner}`"
                :owner="activeOwner"
                class="col-span-1 lg:col-span-3" />
        </div>

        <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <PersonalCashFlow
                :key="`cashflow-${activeOwner}`"
                :owner="activeOwner" />
            <PersonalSpending
                :key="`spending-${activeOwner}`"
                :owner="activeOwner" />
        </div>

        <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <GoldInvestment
                :key="`gold-${activeOwner}`"
                :owner="activeOwner" />
            <SavingsList
                :key="`savings-${activeOwner}`"
                :owner="activeOwner" />
            <SbnInvestment
                :key="`sbn-${activeOwner}`"
                :owner="activeOwner" />
        </div>
    </div>
</template>
