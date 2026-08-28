/**
 * Returns today's date formatted as YYYY-MM-DD in ISO format
 */
export const getTodayStr = (): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Reusable computed date string for Vue components
 */
export const todayStr = getTodayStr();
