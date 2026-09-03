/**
 * Current day formatted to YYYY-MM-DD
 */
export const getCurrentDate = (date: Date = new Date()): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
};

/**
 * Current month formatted to YYYY-MM
 */
export const getCurrentMonth = (date: Date = new Date()): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    return `${year}-${month}`;
};

/**
 * Previous month formatted to YYYY-MM
 */
export const getPreviousMonth = (date: Date = new Date()): string => {
    const year = date.getFullYear();
    const month = date.getMonth();

    let prevMonth = month - 1;
    let prevYear = year;

    if (prevMonth < 0) {
        prevMonth = 11;
        prevYear -= 1;
    }

    const formattedMonth = String(prevMonth + 1).padStart(2, '0');

    return `${prevYear}-${formattedMonth}`;
};

/**
 * Returns total days in a given target month ("YYYY-MM")
 */
export const getDaysInMonth = (targetMonthStr: string): number => {
    if (!targetMonthStr) return 0;
    const [yearStr, monthStr] = targetMonthStr.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);

    if (isNaN(year) || isNaN(month)) return 0;

    // Day 0 of the following month returns the last day of the target month
    return new Date(year, month, 0).getDate();
};

/**
 * Parse an ISO date string ("YYYY-MM-DD") into a local Date object.
 * Prevents UTC timezone offset issues where dates shift back by 1 day.
 */
export const parseISODate = (isoDateStr: string): Date => {
    const [year, month, day] = isoDateStr.split('-').map(Number);
    return new Date(year || 2026, (month || 1) - 1, day || 1);
};

/**
 * Formats an ISO date string ("2026-09-02") into a readable string.
 * Example outputs:
 *  - formatDate("2026-09-02") -> "02 September"
 *  - formatDate("2026-09-02", { includeYear: true }) -> "02 September 2026"
 *  - formatDate("2026-09-02", { shortMonth: true }) -> "02 Sep"
 *  - formatDate("2026-09-02", { monthHeader: true }) -> "September 2026"
 *  - formatDate("2026-09-02", { monthOnly: true }) -> "September"
 */
export const formatDate = (
    isoDateStr: string,
    options: {
        includeYear?: boolean;
        shortMonth?: boolean;
        monthHeader?: boolean;
        monthOnly?: boolean;
    } = {}
): string => {
    if (!isoDateStr) return '';

    const date = parseISODate(isoDateStr);

    const monthFormat = options.shortMonth ? 'short' : 'long';
    const monthName = date.toLocaleDateString('en-US', { month: monthFormat });
    const day = String(date.getDate()).padStart(2, '0');

    if (options.includeYear) {
        return `${day} ${monthName} ${date.getFullYear()}`;
    }

    if (options.monthHeader) {
        return `${monthName} ${date.getFullYear()}`;
    }

    if (options.monthOnly) {
        return `${monthName}`;
    }

    return `${day} ${monthName}`;
};

/**
 * Calculate night count between check-in and check-out
 */
export const calculateNights = (checkIn: string, checkOut: string): number => {
    if (!checkIn || !checkOut) return 1;

    const start = new Date(checkIn).getTime();
    const end = new Date(checkOut).getTime();
    const diff = Math.ceil((end - start) / (1000 * 3600 * 24));

    return diff > 0 ? diff : 1;
};
