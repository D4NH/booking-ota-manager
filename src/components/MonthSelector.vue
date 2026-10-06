<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { getCurrentMonth } from '@/utils/date';

import DatePicker from '@/components/ui/DatePicker.vue';

const financeStore = useFinanceStore();
const { selectedMonth } = storeToRefs(financeStore);

const isCurrentCalendarMonth = computed<boolean>(() => selectedMonth.value === getCurrentMonth());

function shiftMonth(offset: number): void {
    const [yearStr, monthStr] = selectedMonth.value.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);

    if (!year || !month) return;

    const date = new Date(year, month - 1 + offset, 1);
    const newYear = date.getFullYear();
    const newMonth = String(date.getMonth() + 1).padStart(2, '0');

    selectedMonth.value = `${newYear}-${newMonth}`;
}
function handleResetToCurrentMonth(): void {
    selectedMonth.value = getCurrentMonth();
}
</script>

<template>
    <div class="flex gap-2">
        <button
            type="button"
            class="rounded-md border border-mist-800 px-3 py-2 text-xs shadow-sm transition-colors"
            :class="[
                isCurrentCalendarMonth
                    ? 'cursor-default bg-mist-900 text-mist-500'
                    : 'cursor-pointer bg-mist-800 text-mist-300 hover:border-mist-700',
            ]"
            @click="handleResetToCurrentMonth">
            Today
        </button>
        <div class="flex w-50 items-center justify-center rounded-md border border-mist-800">
            <button
                type="button"
                class="-mt-1 cursor-pointer p-1.5 text-mist-400 transition hover:text-mist-100"
                title="Previous Month"
                @click="shiftMonth(-1)">
                <fa-icon
                    icon="chevron-left"
                    class="text-xs" />
            </button>
            <DatePicker
                v-model="selectedMonth"
                mode="month"
                :width="269"
                input-label=""
                :select-today-by-default="true" />
            <button
                type="button"
                class="-mt-1 cursor-pointer p-1.5 text-mist-400 transition hover:text-mist-100"
                title="Next Month"
                @click="shiftMonth(1)">
                <fa-icon
                    icon="chevron-right"
                    class="text-xs" />
            </button>
        </div>
    </div>
</template>
