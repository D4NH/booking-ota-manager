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
function triggerDatePicker(event: MouseEvent): void {
    const target = event.currentTarget as HTMLInputElement | null;

    try {
        target?.showPicker();
    } catch {
        target?.focus();
    }
}
</script>

<template>
    <div
        class="flex shrink-0 items-center gap-1 rounded-md border border-mist-800 bg-mist-900 p-1 shadow-sm">
        <div class="flex items-center space-x-1">
            <button
                type="button"
                title="Previous Month"
                class="cursor-pointer rounded-md border border-mist-800 bg-mist-800 px-3 py-1.5 text-xs text-mist-400 transition-colors hover:border-mist-700"
                @click="shiftMonth(-1)">
                <fa-icon icon="chevron-left" />
            </button>

            <div class="relative">
                <input
                    :value="financeStore.selectedMonth"
                    type="month"
                    class="w-full cursor-pointer appearance-none rounded-md border border-mist-800 bg-mist-950/50 py-1.5 pr-1 pl-3 font-mono text-xs text-mist-200 transition-colors hover:border-mist-700 focus:border-lime-500 focus:outline-none"
                    required
                    @change="handleMonthChange"
                    @click="triggerDatePicker" />
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
                class="cursor-pointer rounded-md border border-mist-800 bg-mist-800 px-3 py-1.5 text-xs text-mist-400 transition-colors hover:border-mist-700"
                @click="shiftMonth(1)">
                <fa-icon icon="chevron-right" />
            </button>
        </div>
    </div>
</template>
