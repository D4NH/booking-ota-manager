import { computed, type Ref, type ShallowRef } from 'vue';
import { useGoogleSheets } from '@/composables/useGoogleSheets';
import { db } from '@/db';
import { normalizeDate } from '@/utils/date';
import type {
    PersonalFinance,
    SharedFinance,
    AggregatedSavingsAccount,
    PersonalOwner,
    OwnerMonthlyMetrics,
} from '@/types/finance';
import {
    REGEX_SAVINGS_TAG,
    isDateInMonth,
    sortNewestFirst,
    calculateGrowthPct,
} from '@/utils/finance';

const SPREADSHEET_ID = import.meta.env.VITE_FINANCE_SPREADSHEET_ID as string;

function calculateOwnerMetrics(
    personalList: PersonalFinance[],
    sharedList: SharedFinance[],
    owner: PersonalOwner | 'Shared',
    currentCycle: string,
    prevCycle: string
): OwnerMonthlyMetrics {
    let inflow = 0;
    let outflow = 0;
    let savings = 0;
    let prevInflow = 0;
    let prevOutflow = 0;

    const items: (PersonalFinance | SharedFinance)[] =
        owner === 'Shared' ? sharedList : personalList.filter((item) => item.owner === owner);

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item?.date) continue;

        const category = item.category?.toLowerCase().trim();
        const amount = Number(item.amount) || 0;
        const isCurrent = isDateInMonth(item.date, currentCycle);
        const isPrev = isDateInMonth(item.date, prevCycle);
        const isIncome = item.type === 'income';
        const isExpense = item.type === 'expense' || item.type === 'fixed_cost';

        if (isCurrent) {
            if (category === 'savings') {
                savings += amount;
            } else if (category !== 'gold') {
                if (isIncome) {
                    inflow += amount;
                } else if (isExpense) {
                    outflow += amount;
                }
            }
        }

        if (isPrev) {
            if (category !== 'savings' && category !== 'gold') {
                if (isIncome) {
                    prevInflow += amount;
                } else if (isExpense) {
                    prevOutflow += amount;
                }
            }
        }
    }

    return {
        inflow,
        outflow,
        savings,
        net: inflow - outflow - savings,
        prevInflow,
        prevOutflow,
        revenueGrowthPct: calculateGrowthPct(inflow, prevInflow),
        expenseGrowthPct: calculateGrowthPct(outflow, prevOutflow),
    };
}

export function usePersonalFinance(
    personalFinances: ShallowRef<PersonalFinance[]>,
    sharedFinances: ShallowRef<SharedFinance[]>,
    selectedMonth: Ref<string>,
    previousMonth: Ref<string>
) {
    const { appendSheetRow, updateSheetRowById, deleteSheetRowById } = useGoogleSheets();

    const filteredPersonalFinances = computed<PersonalFinance[]>(() =>
        personalFinances.value
            .filter((item) => isDateInMonth(item.date, selectedMonth.value))
            .sort(sortNewestFirst)
    );
    const filteredSharedFinances = computed<SharedFinance[]>(() =>
        sharedFinances.value
            .filter((item) => isDateInMonth(item.date, selectedMonth.value))
            .sort(sortNewestFirst)
    );
    const dynamicSavingsTransactions = computed<PersonalFinance[]>(() =>
        personalFinances.value
            .filter((item) => item.category.trim().toLowerCase() === 'savings')
            .sort(sortNewestFirst)
    );
    const dynamicSavingsAccounts = computed<AggregatedSavingsAccount[]>(() => {
        const groups = new Map<string, AggregatedSavingsAccount>();
        const txs = dynamicSavingsTransactions.value;

        for (let i = 0; i < txs.length; i++) {
            const tx = txs[i];
            if (!tx) continue;

            let inst = tx.savingsInstitution?.trim() || '';
            if (!inst && tx.notes) {
                const match = REGEX_SAVINGS_TAG.exec(tx.notes);
                inst = match?.[1] || 'BCA';
            } else if (!inst) {
                inst = 'BCA';
            }

            const groupKey = `${tx.owner}-${inst.toLowerCase()}`;
            const existing = groups.get(groupKey);
            const amount = Number(tx.amount) || 0;

            if (existing) {
                existing.balance += amount;
                existing.transactionCount += 1;
                if (tx.date > existing.lastUpdated) existing.lastUpdated = tx.date;
            } else {
                groups.set(groupKey, {
                    key: groupKey,
                    owner: tx.owner,
                    institution: inst,
                    balance: amount,
                    lastUpdated: tx.date,
                    transactionCount: 1,
                });
            }
        }

        return Array.from(groups.values()).sort((a, b) => b.balance - a.balance);
    });
    const dynamicTotalSavings = computed<number>(() =>
        dynamicSavingsAccounts.value.reduce((sum, acc) => sum + acc.balance, 0)
    );
    const danhMetrics = computed<OwnerMonthlyMetrics>(() =>
        calculateOwnerMetrics(
            personalFinances.value,
            sharedFinances.value,
            'Danh Nguyen',
            selectedMonth.value,
            previousMonth.value
        )
    );
    const citraMetrics = computed<OwnerMonthlyMetrics>(() =>
        calculateOwnerMetrics(
            personalFinances.value,
            sharedFinances.value,
            'Citra Ayu Wardani',
            selectedMonth.value,
            previousMonth.value
        )
    );
    const sharedMetrics = computed<OwnerMonthlyMetrics>(() =>
        calculateOwnerMetrics(
            personalFinances.value,
            sharedFinances.value,
            'Shared',
            selectedMonth.value,
            previousMonth.value
        )
    );
    const allHouseholdMetrics = computed<OwnerMonthlyMetrics>(() => {
        const d = danhMetrics.value;
        const c = citraMetrics.value;
        const s = sharedMetrics.value;
        const inflow = d.inflow + c.inflow + s.inflow;
        const outflow = d.outflow + c.outflow + s.outflow;
        const savings = d.savings + c.savings + s.savings;
        const prevInflow = d.prevInflow + c.prevInflow + s.prevInflow;
        const prevOutflow = d.prevOutflow + c.prevOutflow + s.prevOutflow;

        return {
            inflow,
            outflow,
            savings,
            net: inflow - outflow - savings,
            prevInflow,
            prevOutflow,
            revenueGrowthPct: calculateGrowthPct(inflow, prevInflow),
            expenseGrowthPct: calculateGrowthPct(outflow, prevOutflow),
        };
    });

    function getOwnerFinancialMetrics(
        owner: PersonalOwner | 'Shared' | 'All' = 'All'
    ): OwnerMonthlyMetrics {
        if (owner === 'All') return allHouseholdMetrics.value;
        if (owner === 'Danh Nguyen') return danhMetrics.value;
        if (owner === 'Citra Ayu Wardani') return citraMetrics.value;
        return sharedMetrics.value;
    }
    async function addPersonalTransaction(payload: Omit<PersonalFinance, 'id'>): Promise<void> {
        if (!SPREADSHEET_ID) throw new Error('Missing Google Sheets database configuration.');

        const id = crypto.randomUUID();
        const cleanDate = normalizeDate(payload.date);
        const createdAt = new Date().toISOString();

        const item: PersonalFinance = {
            ...payload,
            id,
            date: cleanDate,
            createdAt,
        };

        await appendSheetRow(
            SPREADSHEET_ID,
            [
                id,
                item.owner,
                item.type,
                item.category,
                item.amount,
                cleanDate,
                item.notes,
                item.savingsInstitution || '',
                item.goldWeightGrams || '',
            ],
            "'Personal_Transactions'!A1"
        );

        personalFinances.value = [...personalFinances.value, item];
        await db.personalFinances.put(item);
    }
    async function addSharedTransaction(payload: Omit<SharedFinance, 'id'>): Promise<void> {
        const id = crypto.randomUUID();
        const cleanDate = normalizeDate(payload.date);
        const createdAt = new Date().toISOString();

        const item: SharedFinance = {
            ...payload,
            id,
            date: cleanDate,
            createdAt,
        };

        await appendSheetRow(
            SPREADSHEET_ID,
            [id, item.type, item.category, item.amount, cleanDate, item.notes],
            "'Shared_Transactions'!A1"
        );

        sharedFinances.value = [...sharedFinances.value, item];
        await db.sharedFinances.put(item);
    }
    async function updatePersonalTransaction(
        id: string,
        payload: Omit<PersonalFinance, 'id'>
    ): Promise<void> {
        const cleanDate = normalizeDate(payload.date);
        const updatedRecord: PersonalFinance = { ...payload, id, date: cleanDate };

        await updateSheetRowById(
            SPREADSHEET_ID,
            id,
            [
                id,
                updatedRecord.owner,
                updatedRecord.type,
                updatedRecord.category,
                updatedRecord.amount,
                cleanDate,
                updatedRecord.notes,
                updatedRecord.savingsInstitution || '',
                updatedRecord.goldWeightGrams || '',
            ],
            'Personal_Transactions'
        );

        personalFinances.value = personalFinances.value.map((i) =>
            i.id === id ? updatedRecord : i
        );
        await db.personalFinances.put(updatedRecord);
    }
    async function updateSharedTransaction(
        id: string,
        payload: Omit<SharedFinance, 'id'>
    ): Promise<void> {
        const cleanDate = normalizeDate(payload.date);
        const updatedRecord: SharedFinance = { ...payload, id, date: cleanDate };

        await updateSheetRowById(
            SPREADSHEET_ID,
            id,
            [
                id,
                updatedRecord.type,
                updatedRecord.category,
                updatedRecord.amount,
                cleanDate,
                updatedRecord.notes,
            ],
            'Shared_Transactions'
        );

        sharedFinances.value = sharedFinances.value.map((i) => (i.id === id ? updatedRecord : i));
        await db.sharedFinances.put(updatedRecord);
    }
    async function deletePersonalTransaction(id: string): Promise<void> {
        await deleteSheetRowById(SPREADSHEET_ID, id, 'Personal_Transactions');
        personalFinances.value = personalFinances.value.filter((i) => i.id !== id);
        await db.personalFinances.delete(id);
    }
    async function deleteSharedTransaction(id: string): Promise<void> {
        await deleteSheetRowById(SPREADSHEET_ID, id, 'Shared_Transactions');
        sharedFinances.value = sharedFinances.value.filter((i) => i.id !== id);
        await db.sharedFinances.delete(id);
    }

    return {
        filteredPersonalFinances,
        filteredSharedFinances,
        dynamicSavingsTransactions,
        dynamicSavingsAccounts,
        dynamicTotalSavings,
        getOwnerFinancialMetrics,
        addPersonalTransaction,
        addSharedTransaction,
        updatePersonalTransaction,
        updateSharedTransaction,
        deletePersonalTransaction,
        deleteSharedTransaction,
    };
}
