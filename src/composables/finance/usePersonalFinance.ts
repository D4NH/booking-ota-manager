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

    // Current Month Income & Expense Resolvers
    const calculateRevenueForOwner = (
        ownerName: PersonalFinance['owner'],
        targetMonth: string
    ): number => {
        let sum = 0;
        const list = personalFinances.value;
        for (let i = 0; i < list.length; i++) {
            const item = list[i];
            if (!item || item.owner !== ownerName || !isDateInMonth(item.date, targetMonth))
                continue;
            if (item.type === 'income') sum += Number(item.amount);
        }
        return sum;
    };
    const calculateExpensesForOwner = (
        ownerName: PersonalFinance['owner'],
        targetMonth: string
    ): number => {
        let sum = 0;
        const list = personalFinances.value;
        for (let i = 0; i < list.length; i++) {
            const item = list[i];
            if (!item || item.owner !== ownerName || !isDateInMonth(item.date, targetMonth))
                continue;
            if (item.type === 'expense' || item.type === 'fixed_cost') sum += Number(item.amount);
        }
        return sum;
    };

    // Current Month Metrics
    const danhMonthlyRevenue = computed<number>(() =>
        calculateRevenueForOwner('Danh Nguyen', selectedMonth.value)
    );
    const danhMonthlyExpenses = computed<number>(() =>
        calculateExpensesForOwner('Danh Nguyen', selectedMonth.value)
    );
    const danhNetBalance = computed<number>(
        () => danhMonthlyRevenue.value - danhMonthlyExpenses.value
    );

    const citraMonthlyRevenue = computed<number>(() =>
        calculateRevenueForOwner('Citra Ayu Wardani', selectedMonth.value)
    );
    const citraMonthlyExpenses = computed<number>(() =>
        calculateExpensesForOwner('Citra Ayu Wardani', selectedMonth.value)
    );
    const citraNetBalance = computed<number>(
        () => citraMonthlyRevenue.value - citraMonthlyExpenses.value
    );

    // Shared Current Month Metrics
    const sharedMonthlyRevenue = computed<number>(() => {
        let sum = 0;
        const list = sharedFinances.value;
        for (let i = 0; i < list.length; i++) {
            const item = list[i];
            if (item && isDateInMonth(item.date, selectedMonth.value) && item.type === 'income') {
                sum += Number(item.amount);
            }
        }
        return sum;
    });
    const sharedMonthlyExpenses = computed<number>(() => {
        let sum = 0;
        const list = sharedFinances.value;
        for (let i = 0; i < list.length; i++) {
            const item = list[i];
            if (
                item &&
                isDateInMonth(item.date, selectedMonth.value) &&
                (item.type === 'expense' || item.type === 'fixed_cost')
            ) {
                sum += Number(item.amount);
            }
        }
        return sum;
    });
    const sharedNetBalance = computed<number>(
        () => sharedMonthlyRevenue.value - sharedMonthlyExpenses.value
    );

    // Previous Month Historical Baselines
    const danhPreviousMonthRevenue = computed<number>(() =>
        calculateRevenueForOwner('Danh Nguyen', previousMonth.value)
    );
    const danhPreviousMonthExpenses = computed<number>(() =>
        calculateExpensesForOwner('Danh Nguyen', previousMonth.value)
    );

    const citraPreviousMonthRevenue = computed<number>(() =>
        calculateRevenueForOwner('Citra Ayu Wardani', previousMonth.value)
    );
    const citraPreviousMonthExpenses = computed<number>(() =>
        calculateExpensesForOwner('Citra Ayu Wardani', previousMonth.value)
    );

    const sharedPreviousMonthRevenue = computed<number>(() => {
        let sum = 0;
        const list = sharedFinances.value;
        for (let i = 0; i < list.length; i++) {
            const item = list[i];
            if (item && isDateInMonth(item.date, previousMonth.value) && item.type === 'income') {
                sum += Number(item.amount);
            }
        }
        return sum;
    });
    const sharedPreviousMonthExpenses = computed<number>(() => {
        let sum = 0;
        const list = sharedFinances.value;
        for (let i = 0; i < list.length; i++) {
            const item = list[i];
            if (
                item &&
                isDateInMonth(item.date, previousMonth.value) &&
                (item.type === 'expense' || item.type === 'fixed_cost')
            ) {
                sum += Number(item.amount);
            }
        }
        return sum;
    });

    // Growth Percentages vs Previous Month
    const danhRevenueGrowthPct = computed<number | null>(() =>
        calculateGrowthPct(danhMonthlyRevenue.value, danhPreviousMonthRevenue.value)
    );
    const danhExpenseGrowthPct = computed<number | null>(() =>
        calculateGrowthPct(danhMonthlyExpenses.value, danhPreviousMonthExpenses.value)
    );

    const citraRevenueGrowthPct = computed<number | null>(() =>
        calculateGrowthPct(citraMonthlyRevenue.value, citraPreviousMonthRevenue.value)
    );
    const citraExpenseGrowthPct = computed<number | null>(() =>
        calculateGrowthPct(citraMonthlyExpenses.value, citraPreviousMonthExpenses.value)
    );

    const sharedRevenueGrowthPct = computed<number | null>(() =>
        calculateGrowthPct(sharedMonthlyRevenue.value, sharedPreviousMonthRevenue.value)
    );
    const sharedExpenseGrowthPct = computed<number | null>(() =>
        calculateGrowthPct(sharedMonthlyExpenses.value, sharedPreviousMonthExpenses.value)
    );

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

        // Write to local replica only after Google Sheets returns 200 OK
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

        danhPreviousMonthRevenue,
        danhPreviousMonthExpenses,
        citraPreviousMonthRevenue,
        citraPreviousMonthExpenses,
        sharedPreviousMonthRevenue,
        sharedPreviousMonthExpenses,

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
