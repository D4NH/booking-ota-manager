import { computed, ref } from 'vue';
import { getCurrentDate, getCurrentMonth, getPreviousMonth } from '@/utils/date';

/**
 * Reactive date keys composable for filtering bookings.
 *
 * Optimization: Removed time-drift logic (midnight refresh).
 * Derived values now strictly depend on Date.now(), preventing state leakage.
 */
export function useDateKeys() {
    const now = ref(new Date());

    // 1. "YYYY-MM-DD" (Current Day)
    const currentDay = computed(() => getCurrentDate(now.value));

    // 2. "YYYY-MM" (Current Month)
    const currentMonth = computed(() => getCurrentMonth(now.value));

    // 3. "YYYY-MM" for Previous Month
    const lastMonth = computed(() => getPreviousMonth(now.value));

    // Optional: Track current hour if required for time-sensitive filtering
    // Using a simple ref without interval to avoid drift, updated on demand or via effect
    const currentHour = ref<number>(new Date().getHours());

    return {
        now,
        currentDay,
        currentMonth,
        lastMonth,
        currentHour,
    };
}
