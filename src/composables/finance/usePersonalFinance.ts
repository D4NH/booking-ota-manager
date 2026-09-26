import { computed, type Ref, type ShallowRef } from 'vue';
import { db } from '@/db';
import { useGoogleSheets } from '@/composables/useGoogleSheets';
import { normalizeDate } from '@/utils/date';
import {
    REGEX_SAVINGS_TAG,
    isDateInMonth,
    sortNewestFirst,
    calculateGrowthPct,
} from '@/utils/financeCalculators';
import type { PersonalFinance, SharedFinance, AggregatedSavingsAccount } from '@/types/finance';

const SPREADSHEET_ID = import.meta.env.VITE_FINANCE_SPREADSHEET_ID as string;

type LedgerItem = {
    date: string;
    amount: number;
    type: string;
    owner?: string;
};

/**
 * Single consolidated summation for any ledger, owner, month, and type
 */
function sumTransactions(
    list: LedgerItem[],
    targetMonth: string,
    type: 'income' | 'expense',
    ownerName?: string
): number {
    let sum = 0;
    for (let i = 0; i < list.length; i++) {
        const item = list[i];
        if (!item || !isDateInMonth(item.date, targetMonth)) continue;
        if (ownerName && item.owner !== ownerName) continue;

        const isMatch =
            type === 'income'
                ? item.type === 'income'
                : item.type === 'expense' || item.type === 'fixed_cost';

        if (isMatch) sum += Number(item.amount) || 0;
    }
    return sum;
}

export function usePersonalFinance(
    personalFinances: ShallowRef<PersonalFinance[]>,
    sharedFinances: ShallowRef<SharedFinance[]>,
    selectedMonth: Ref<string>,
    previousMonth: Ref<string>
) {
    const { appendSheetRow, updateSheetRowByBookingId, deleteSheetRowById } = useGoogleSheets();

    const filteredPersonalFinances = computed(() =>
        personalFinances.value
            .filter((item) => isDateInMonth(item.date, selectedMonth.value))
            .sort(sortNewestFirst)
    );

    const filteredSharedFinances = computed(() =>
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

    // Current Month Metrics
    const danhMonthlyRevenue = computed(() =>
        sumTransactions(personalFinances.value, selectedMonth.value, 'income', 'Danh Nguyen')
    );
    const danhMonthlyExpenses = computed(() =>
        sumTransactions(personalFinances.value, selectedMonth.value, 'expense', 'Danh Nguyen')
    );
    const danhNetBalance = computed(() => danhMonthlyRevenue.value - danhMonthlyExpenses.value);

    const citraMonthlyRevenue = computed(() =>
        sumTransactions(personalFinances.value, selectedMonth.value, 'income', 'Citra Ayu Wardani')
    );
    const citraMonthlyExpenses = computed(() =>
        sumTransactions(personalFinances.value, selectedMonth.value, 'expense', 'Citra Ayu Wardani')
    );
    const citraNetBalance = computed(() => citraMonthlyRevenue.value - citraMonthlyExpenses.value);

    const sharedMonthlyRevenue = computed(() =>
        sumTransactions(sharedFinances.value, selectedMonth.value, 'income')
    );
    const sharedMonthlyExpenses = computed(() =>
        sumTransactions(sharedFinances.value, selectedMonth.value, 'expense')
    );
    const sharedNetBalance = computed(
        () => sharedMonthlyRevenue.value - sharedMonthlyExpenses.value
    );
    const combinedMonthlyRevenue = computed(
        () => danhMonthlyRevenue.value + citraMonthlyRevenue.value + sharedMonthlyRevenue.value
    );

    // Previous Month Baselines
    const danhPreviousMonthRevenue = computed(() =>
        sumTransactions(personalFinances.value, previousMonth.value, 'income', 'Danh Nguyen')
    );
    const danhPreviousMonthExpenses = computed(() =>
        sumTransactions(personalFinances.value, previousMonth.value, 'expense', 'Danh Nguyen')
    );

    const citraPreviousMonthRevenue = computed(() =>
        sumTransactions(personalFinances.value, previousMonth.value, 'income', 'Citra Ayu Wardani')
    );
    const citraPreviousMonthExpenses = computed(() =>
        sumTransactions(personalFinances.value, previousMonth.value, 'expense', 'Citra Ayu Wardani')
    );

    const sharedPreviousMonthRevenue = computed(() =>
        sumTransactions(sharedFinances.value, previousMonth.value, 'income')
    );
    const sharedPreviousMonthExpenses = computed(() =>
        sumTransactions(sharedFinances.value, previousMonth.value, 'expense')
    );

    // Growth Rates
    const danhRevenueGrowthPct = computed(() =>
        calculateGrowthPct(danhMonthlyRevenue.value, danhPreviousMonthRevenue.value)
    );
    const danhExpenseGrowthPct = computed(() =>
        calculateGrowthPct(danhMonthlyExpenses.value, danhPreviousMonthExpenses.value)
    );

    const citraRevenueGrowthPct = computed(() =>
        calculateGrowthPct(citraMonthlyRevenue.value, citraPreviousMonthRevenue.value)
    );
    const citraExpenseGrowthPct = computed(() =>
        calculateGrowthPct(citraMonthlyExpenses.value, citraPreviousMonthExpenses.value)
    );

    const sharedRevenueGrowthPct = computed(() =>
        calculateGrowthPct(sharedMonthlyRevenue.value, sharedPreviousMonthRevenue.value)
    );
    const sharedExpenseGrowthPct = computed(() =>
        calculateGrowthPct(sharedMonthlyExpenses.value, sharedPreviousMonthExpenses.value)
    );

    // Unified CRUD
    async function addPersonalTransaction(payload: Omit<PersonalFinance, 'id'>): Promise<void> {
        if (!SPREADSHEET_ID) {
            throw new Error('Missing Google Sheets database configuration. Operation aborted.');
        }

        const id = crypto.randomUUID();
        const cleanDate = normalizeDate(payload.date);
        const item: PersonalFinance = { ...payload, id, date: cleanDate };

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
        const item: SharedFinance = { ...payload, id, date: cleanDate };

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

        await updateSheetRowByBookingId(
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

        await updateSheetRowByBookingId(
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

        // Current Month
        danhNetBalance,
        citraNetBalance,
        sharedNetBalance,
        danhMonthlyRevenue,
        danhMonthlyExpenses,
        citraMonthlyRevenue,
        citraMonthlyExpenses,
        sharedMonthlyRevenue,
        sharedMonthlyExpenses,
        combinedMonthlyRevenue,

        // Previous Month
        danhPreviousMonthRevenue,
        danhPreviousMonthExpenses,
        citraPreviousMonthRevenue,
        citraPreviousMonthExpenses,
        sharedPreviousMonthRevenue,
        sharedPreviousMonthExpenses,

        // Growth
        danhRevenueGrowthPct,
        danhExpenseGrowthPct,
        citraRevenueGrowthPct,
        citraExpenseGrowthPct,
        sharedRevenueGrowthPct,
        sharedExpenseGrowthPct,

        addPersonalTransaction,
        addSharedTransaction,
        updatePersonalTransaction,
        updateSharedTransaction,
        deletePersonalTransaction,
        deleteSharedTransaction,
    };
}
