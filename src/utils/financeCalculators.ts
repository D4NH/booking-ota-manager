import { normalizeDate } from '@/utils/date';

export const REGEX_MHJ_BOOKING = /\[MHJ-BOOKING:\s*([^\]]+)\]/;
export const REGEX_SAVINGS_TAG = /\[(BCA|Bank Jago|Blu by BCA|Seabank|Mandiri|Bibit)\]/i;

export function capitalize(str: string): string {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

export function getPreviousMonthStr(currentCycle: string): string {
    const parts = currentCycle.split('-');
    let year = Number(parts[0]);
    let month = Number(parts[1]) - 1;
    if (month === 0) {
        month = 12;
        year -= 1;
    }
    return `${year}-${String(month).padStart(2, '0')}`;
}

export function isDateInMonth(dateStr: string, targetMonth: string): boolean {
    return Boolean(dateStr && normalizeDate(dateStr).startsWith(targetMonth));
}

export function sortNewestFirst<T extends { date: string; amount: number; id: string }>(
    a: T,
    b: T
): number {
    const dateComp = b.date.localeCompare(a.date);
    if (dateComp !== 0) return dateComp;
    const amountDiff = Number(b.amount) - Number(a.amount);
    if (amountDiff !== 0) return amountDiff;
    return b.id.localeCompare(a.id);
}

export function calculateGrowthPct(curr: number, prev: number): number | null {
    if (prev === 0) return null;
    return Number((((curr - prev) / prev) * 100).toFixed(1));
}

export const OWNER_PAYOUT_RATE = 0.15;

export function calculateOwnerPayout(grossPayout: number | string | null | undefined): number {
    const num = Number(grossPayout);
    if (isNaN(num) || num <= 0) return 0;
    return Math.round(num * OWNER_PAYOUT_RATE);
}

export interface SbnMaturityInfo {
    progressPct: number;
    monthsLeft: number;
    isMatured: boolean;
}

export function calculateSbnMaturity(
    issueDateStr?: string,
    maturityDateStr?: string,
    referenceDate: Date = new Date()
): SbnMaturityInfo {
    if (!issueDateStr || !maturityDateStr) {
        return { progressPct: 0, monthsLeft: 0, isMatured: false };
    }

    const [y1, m1, d1] = issueDateStr.split('-').map(Number);
    const [y2, m2, d2] = maturityDateStr.split('-').map(Number);
    if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) {
        return { progressPct: 0, monthsLeft: 0, isMatured: false };
    }

    const issueMs = Date.UTC(y1, m1 - 1, d1);
    const maturityMs = Date.UTC(y2, m2 - 1, d2);
    const currentMs = Date.UTC(
        referenceDate.getFullYear(),
        referenceDate.getMonth(),
        referenceDate.getDate()
    );

    const totalTenorMs = maturityMs - issueMs;
    if (totalTenorMs <= 0) {
        return { progressPct: 100, monthsLeft: 0, isMatured: true };
    }

    const elapsedMs = Math.max(0, currentMs - issueMs);
    const progressPct = Math.min(100, Math.max(0, Math.round((elapsedMs / totalTenorMs) * 100)));

    const curYear = referenceDate.getFullYear();
    const curMonth = referenceDate.getMonth();
    const curDay = referenceDate.getDate();

    let monthsLeft = (y2 - curYear) * 12 + (m2 - 1 - curMonth);
    if (d2 < curDay) {
        monthsLeft = Math.max(0, monthsLeft - 1);
    }
    monthsLeft = Math.max(0, monthsLeft);

    return {
        progressPct,
        monthsLeft,
        isMatured: currentMs >= maturityMs,
    };
}
