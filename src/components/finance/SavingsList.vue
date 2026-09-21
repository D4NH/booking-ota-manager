<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { formatIDR } from '@/utils/money';

import TransactionNote from '@/components/finance/TransactionNote.vue';

const financeStore = useFinanceStore();
const { dynamicSavingsAccounts, dynamicSavingsTransactions } = storeToRefs(financeStore);
</script>

<template>
    <div class="bg-mist-900 rounded-md border border-mist-800 p-4 shadow-sm">
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 h-7">
            <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-blue-400"></span>
                <h3 class="text-xs font-semibold uppercase tracking-wider text-mist-400">
                    Savings
                    <!-- <span
                        class="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.2 rounded font-mono font-semibold">
                        {{ dynamicSavingsAccounts.length }} Account(s)
                    </span> -->
                </h3>
            </div>
        </div>

        <!-- Accounts Group View -->
        <div class="overflow-x-auto">
            <table class="w-full text-left text-xs text-mist-200 mb-6 table-fixed border-collapse">
                <thead
                    class="bg-mist-850 text-mist-400 uppercase font-semibold border-y border-mist-800">
                    <tr>
                        <th class="w-25 py-2.5 px-3">Last Active</th>
                        <th class="w-26 py-2.5 px-3">Owner</th>
                        <th class="py-2.5 px-3">Institution</th>
                        <th class="w-30 py-2.5 px-3 text-right">Total Balance</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-mist-800/60 font-mono">
                    <tr
                        v-for="acc in dynamicSavingsAccounts"
                        :key="acc.key"
                        class="hover:bg-mist-850/50">
                        <td class="py-2.5 px-3 text-mist-400">{{ acc.lastUpdated }}</td>
                        <td class="py-2.5 px-3 font-medium text-mist-100">
                            {{ acc.owner }}
                        </td>
                        <td class="py-2.5 px-3 flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-blue-400"></span>
                            {{ acc.institution }}
                        </td>
                        <td class="py-2.5 px-3 text-right font-semibold text-lime-400">
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

            <table class="w-full text-left text-xs text-mist-200 table-fixed border-collapse">
                <thead
                    class="bg-mist-850 text-mist-400 uppercase font-semibold border-y border-mist-800">
                    <tr>
                        <th class="w-25 py-2.5 px-3">Date</th>
                        <!-- <th class="w-26 py-2.5 px-3">Owner</th> -->
                        <th class="py-2.5 px-3">Notes</th>
                        <th class="py-2.5 px-3 text-right">Amount</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-mist-800/60 font-mono">
                    <tr
                        v-for="tx in dynamicSavingsTransactions.slice(0, 4)"
                        :key="tx.id"
                        class="hover:bg-mist-850/50">
                        <td class="py-2.5 px-3 text-mist-400">{{ tx.date }}</td>
                        <!-- <td class="py-2.5 px-3 font-medium text-mist-100">
                            {{ tx.owner }}
                        </td> -->
                        <td class="py-2.5 px-3 text-mist-300">
                            <TransactionNote :notes="tx.notes" />
                        </td>
                        <td class="py-2.5 px-3 text-right font-semibold text-lime-400">
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
</template>
