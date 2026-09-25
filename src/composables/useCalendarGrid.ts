import { ref, computed, watch, toValue, type MaybeRefOrGetter } from 'vue';
import type { Booking } from '@/types/booking';
import type { CalendarDay } from '@/types/calendar';
import { getCurrentDate, getOffsetDate } from '@/utils/date';

export function useCalendarGrid(bookingsSource: MaybeRefOrGetter<Booking[]>) {
    const currentDate = ref<Date>(new Date());
    const selectedMonth = ref<number>(currentDate.value.getMonth());
    const selectedYear = ref<number>(currentDate.value.getFullYear());

    // Sync dropdown selectors when currentDate shifts
    watch(
        currentDate,
        (d) => {
            selectedMonth.value = d.getMonth();
            selectedYear.value = d.getFullYear();
        },
        { immediate: true }
    );

    // 42-cell matrix (6 weeks) including previous and next month padding
    const calendarDays = computed<CalendarDay[]>(() => {
        const year = selectedYear.value;
        const month = selectedMonth.value;

        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);

        // Shift to Monday-first (Mon = 0, Sun = 6)
        const rawDayIndex = firstDayOfMonth.getDay();
        const startingDayOfWeek = (rawDayIndex + 6) % 7;
        const totalDaysInMonth = lastDayOfMonth.getDate();

        const todayStr = getCurrentDate(new Date());
        const days: CalendarDay[] = [];

        // Previous month padding
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = startingDayOfWeek - 1; i >= 0; i--) {
            const prevDate = new Date(year, month - 1, prevMonthLastDay - i);
            const dateStr = getCurrentDate(prevDate);
            days.push({
                dateStr,
                dayNumber: prevMonthLastDay - i,
                isCurrentMonth: false,
                isToday: dateStr === todayStr,
            });
        }

        // Current month active days
        for (let day = 1; day <= totalDaysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            days.push({
                dateStr,
                dayNumber: day,
                isCurrentMonth: true,
                isToday: dateStr === todayStr,
            });
        }

        // Next month padding to fulfill 42 cells
        const remainingCells = 42 - days.length;
        for (let day = 1; day <= remainingCells; day++) {
            const nextDate = new Date(year, month + 1, day);
            const dateStr = getCurrentDate(nextDate);
            days.push({
                dateStr,
                dayNumber: day,
                isCurrentMonth: false,
                isToday: dateStr === todayStr,
            });
        }

        return days;
    });

    // Years extracted from bookings
    const yearOptions = computed<number[]>(() => {
        const list = toValue(bookingsSource);
        const years = new Set<number>();

        for (const b of list) {
            if (b.checkIn && b.checkIn.length >= 4) {
                const inYear = Number(b.checkIn.slice(0, 4));
                if (!Number.isNaN(inYear)) years.add(inYear);
            }
            if (b.checkOut && b.checkOut.length >= 4) {
                const outYear = Number(b.checkOut.slice(0, 4));
                if (!Number.isNaN(outYear)) years.add(outYear);
            }
        }

        if (years.size === 0) {
            years.add(new Date().getFullYear());
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

    function getStaysForDate(dateStr: string): Booking[] {
        return staysByDateMap.value.get(dateStr) || [];
    }

    function multiDayStyling(b: Booking, dateStr: string, dayIndex: number): string {
        const dayOfWeek = dayIndex % 7; // Mon = 0, Sun = 6
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
        currentDate.value = new Date(selectedYear.value, selectedMonth.value - 1, 1);
    }

    function nextMonth(): void {
        currentDate.value = new Date(selectedYear.value, selectedMonth.value + 1, 1);
    }

    function goToToday(): void {
        currentDate.value = new Date();
    }

    function setMonth(newMonth: number): void {
        currentDate.value = new Date(selectedYear.value, newMonth, 1);
    }

    function setYear(newYear: number): void {
        currentDate.value = new Date(newYear, selectedMonth.value, 1);
    }

    return {
        currentDate,
        selectedMonth,
        selectedYear,
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
