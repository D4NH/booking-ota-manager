/**
 * Format to local YYYY-MM-DD string without UTC offset issues
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
 *  - formatDate("2026-09-02", { includeYear: true }) -> "02 September, 2026"
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
        return `${day} ${monthName}, ${date.getFullYear()}`;
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
