<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { DAYS_OF_WEEK, MONTH_NAMES_SHORT } from '@/config/constants';
import {
    formatDate,
    getCurrentDate,
    getPreviousMonth,
    getDaysInMonth,
    normalizeDate,
    parseISODate,
} from '@/utils/date';

export type DatePickerMode = 'single' | 'range' | 'month';
export type DatePickerValue =
    string | [string, string] | { start: string; end: string } | null | undefined;

interface CalendarCell {
    dateStr: string;
    dayNumber: number;
    isCurrentMonth: boolean;
}

interface Coordinates {
    top: number;
    left: number;
    width: number;
}

interface Props {
    inputLabel?: string;
    mode?: DatePickerMode;
    selectTodayByDefault?: boolean;
    minDate?: Date | string | null;
    maxDate?: Date | string | null;
    width?: number;
    placeholder?: string;
}

const VIEWPORT_PADDING = 12;

const {
    inputLabel = 'Date',
    mode = 'single',
    selectTodayByDefault = false,
    minDate = null,
    maxDate = null,
    width = 320,
    placeholder = '',
} = defineProps<Props>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: string | [string, string]): void;
    (e: 'change', value: string | [string, string]): void;
}>();

const modelValue = defineModel<DatePickerValue>({ default: '' });

const todayStr = getCurrentDate();
const todayDate = parseISODate(todayStr);

const isOpen = ref<boolean>(false);
const triggerButtonRef = ref<HTMLButtonElement | null>(null);
const popoverRef = ref<HTMLDivElement | null>(null);
const viewYear = ref<number>(todayDate.getFullYear());
const viewMonth = ref<number>(todayDate.getMonth());
const coords = ref<Coordinates>({ top: 0, left: 0, width: 0 });
const singleDate = ref<string>('');
const rangeStart = ref<string>('');
const rangeEnd = ref<string>('');
const hoverDate = ref<string>('');

const minDateStr = computed<string>(() => (minDate ? normalizeDate(minDate) : ''));
const maxDateStr = computed<string>(() => (maxDate ? normalizeDate(maxDate) : ''));

const currentViewCycleStr = computed<string>(
    () => `${viewYear.value}-${String(viewMonth.value + 1).padStart(2, '0')}`
);
const monthHeading = computed<string>(() =>
    formatDate(currentViewCycleStr.value, { monthHeader: true })
);
const calendarGrid = computed<CalendarCell[]>(() => {
    const year = viewYear.value;
    const month = viewMonth.value;

    const firstDay = parseISODate(`${currentViewCycleStr.value}-01`);
    const startingOffset = (firstDay.getDay() + 6) % 7;
    const totalDaysInMonth = getDaysInMonth(currentViewCycleStr.value);

    const cells: CalendarCell[] = [];

    const prevMonthCycle = getPreviousMonth(firstDay);
    const prevMonthLastDate = getDaysInMonth(prevMonthCycle);
    for (let i = startingOffset - 1; i >= 0; i--) {
        const d = prevMonthLastDate - i;
        const dateStr = `${prevMonthCycle}-${String(d).padStart(2, '0')}`;
        cells.push({ dateStr, dayNumber: d, isCurrentMonth: false });
    }

    for (let d = 1; d <= totalDaysInMonth; d++) {
        const dateStr = `${currentViewCycleStr.value}-${String(d).padStart(2, '0')}`;
        cells.push({ dateStr, dayNumber: d, isCurrentMonth: true });
    }

    const nextMonthIndex = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    const nextMonthCycle = `${nextYear}-${String(nextMonthIndex + 1).padStart(2, '0')}`;

    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
        const dateStr = `${nextMonthCycle}-${String(d).padStart(2, '0')}`;
        cells.push({ dateStr, dayNumber: d, isCurrentMonth: false });
    }

    return cells;
});
const effectiveRangeEnd = computed<string>(() => rangeEnd.value || hoverDate.value);
const displayValue = computed<string>(() => {
    if (mode === 'month') {
        if (!singleDate.value) return placeholder || 'Select month';
        return formatDate(singleDate.value.slice(0, 7), { monthHeader: true });
    }

    if (mode === 'range') {
        if (rangeStart.value && rangeEnd.value) {
            const startTxt = formatDate(rangeStart.value, { shortWeekday: true, shortMonth: true });
            const endTxt = formatDate(rangeEnd.value, { shortWeekday: true, shortMonth: true });
            return `${startTxt} → ${endTxt}`;
        }
        if (rangeStart.value) {
            return `${formatDate(rangeStart.value, { shortWeekday: true, shortMonth: true })} → Select checkout`;
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

watch(
    () => modelValue.value,
    (val: DatePickerValue) => {
        syncFromModelValue(val);
    },
    { immediate: true }
);

onMounted(() => {
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, { capture: true });
});

onUnmounted(() => {
    document.removeEventListener('mousedown', handleClickOutside);
    window.removeEventListener('resize', handleViewportChange);
    window.removeEventListener('scroll', handleViewportChange, { capture: true });
});

function handleViewportChange(): void {
    if (isOpen.value) {
        updateCoordinates();
    }
}
function syncFromModelValue(val: DatePickerValue): void {
    if (!val) {
        singleDate.value = selectTodayByDefault
            ? mode === 'month'
                ? todayStr.slice(0, 7)
                : todayStr
            : '';
        rangeStart.value = '';
        rangeEnd.value = '';
        return;
    }

    if (mode === 'month') {
        const clean = normalizeDate(val).slice(0, 7);
        singleDate.value = clean;
        if (clean) {
            const d = parseISODate(clean);
            viewYear.value = d.getFullYear();
            viewMonth.value = d.getMonth();
        }
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
}
function updateCoordinates(): void {
    if (!triggerButtonRef.value) return;
    const rect = triggerButtonRef.value.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const elementWidth =
        popoverRef.value?.offsetWidth || Math.min(width, viewportWidth - VIEWPORT_PADDING * 2);
    const elementHeight = popoverRef.value?.offsetHeight || 320;

    let targetLeft = rect.left;
    if (targetLeft + elementWidth > viewportWidth - VIEWPORT_PADDING) {
        targetLeft = viewportWidth - elementWidth - VIEWPORT_PADDING;
    }
    if (targetLeft < VIEWPORT_PADDING) {
        targetLeft = VIEWPORT_PADDING;
    }

    let targetTop = rect.bottom + 6;
    if (
        targetTop + elementHeight > viewportHeight - VIEWPORT_PADDING &&
        rect.top > elementHeight + VIEWPORT_PADDING
    ) {
        targetTop = rect.top - elementHeight - 6;
    }

    coords.value = {
        top: Math.round(targetTop),
        left: Math.round(targetLeft),
        width: Math.round(rect.width),
    };
}
async function toggleDatepicker(): Promise<void> {
    isOpen.value = !isOpen.value;
    if (isOpen.value) {
        hoverDate.value = '';
        await nextTick();
        updateCoordinates();
    }
}
function prevMonth(): void {
    const prevMonthStr = getPreviousMonth(parseISODate(currentViewCycleStr.value));
    const [y, m] = prevMonthStr.split('-').map(Number);
    if (y && m) {
        viewYear.value = y;
        viewMonth.value = m - 1;
    }
}
function nextMonth(): void {
    if (viewMonth.value === 11) {
        viewMonth.value = 0;
        viewYear.value++;
    } else {
        viewMonth.value++;
    }
}
function prevYear(): void {
    viewYear.value--;
}
function nextYear(): void {
    viewYear.value++;
}
function isRangeStart(dateStr: string): boolean {
    return mode === 'range' && rangeStart.value === dateStr;
}
function isRangeEnd(dateStr: string): boolean {
    return (
        (mode === 'range' && rangeEnd.value !== '' && rangeEnd.value === dateStr) ||
        (!rangeEnd.value && hoverDate.value === dateStr && hoverDate.value > rangeStart.value)
    );
}
function isInRange(dateStr: string): boolean {
    if (mode !== 'range' || !rangeStart.value || !effectiveRangeEnd.value) return false;
    const start = rangeStart.value;
    const end = effectiveRangeEnd.value;
    return start < end ? dateStr > start && dateStr < end : dateStr > end && dateStr < start;
}
function isDateDisabled(dateStr: string): boolean {
    if (minDateStr.value && dateStr < minDateStr.value) return true;
    if (maxDateStr.value && dateStr > maxDateStr.value) return true;
    return false;
}
function isMonthDisabled(monthIndex: number): boolean {
    const cycleStr = `${viewYear.value}-${String(monthIndex + 1).padStart(2, '0')}`;
    if (minDateStr.value && cycleStr < minDateStr.value.slice(0, 7)) return true;
    if (maxDateStr.value && cycleStr > maxDateStr.value.slice(0, 7)) return true;
    return false;
}
function selectCell(cell: CalendarCell): void {
    if (isDateDisabled(cell.dateStr)) return;

    if (mode === 'range') {
        if (!rangeStart.value || (rangeStart.value && rangeEnd.value)) {
            rangeStart.value = cell.dateStr;
            rangeEnd.value = '';
            hoverDate.value = '';
        } else if (rangeStart.value && !rangeEnd.value) {
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
}
function selectMonth(monthIndex: number): void {
    if (isMonthDisabled(monthIndex)) return;
    const result = `${viewYear.value}-${String(monthIndex + 1).padStart(2, '0')}`;
    singleDate.value = result;
    modelValue.value = result;
    emit('update:modelValue', result);
    emit('change', result);
    isOpen.value = false;
}
function handleCellHover(dateStr: string): void {
    if (mode === 'range' && rangeStart.value && !rangeEnd.value) {
        hoverDate.value = dateStr;
    }
}
function handleClickOutside(event: MouseEvent): void {
    const target = event.target as Node;
    if (
        triggerButtonRef.value &&
        !triggerButtonRef.value.contains(target) &&
        popoverRef.value &&
        !popoverRef.value.contains(target)
    ) {
        isOpen.value = false;
    }
}
</script>

<template>
    <div class="relative w-full">
        <span
            v-if="inputLabel.length"
            class="mb-1 block text-xs font-medium text-mist-400">
            {{ inputLabel }}
        </span>

        <button
            ref="triggerButtonRef"
            type="button"
            class="flex h-8.5 w-full cursor-pointer items-center rounded-md bg-mist-950/50 px-3 py-2 text-left font-mono text-xs text-mist-200 transition-colors hover:border-mist-700 focus:border-lime-500 focus:outline-hidden"
            :class="[
                mode === 'month'
                    ? 'justify-center hover:text-lime-400'
                    : 'justify-between border border-mist-800',
            ]"
            @click="toggleDatepicker">
            <span :class="{ 'text-mist-500': !singleDate && !rangeStart }">
                {{ displayValue }}
            </span>
            <fa-icon
                v-if="mode !== 'month'"
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
                    class="fixed z-100 max-w-[calc(100vw-24px)] rounded-md border border-mist-800 bg-mist-950/75 p-4 pt-2 text-mist-100 shadow-md backdrop-blur-md select-none"
                    :style="{
                        top: `${coords.top + 1}px`,
                        left: `${mode === 'month' ? coords.left - 3.5 : coords.left - 1}px`,
                        width: `${width}px`,
                    }">
                    <div
                        v-if="mode === 'month'"
                        class="space-y-2">
                        <div class="flex items-center justify-between">
                            <button
                                type="button"
                                class="-mt-1 cursor-pointer rounded p-1.5 text-mist-400 transition hover:bg-mist-800 hover:text-mist-100"
                                @click="prevYear">
                                <fa-icon
                                    class="text-xs"
                                    icon="chevron-left" />
                            </button>

                            <span class="font-mono text-sm font-bold text-mist-100">
                                {{ viewYear }}
                            </span>

                            <button
                                type="button"
                                class="-mt-1 cursor-pointer rounded p-1.5 text-mist-400 transition hover:bg-mist-800 hover:text-mist-100"
                                @click="nextYear">
                                <fa-icon
                                    class="text-xs"
                                    icon="chevron-right" />
                            </button>
                        </div>

                        <div class="grid grid-cols-3 gap-2">
                            <button
                                v-for="(name, mIdx) in MONTH_NAMES_SHORT"
                                :key="name"
                                type="button"
                                :disabled="isMonthDisabled(mIdx)"
                                class="rounded-sm border py-2.5 text-center font-mono text-xs font-medium transition"
                                :class="[
                                    isMonthDisabled(mIdx)
                                        ? 'cursor-not-allowed border-transparent text-mist-700 opacity-40'
                                        : singleDate ===
                                            `${viewYear}-${String(mIdx + 1).padStart(2, '0')}`
                                          ? 'bg-lime-500 font-bold text-mist-950 shadow-sm'
                                          : viewYear === todayDate.getFullYear() &&
                                              mIdx === todayDate.getMonth()
                                            ? 'border-lime-600 bg-mist-900 text-mist-100 hover:border-lime-400'
                                            : 'border-mist-800 bg-mist-900/60 text-mist-300 hover:border-mist-700 hover:bg-mist-800 hover:text-mist-100',
                                ]"
                                @click="selectMonth(mIdx)">
                                {{ name }}
                            </button>
                        </div>
                    </div>

                    <div
                        v-else
                        class="space-y-3">
                        <div class="flex items-center justify-between">
                            <button
                                type="button"
                                class="cursor-pointer rounded p-1 text-mist-400 transition hover:bg-mist-800 hover:text-mist-100"
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
                                class="cursor-pointer rounded p-1 text-mist-400 transition hover:bg-mist-800 hover:text-mist-100"
                                @click="nextMonth">
                                <fa-icon
                                    class="text-xs"
                                    icon="chevron-right" />
                            </button>
                        </div>

                        <div
                            class="grid grid-cols-7 gap-0 text-center font-mono text-[10px] text-mist-500 uppercase">
                            <div
                                v-for="day in DAYS_OF_WEEK"
                                :key="day"
                                class="py-1">
                                {{ day }}
                            </div>
                        </div>

                        <div class="grid grid-cols-7 gap-y-1 text-center font-mono text-xs">
                            <button
                                v-for="cell in calendarGrid"
                                :key="cell.dateStr"
                                type="button"
                                :disabled="isDateDisabled(cell.dateStr)"
                                class="relative flex h-8 cursor-pointer items-center justify-center transition-colors focus:outline-hidden disabled:cursor-not-allowed"
                                :class="[
                                    isDateDisabled(cell.dateStr)
                                        ? 'text-mist-700 line-through opacity-40 hover:bg-transparent'
                                        : '',

                                    !cell.isCurrentMonth && !isDateDisabled(cell.dateStr)
                                        ? 'text-mist-600'
                                        : 'text-mist-200',

                                    mode === 'single' && singleDate === cell.dateStr
                                        ? 'rounded-md bg-lime-500 font-bold text-mist-950'
                                        : '',

                                    isRangeStart(cell.dateStr)
                                        ? 'z-10 rounded-l-md bg-lime-500 font-bold text-mist-950'
                                        : '',

                                    isRangeEnd(cell.dateStr)
                                        ? 'z-10 rounded-r-md bg-lime-500 font-bold text-mist-950'
                                        : '',

                                    isInRange(cell.dateStr)
                                        ? 'rounded-none bg-lime-500/20 text-lime-200'
                                        : '',

                                    !isRangeStart(cell.dateStr) &&
                                    !isRangeEnd(cell.dateStr) &&
                                    !isInRange(cell.dateStr) &&
                                    (mode === 'single' ? singleDate !== cell.dateStr : true) &&
                                    !isDateDisabled(cell.dateStr)
                                        ? 'rounded-md hover:bg-mist-800'
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

                        <div
                            v-if="mode === 'range'"
                            class="flex items-center justify-between border-t border-mist-800/80 pt-2 text-xs text-mist-400">
                            <span>
                                {{ rangeStart ? 'Click to set checkout' : 'Click to set check-in' }}
                            </span>
                            <button
                                v-if="rangeStart"
                                type="button"
                                class="cursor-pointer text-xs font-medium text-mist-400 underline hover:text-rose-400"
                                @click="
                                    rangeStart = '';
                                    rangeEnd = '';
                                    hoverDate = '';
                                ">
                                Reset
                            </button>
                        </div>
                    </div>
                </div>
            </transition>
        </Teleport>
    </div>
</template>
