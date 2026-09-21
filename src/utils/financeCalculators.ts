import { normalizeDate } from '@/utils/date';

export const REGEX_MHJ_BOOKING = /\[MHJ-BOOKING:\s*([^\]]+)\]/;
export const REGEX_SAVINGS_TAG = /\[(BCA|Bank Jago|Blu by BCA|Seabank|Mandiri|Bibit)\]/i;

export const capitalize = (str: string): string =>
    str ? str.charAt(0).toUpperCase() + str.slice(1) : '';

export const getPreviousMonthStr = (currentCycle: string): string => {
    const parts = currentCycle.split('-');
    let year = Number(parts[0]);
    let month = Number(parts[1]) - 1;
    if (month === 0) {
        month = 12;
        year -= 1;
    }
    return `${year}-${String(month).padStart(2, '0')}`;
};

export const isDateInMonth = (dateStr: string, targetMonth: string): boolean =>
    Boolean(dateStr && normalizeDate(dateStr).startsWith(targetMonth));

export const sortNewestFirst = <T extends { date: string; amount: number; id: string }>(
    a: T,
    b: T
): number => {
    const dateComp = b.date.localeCompare(a.date);
    if (dateComp !== 0) return dateComp;
    const amountDiff = Number(b.amount) - Number(a.amount);
    if (amountDiff !== 0) return amountDiff;
    return b.id.localeCompare(a.id);
};

export const calculateGrowthPct = (curr: number, prev: number): number | null => {
    if (prev === 0) return null;
    return Number((((curr - prev) / prev) * 100).toFixed(1));
};
