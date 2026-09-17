<script setup lang="ts">
import { useFinanceStore } from '@/stores/useFinanceStore';

const financeStore = useFinanceStore();

function handleMonthChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target?.value) {
        financeStore.selectedMonth = target.value;
    }
}

function shiftMonth(offset: number): void {
    const [yearStr, monthStr] = financeStore.selectedMonth.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);

    if (!year || !month) return;

    // Day 1 prevents month overflow when shifting February/30-day months
    const date = new Date(year, month - 1 + offset, 1);
    const newYear = date.getFullYear();
    const newMonth = String(date.getMonth() + 1).padStart(2, '0');

    financeStore.selectedMonth = `${newYear}-${newMonth}`;
}
</script>

<template>
    <div
        class="flex items-center gap-1 rounded-md border border-mist-800 bg-mist-900 p-1 shrink-0 shadow-sm">
        <div class="flex items-center space-x-1">
            <button
                type="button"
                title="Previous Month"
                class="cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition-colors bg-mist-800 text-mist-400 hover:text-mist-200"
                @click="shiftMonth(-1)">
                <fa-icon
                    icon="chevron-left"
                    class="text-xs" />
            </button>

            <div class="relative">
                <input
                    :value="financeStore.selectedMonth"
                    type="month"
                    class="cursor-pointer w-full appearance-none rounded-md border border-mist-800 bg-mist-950/50 px-3 py-1.5 text-xs font-mono text-mist-200 focus:border-lime-500 focus:outline-none transition-colors"
                    required
                    @change="handleMonthChange" />
                <div
                    class="pointer-events-none absolute inset-y-0 right-2 flex items-center text-mist-500">
                    <fa-icon
                        class="text-sm"
                        icon="calendar-days" />
                </div>
            </div>

            <button
                type="button"
                title="Previous Month"
                class="cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition-colors bg-mist-800 text-mist-400 hover:text-mist-200"
                @click="shiftMonth(1)">
                <fa-icon
                    icon="chevron-right"
                    class="text-xs" />
            </button>
        </div>
    </div>
</template>
