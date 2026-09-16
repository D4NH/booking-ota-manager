/**
 * Current date formatted to YYYY-MM-DD in local time
 */
export const getCurrentDate = (d: Date = new Date()): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Current month formatted to YYYY-MM
 */
export const getCurrentMonth = (d: Date = new Date()): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
};

/**
 * Previous month formatted to YYYY-MM.
 * Hardened: Sets day to 1 before shifting months to prevent 31st-day rollover.
 */
export const getPreviousMonth = (d: Date = new Date()): string => {
    const date = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
};

/**
 * Current year formatted to YYYY
 */
export const getCurrentYear = (d: Date = new Date()): string => String(d.getFullYear());

/**
 * Current local hour (0-23)
 */
export const getCurrentHour = (d: Date = new Date()): number => d.getHours();

/**
 * Returns total days in a given target month ("YYYY-MM")
 */
export const getDaysInMonth = (yearMonthStr: string): number => {
    const [year, month] = yearMonthStr.split('-').map(Number);
    if (!year || !month) return 0;
    return new Date(year, month, 0).getDate();
};

export const getCurrentWeekNumber = (d: Date = new Date()): number => {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));

    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNumber = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);

    return weekNumber;
};

/**
 * Parse an ISO date string ("YYYY-MM-DD" or "YYYY-MM") into a local Date object.
 * Prevents UTC timezone shift backward by 1 day.
 */
export const parseISODate = (isoStr: string): Date => {
    const [year, month, day = 1] = isoStr.split('-').map(Number);
    return new Date(year ?? 2026, (month ?? 1) - 1, day);
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
    if (Number.isNaN(date.getTime())) return '';

    const monthFormat = options.shortMonth ? 'short' : 'long';
    const monthName = date.toLocaleDateString('en-US', { month: monthFormat });
    const day = String(date.getDate()).padStart(2, '0');

    if (options.includeYear) return `${day} ${monthName} ${date.getFullYear()}`;
    if (options.monthHeader) return `${monthName} ${date.getFullYear()}`;
    if (options.monthOnly) return monthName;

    return `${day} ${monthName}`;
};

/**
 * Accurately calculates nights between two 'YYYY-MM-DD' dates using UTC boundaries.
 */
export const calculateNights = (checkIn: string, checkOut: string): number => {
    const [y1, m1, d1] = checkIn.split('-').map(Number);
    const [y2, m2, d2] = checkOut.split('-').map(Number);

    if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return 1;

    const start = Date.UTC(y1, m1 - 1, d1);
    const end = Date.UTC(y2, m2 - 1, d2);
    const diff = Math.round((end - start) / 86_400_000);

    return diff > 0 ? diff : 1;
};

/**
 * Shifts date by offsetDays without UTC timezone shifts.
 */
export const getOffsetDate = (dateStr: string, offsetDays: number): string => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y!, m! - 1, d! + offsetDays);
    return getCurrentDate(date);
};
