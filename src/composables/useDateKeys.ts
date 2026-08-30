import { computed, ref, onMounted, onUnmounted } from 'vue';

/**
 * Format a Date object to YYYY-MM-DD
 */
export const toISODateString = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

/**
 * Format a Date object to YYYY-MM
 */
export const toISOMonthString = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
};

/**
 * Reactive date keys composable for filtering bookings
 */
export function useDateKeys() {
    const now = ref(new Date());
    const currentHour = ref<number>(new Date().getHours());

    let hourlyTimer: ReturnType<typeof setInterval> | null = null;

    let midnightTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleMidnightRefresh = () => {
        const today = new Date();
        const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
        const msUntilMidnight = tomorrow.getTime() - today.getTime();

        midnightTimer = setTimeout(() => {
            now.value = new Date();
            scheduleMidnightRefresh();
        }, msUntilMidnight);
    };

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

    // 1. "YYYY-MM-DD"
    const todayStr = computed(() => toISODateString(now.value));

    // 2. "YYYY-MM"
    const currentMonthKey = computed(() => toISOMonthString(now.value));

    // 3. "YYYY-MM" for Previous Month
    const lastMonthKey = computed(() => {
        const d = new Date(now.value.getFullYear(), now.value.getMonth() - 1, 1);
        return toISOMonthString(d);
    });

    return {
        now,
        todayStr,
        currentMonthKey,
        lastMonthKey,
        currentHour,
    };
}
