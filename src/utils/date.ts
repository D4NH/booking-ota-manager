/**
 * Current date formatted to YYYY-MM-DD in local time
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
    const d = new Date(date);
    d.setMonth(d.getMonth() - 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');

    return `${year}-${month}`;
};

/**
 * Current year formatted to YYYY
 */
export const getCurrentYear = (date: Date = new Date()): string => String(date.getFullYear());

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

    if (isNaN(date.getTime())) return '';

    const monthName = date.toLocaleDateString('en-US', { month: monthFormat });
    const day = String(date.getDate()).padStart(2, '0');

    if (options.includeYear) return `${day} ${monthName} ${date.getFullYear()}`;
    if (options.monthHeader) return `${monthName} ${date.getFullYear()}`;
    if (options.monthOnly) return `${monthName}`;

    return `${day} ${monthName}`;
};

/**
 * Accurately calculates nights between two 'YYYY-MM-DD' dates.
 * Uses Date.UTC to eliminate timezone or hour-shift discrepancies.
 */
export const calculateNights = (checkIn: string, checkOut: string): number => {
    const [y1, m1, d1] = checkIn.split('-').map(Number);
    const [y2, m2, d2] = checkOut.split('-').map(Number);

    if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return 1;

    const start = Date.UTC(y1, m1 - 1, d1);
    const end = Date.UTC(y2, m2 - 1, d2);
    const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));

    return diff > 0 ? diff : 1;
};

// Date offset helper without timezone issues
export const getOffsetDate = (dateStr: string, offsetDays: number): string => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(Number(y), Number(m) - 1, Number(d) + offsetDays);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
