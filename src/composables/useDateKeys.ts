import { computed, ref, onMounted, onUnmounted } from 'vue';
import { getCurrentDate, getCurrentMonth } from '@/utils/date';

/**
 * Reactive date keys composable for filtering bookings
 */
export function useDateKeys() {
    const now = ref(new Date());
    const currentHour = ref<number>(new Date().getHours());

    let hourlyTimer: ReturnType<typeof setInterval> | null = null;

    let midnightTimer: ReturnType<typeof setTimeout> | null = null;

    // 1. "YYYY-MM-DD"
    const currentDayStr = computed(() => getCurrentDate(now.value));

    // 2. "YYYY-MM"
    const currentMonthKey = computed(() => getCurrentMonth(now.value));

    // 3. "YYYY-MM" for Previous Month
    const lastMonthKey = computed(() => {
        const d = new Date(now.value.getFullYear(), now.value.getMonth() - 1, 1);
        return getCurrentMonth(d);
    });

    onMounted(() => {
        scheduleMidnightRefresh();
        hourlyTimer = setInterval(() => {
            currentHour.value = new Date().getHours();
        }, 60000);
    });

    onUnmounted(() => {
        if (midnightTimer) clearTimeout(midnightTimer);
        if (hourlyTimer) clearInterval(hourlyTimer);
    });

    const scheduleMidnightRefresh = () => {
        const today = new Date();
        const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
        const msUntilMidnight = tomorrow.getTime() - today.getTime();

        midnightTimer = setTimeout(() => {
            now.value = new Date();
            scheduleMidnightRefresh();
        }, msUntilMidnight);
    };

    return {
        now,
        currentDayStr,
        currentMonthKey,
        lastMonthKey,
        currentHour,
    };
}
