import { ref, computed, watch, toValue, type MaybeRefOrGetter } from 'vue';
import type { Booking } from '@/types/booking';
import type { CalendarDay } from '@/types/calendar';
import {
    getCurrentDate,
    getCurrentMonth,
    getPreviousMonth,
    getDaysInMonth,
    parseISODate,
    getOffsetDate,
} from '@/utils/date';

export function useCalendarGrid(bookingsSource: MaybeRefOrGetter<Booking[]>) {
    const todayIso = getCurrentDate();
    const todayParsed = parseISODate(todayIso);

    const currentDate = ref<Date>(todayParsed);
    const selectedMonth = ref<number>(todayParsed.getMonth());
    const selectedYear = ref<number>(todayParsed.getFullYear());

    const currentMonth = computed<string>(() => getCurrentMonth());

    const selectedCycle = computed<string>(
        () => `${selectedYear.value}-${String(selectedMonth.value + 1).padStart(2, '0')}`
    );

    const isCurrentMonth = computed<boolean>(() => selectedCycle.value === currentMonth.value);

    const calendarDays = computed<CalendarDay[]>(() => {
        const year = selectedYear.value;
        const month = selectedMonth.value;
        const activeCycleStr = selectedCycle.value;

        const firstDayOfMonth = parseISODate(`${activeCycleStr}-01`);
        const startingOffset = (firstDayOfMonth.getDay() + 6) % 7;
        const totalDaysInMonth = getDaysInMonth(activeCycleStr);

        const todayStr = getCurrentDate();
        const days: CalendarDay[] = [];

        const prevCycle = getPreviousMonth(firstDayOfMonth);
        const prevMonthLastDay = getDaysInMonth(prevCycle);

        for (let i = startingOffset - 1; i >= 0; i--) {
            const d = prevMonthLastDay - i;
            const dateStr = `${prevCycle}-${String(d).padStart(2, '0')}`;
            days.push({
                dateStr,
                dayNumber: d,
                isCurrentMonth: false,
                isToday: dateStr === todayStr,
            });
        }

        for (let d = 1; d <= totalDaysInMonth; d++) {
            const dateStr = `${activeCycleStr}-${String(d).padStart(2, '0')}`;
            days.push({
                dateStr,
                dayNumber: d,
                isCurrentMonth: true,
                isToday: dateStr === todayStr,
            });
        }

        const nextMonthIndex = month === 11 ? 0 : month + 1;
        const nextYear = month === 11 ? year + 1 : year;
        const nextCycle = `${nextYear}-${String(nextMonthIndex + 1).padStart(2, '0')}`;

        const remaining = 42 - days.length;
        for (let d = 1; d <= remaining; d++) {
            const dateStr = `${nextCycle}-${String(d).padStart(2, '0')}`;
            days.push({
                dateStr,
                dayNumber: d,
                isCurrentMonth: false,
                isToday: dateStr === todayStr,
            });
        }

        return days;
    });

    const yearOptions = computed<number[]>(() => {
        const list = toValue(bookingsSource) || [];
        const years = new Set<number>();

        for (let i = 0; i < list.length; i++) {
            const b = list[i];
            if (b?.checkIn && b.checkIn.length >= 4) {
                const inYear = Number(b.checkIn.slice(0, 4));
                if (!Number.isNaN(inYear)) years.add(inYear);
            }
            if (b?.checkOut && b.checkOut.length >= 4) {
                const outYear = Number(b.checkOut.slice(0, 4));
                if (!Number.isNaN(outYear)) years.add(outYear);
            }
        }

        if (years.size === 0) {
            years.add(parseISODate(getCurrentDate()).getFullYear());
        } else if (!years.has(selectedYear.value)) {
            years.add(selectedYear.value);
        }

        return Array.from(years).sort((a, b) => a - b);
    });

    const staysByDateMap = computed<Map<string, Booking[]>>(() => {
        const list = toValue(bookingsSource) || [];
        const map = new Map<string, Booking[]>();

        for (let i = 0; i < list.length; i++) {
            const b = list[i];
            if (!b?.checkIn || !b?.checkOut) continue;

            const [y1, m1, d1] = b.checkIn.split('-').map(Number);
            const [y2, m2, d2] = b.checkOut.split('-').map(Number);
            if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) continue;

            const cur = new Date(Date.UTC(y1, m1 - 1, d1));
            const end = new Date(Date.UTC(y2, m2 - 1, d2));

            while (cur < end) {
                const dateStr = cur.toISOString().slice(0, 10);
                const bucket = map.get(dateStr) ?? [];
                bucket.push(b);
                map.set(dateStr, bucket);
                cur.setUTCDate(cur.getUTCDate() + 1);
            }
        }

        for (const stays of map.values()) {
            stays.sort((a, b) => {
                const aIsMulti = a.nights > 1 ? 1 : 0;
                const bIsMulti = b.nights > 1 ? 1 : 0;
                if (aIsMulti !== bIsMulti) return bIsMulti - aIsMulti;
                if (a.checkIn !== b.checkIn) return a.checkIn.localeCompare(b.checkIn);
                if (a.nights !== b.nights) return b.nights - a.nights;
                return (a.id || a.bookingId).localeCompare(b.id || b.bookingId);
            });
        }

        return map;
    });

    watch(
        currentDate,
        (d) => {
            selectedMonth.value = d.getMonth();
            selectedYear.value = d.getFullYear();
        },
        { immediate: true }
    );

    function getStaysForDate(dateStr: string): Booking[] {
        return staysByDateMap.value.get(dateStr) || [];
    }

    function multiDayStyling(b: Booking, dateStr: string, dayIndex: number): string {
        const dayOfWeek = dayIndex % 7;
        const isCheckIn = b.checkIn === dateStr;
        const lastNight = getOffsetDate(b.checkOut, -1);
        const isLastNight = lastNight === dateStr;
        const isSingleNight = b.nights === 1 || (isCheckIn && isLastNight);

        if (isSingleNight) return 'rounded-sm mx-0 border';

        const classes: string[] = ['border-y'];
        if (isCheckIn || dayOfWeek === 0) {
            classes.push('rounded-l-sm ml-0 border-l');
        } else {
            classes.push('rounded-l-none -ml-2 border-l-0 pl-3');
        }

        if (isLastNight || dayOfWeek === 6) {
            classes.push('rounded-r-sm mr-0 border-r');
        } else {
            classes.push('rounded-r-none -mr-2 border-r-0');
        }

        return classes.join(' ');
    }

    function prevMonth(): void {
        const prev = getPreviousMonth(parseISODate(`${selectedCycle.value}-01`));
        const [y, m] = prev.split('-').map(Number);
        if (y && m) {
            selectedYear.value = y;
            selectedMonth.value = m - 1;
            currentDate.value = new Date(y, m - 1, 1);
        }
    }

    function nextMonth(): void {
        if (selectedMonth.value === 11) {
            selectedMonth.value = 0;
            selectedYear.value++;
        } else {
            selectedMonth.value++;
        }
        currentDate.value = new Date(selectedYear.value, selectedMonth.value, 1);
    }

    function goToToday(): void {
        const today = parseISODate(getCurrentDate());
        currentDate.value = today;
        selectedMonth.value = today.getMonth();
        selectedYear.value = today.getFullYear();
    }

    function setMonth(newMonth: number): void {
        selectedMonth.value = newMonth;
        currentDate.value = new Date(selectedYear.value, newMonth, 1);
    }

    function setYear(newYear: number): void {
        selectedYear.value = newYear;
        currentDate.value = new Date(newYear, selectedMonth.value, 1);
    }

    return {
        currentDate,
        selectedMonth,
        selectedYear,
        currentMonth,
        selectedCycle,
        isCurrentMonth,
        calendarDays,
        yearOptions,
        getStaysForDate,
        multiDayStyling,
        prevMonth,
        nextMonth,
        goToToday,
        setMonth,
        setYear,
    };
}
