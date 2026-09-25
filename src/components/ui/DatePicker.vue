<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { DAYS_OF_WEEK, MONTH_NAMES } from '@/config/constants';
import { formatDate, getCurrentDate, normalizeDate, parseISODate } from '@/utils/date';

export type DatePickerMode = 'single' | 'range';
export type DatePickerValue =
    string | [string, string] | { start: string; end: string } | null | undefined;

interface Props {
    inputLabel?: string;
    mode?: DatePickerMode;
    selectTodayByDefault?: boolean;
    minDate?: Date | string | null;
    maxDate?: Date | string | null;
    width?: number;
    placeholder?: string;
}

const {
    inputLabel = 'Date',
    mode = 'single',
    selectTodayByDefault = false,
    minDate = null,
    maxDate = null,
    width = 420,
    placeholder = '',
} = defineProps<Props>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: string | [string, string]): void;
    (e: 'change', value: string | [string, string]): void;
}>();

const modelValue = defineModel<DatePickerValue>({ default: '' });

// State
const isOpen = ref<boolean>(false);
const triggerButtonRef = ref<HTMLButtonElement | null>(null);
const popoverRef = ref<HTMLDivElement | null>(null);
const coords = ref({ top: 0, left: 0, width: 0 });

// Internal Canonical String State ('YYYY-MM-DD')
const singleDate = ref<string>('');
const rangeStart = ref<string>('');
const rangeEnd = ref<string>('');
const hoverDate = ref<string>('');

const todayStr = getCurrentDate();
const todayDate = parseISODate(todayStr);

// Active View Month & Year
const viewYear = ref<number>(todayDate.getFullYear());
const viewMonth = ref<number>(todayDate.getMonth()); // 0-11

// Boundaries
const minDateStr = computed(() => (minDate ? normalizeDate(minDate) : ''));
const maxDateStr = computed(() => (maxDate ? normalizeDate(maxDate) : ''));

/**
 * Parses any incoming prop format into canonical YYYY-MM-DD strings
 */
const syncFromModelValue = (val: DatePickerValue): void => {
    if (!val) {
        singleDate.value = selectTodayByDefault ? todayStr : '';
        rangeStart.value = '';
        rangeEnd.value = '';
        return;
    }

    if (mode === 'range') {
        if (Array.isArray(val)) {
            rangeStart.value = normalizeDate(val[0]);
            rangeEnd.value = normalizeDate(val[1]);
        } else if (typeof val === 'object' && 'start' in val) {
            rangeStart.value = normalizeDate(val.start);
            rangeEnd.value = normalizeDate(val.end);
        } else if (typeof val === 'string' && val.includes(',')) {
            const [s, e] = val.split(',');
            rangeStart.value = normalizeDate(s);
            rangeEnd.value = normalizeDate(e);
        }

        if (rangeStart.value) {
            const d = parseISODate(rangeStart.value);
            viewYear.value = d.getFullYear();
            viewMonth.value = d.getMonth();
        }
    } else {
        const clean = normalizeDate(val);
        singleDate.value = clean;
        if (clean) {
            const d = parseISODate(clean);
            viewYear.value = d.getFullYear();
            viewMonth.value = d.getMonth();
        }
    }
};

watch(() => modelValue.value, syncFromModelValue, { immediate: true });

// Popover Positioning (Uses getBoundingClientRect without scrollY for fixed overlay)
const updateCoordinates = (): void => {
    if (!triggerButtonRef.value) return;
    const rect = triggerButtonRef.value.getBoundingClientRect();

    coords.value = {
        top: rect.bottom,
        left: rect.left,
        width: rect.width,
    };
};

const toggleDatepicker = async (): Promise<void> => {
    isOpen.value = !isOpen.value;
    if (isOpen.value) {
        hoverDate.value = '';
        await nextTick();
        updateCoordinates();
    }
};

// Navigation
const monthHeading = computed<string>(() => `${MONTH_NAMES[viewMonth.value]} ${viewYear.value}`);

const prevMonth = (): void => {
    if (viewMonth.value === 0) {
        viewMonth.value = 11;
        viewYear.value--;
    } else {
        viewMonth.value--;
    }
};

const nextMonth = (): void => {
    if (viewMonth.value === 11) {
        viewMonth.value = 0;
        viewYear.value++;
    } else {
        viewMonth.value++;
    }
};

// 42-cell matrix calculation with canonical dateStr attached to every cell
interface CalendarCell {
    dateStr: string;
    dayNumber: number;
    isCurrentMonth: boolean;
}

const calendarGrid = computed<CalendarCell[]>(() => {
    const year = viewYear.value;
    const month = viewMonth.value;

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Monday-first offset (Mon=0, Sun=6)
    const startingOffset = (firstDay.getDay() + 6) % 7;
    const totalDaysInMonth = lastDay.getDate();

    const cells: CalendarCell[] = [];

    // Previous month padding
    const prevMonthLastDate = new Date(year, month, 0).getDate();
    for (let i = startingOffset - 1; i >= 0; i--) {
        const d = prevMonthLastDate - i;
        const prevMonthIndex = month === 0 ? 11 : month - 1;
        const prevYear = month === 0 ? year - 1 : year;
        const dateStr = `${prevYear}-${String(prevMonthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        cells.push({ dateStr, dayNumber: d, isCurrentMonth: false });
    }

    // Current month active days
    for (let d = 1; d <= totalDaysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        cells.push({ dateStr, dayNumber: d, isCurrentMonth: true });
    }

    // Next month padding to fulfill 42 cells
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
        const nextMonthIndex = month === 11 ? 0 : month + 1;
        const nextYear = month === 11 ? year + 1 : year;
        const dateStr = `${nextYear}-${String(nextMonthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        cells.push({ dateStr, dayNumber: d, isCurrentMonth: false });
    }

    return cells;
});

const isDateDisabled = (dateStr: string): boolean => {
    if (minDateStr.value && dateStr < minDateStr.value) return true;
    if (maxDateStr.value && dateStr > maxDateStr.value) return true;
    return false;
};

const selectCell = (cell: CalendarCell): void => {
    if (isDateDisabled(cell.dateStr)) return;

    if (mode === 'range') {
        if (!rangeStart.value || (rangeStart.value && rangeEnd.value)) {
            // First click: reset and set start
            rangeStart.value = cell.dateStr;
            rangeEnd.value = '';
            hoverDate.value = '';
        } else if (rangeStart.value && !rangeEnd.value) {
            // Second click: set end or invert if clicked before start
            if (cell.dateStr < rangeStart.value) {
                rangeEnd.value = rangeStart.value;
                rangeStart.value = cell.dateStr;
            } else if (cell.dateStr === rangeStart.value) {
                rangeEnd.value = '';
                return;
            } else {
                rangeEnd.value = cell.dateStr;
            }

            const result: [string, string] = [rangeStart.value, rangeEnd.value];
            modelValue.value = result;
            emit('update:modelValue', result);
            emit('change', result);
            isOpen.value = false;
        }
    } else {
        singleDate.value = cell.dateStr;
        modelValue.value = cell.dateStr;
        emit('update:modelValue', cell.dateStr);
        emit('change', cell.dateStr);
        isOpen.value = false;
    }
};

const handleCellHover = (dateStr: string): void => {
    if (mode === 'range' && rangeStart.value && !rangeEnd.value) {
        hoverDate.value = dateStr;
    }
};

// Range State Styling Helpers
const effectiveRangeEnd = computed(() => rangeEnd.value || hoverDate.value);

const isRangeStart = (dateStr: string): boolean => mode === 'range' && rangeStart.value === dateStr;
const isRangeEnd = (dateStr: string): boolean =>
    mode === 'range' &&
    ((rangeEnd.value !== '' && rangeEnd.value === dateStr) ||
        (!rangeEnd.value && hoverDate.value === dateStr && hoverDate.value > rangeStart.value));
const isInRange = (dateStr: string): boolean => {
    if (mode !== 'range' || !rangeStart.value || !effectiveRangeEnd.value) return false;
    const start = rangeStart.value;
    const end = effectiveRangeEnd.value;
    return start < end ? dateStr > start && dateStr < end : dateStr > end && dateStr < start;
};

const displayValue = computed<string>(() => {
    if (mode === 'range') {
        if (rangeStart.value && rangeEnd.value) {
            const startTxt = formatDate(rangeStart.value, { shortWeekday: true, shortMonth: true });
            const endTxt = formatDate(rangeEnd.value, { shortWeekday: true, shortMonth: true });
            return `${startTxt} → ${endTxt}`;
        }
        if (rangeStart.value) {
            return `${formatDate(rangeStart.value, { shortWeekday: true, shortMonth: true })} → Select checkout date`;
        }
        return placeholder || 'Select stay dates';
    }

    if (singleDate.value) {
        return formatDate(singleDate.value, {
            shortWeekday: true,
            shortMonth: true,
            includeYear: true,
        });
    }

    return placeholder || 'Select date';
});

const handleClickOutside = (event: MouseEvent): void => {
    const target = event.target as Node;
    if (
        triggerButtonRef.value &&
        !triggerButtonRef.value.contains(target) &&
        popoverRef.value &&
        !popoverRef.value.contains(target)
    ) {
        isOpen.value = false;
    }
};

onMounted(() => {
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', updateCoordinates);
    window.addEventListener('scroll', updateCoordinates, { capture: true });
});

onUnmounted(() => {
    document.removeEventListener('mousedown', handleClickOutside);
    window.removeEventListener('resize', updateCoordinates);
    window.removeEventListener('scroll', updateCoordinates, { capture: true });
});
</script>

<template>
    <div class="relative w-full">
        <span
            v-if="inputLabel"
            class="block font-medium text-xs text-mist-400 mb-1">
            {{ inputLabel }}
        </span>

        <button
            ref="triggerButtonRef"
            type="button"
            class="w-full flex items-center justify-between px-3 py-2 bg-mist-950/50 border border-mist-800 rounded-md text-xs font-mono text-mist-200 focus:border-lime-500 focus:outline-hidden transition-colors text-left cursor-pointer hover:border-mist-700"
            @click="toggleDatepicker">
            <span :class="{ 'text-mist-500': !singleDate && !rangeStart }">
                {{ displayValue }}
            </span>
            <fa-icon
                class="text-mist-500"
                icon="calendar-days" />
        </button>

        <Teleport to="body">
            <transition
                enter-active-class="transition ease-out duration-100"
                enter-from-class="transform opacity-0 scale-95"
                enter-to-class="transform opacity-100 scale-100"
                leave-active-class="transition ease-in duration-75"
                leave-from-class="transform opacity-100 scale-100"
                leave-to-class="transform opacity-0 scale-95">
                <div
                    v-if="isOpen"
                    ref="popoverRef"
                    class="fixed z-999 bg-mist-950/90 backdrop-blur-xl border border-mist-800 rounded-lg shadow-2xl p-3.5 select-none box-border text-mist-100 font-sans"
                    :style="{
                        top: `${coords.top + 6}px`,
                        left: `${coords.left}px`,
                        minWidth: `${width}px`,
                    }">
                    <!-- Month Navigation Header -->
                    <div class="flex items-center justify-between mb-3">
                        <button
                            type="button"
                            class="p-1 rounded text-mist-400 hover:bg-mist-800 hover:text-mist-100 transition cursor-pointer"
                            @click="prevMonth">
                            <fa-icon
                                class="text-xs"
                                icon="chevron-left" />
                        </button>

                        <span class="text-sm font-medium text-mist-200">
                            {{ monthHeading }}
                        </span>

                        <button
                            type="button"
                            class="p-1 rounded text-mist-400 hover:bg-mist-800 hover:text-mist-100 transition cursor-pointer"
                            @click="nextMonth">
                            <fa-icon
                                class="text-xs"
                                icon="chevron-right" />
                        </button>
                    </div>

                    <!-- Weekday Labels -->
                    <div
                        class="grid grid-cols-7 gap-0 text-center text-[10px] font-mono mb-1 text-mist-500 uppercase">
                        <div
                            v-for="day in DAYS_OF_WEEK"
                            :key="day"
                            class="py-1">
                            {{ day }}
                        </div>
                    </div>

                    <!-- Days Grid -->
                    <div class="grid grid-cols-7 gap-y-1 gap-x-0 text-center text-xs font-mono">
                        <button
                            v-for="cell in calendarGrid"
                            :key="cell.dateStr"
                            type="button"
                            :disabled="isDateDisabled(cell.dateStr)"
                            class="h-8 flex items-center justify-center transition-colors relative cursor-pointer disabled:cursor-not-allowed focus:outline-hidden"
                            :class="[
                                isDateDisabled(cell.dateStr)
                                    ? 'text-mist-700 line-through opacity-40 hover:bg-transparent'
                                    : '',

                                !cell.isCurrentMonth && !isDateDisabled(cell.dateStr)
                                    ? 'text-mist-600'
                                    : 'text-mist-200',

                                mode === 'single' && singleDate === cell.dateStr
                                    ? 'bg-lime-500 text-mist-950 font-bold rounded-md'
                                    : '',

                                isRangeStart(cell.dateStr)
                                    ? 'bg-lime-500 text-mist-950 font-bold rounded-l-md z-10'
                                    : '',

                                isRangeEnd(cell.dateStr)
                                    ? 'bg-lime-500 text-mist-950 font-bold rounded-r-md z-10'
                                    : '',

                                isInRange(cell.dateStr)
                                    ? 'bg-lime-500/20 text-lime-200 rounded-none'
                                    : '',

                                !isRangeStart(cell.dateStr) &&
                                !isRangeEnd(cell.dateStr) &&
                                !isInRange(cell.dateStr) &&
                                (mode === 'single' ? singleDate !== cell.dateStr : true) &&
                                !isDateDisabled(cell.dateStr)
                                    ? 'hover:bg-mist-800 rounded-md'
                                    : '',

                                cell.dateStr === todayStr &&
                                singleDate !== cell.dateStr &&
                                !isRangeStart(cell.dateStr) &&
                                !isRangeEnd(cell.dateStr)
                                    ? 'border border-lime-500/40'
                                    : '',
                            ]"
                            @click="selectCell(cell)"
                            @mouseenter="handleCellHover(cell.dateStr)">
                            {{ cell.dayNumber }}
                        </button>
                    </div>

                    <!-- Range Selection Helper Footer -->
                    <div
                        v-if="mode === 'range'"
                        class="mt-3 pt-2 border-t border-mist-800/80 flex items-center justify-between text-xs text-mist-400">
                        <span>
                            {{ rangeStart ? 'Click to set checkout' : 'Click to set check-in' }}
                        </span>
                        <button
                            v-if="rangeStart"
                            type="button"
                            class="text-mist-400 font-medium hover:text-rose-400 text-xs underline cursor-pointer"
                            @click="
                                rangeStart = '';
                                rangeEnd = '';
                                hoverDate = '';
                            ">
                            Reset
                        </button>
                    </div>
                </div>
            </transition>
        </Teleport>
    </div>
</template>
