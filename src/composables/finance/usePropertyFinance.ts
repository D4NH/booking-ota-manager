import { computed, type Ref, type ShallowRef } from 'vue';
import { db } from '@/db';
import { useGoogleSheets } from '@/composables/useGoogleSheets';
import { useBookingStore } from '@/stores/useBookingStore';
import { normalizeDate } from '@/utils/date';
import {
    REGEX_MHJ_BOOKING,
    isDateInMonth,
    sortNewestFirst,
    calculateGrowthPct,
} from '@/utils/financeCalculators';
import type { Booking } from '@/types/booking';
import type { PropertyFinance } from '@/types/finance';

const SPREADSHEET_ID = import.meta.env.VITE_FINANCE_SPREADSHEET_ID as string;

export function usePropertyFinance(
    sheetPropertyFinances: ShallowRef<PropertyFinance[]>,
    selectedMonth: Ref<string>,
    previousMonth: Ref<string>
) {
    const bookingStore = useBookingStore();
    const { appendSheetRow, updateSheetRowByBookingId, deleteSheetRowById } = useGoogleSheets();

    const bookingIncomeRecords = computed<PropertyFinance[]>(() => {
        const eligibleStatuses = new Set(['Completed', 'Waiting for payout', 'Checked-in']);
        return bookingStore.bookings
            .filter((b: Booking) => eligibleStatuses.has(b.status) && Number(b.payout) > 0)
            .map((b: Booking): PropertyFinance => ({
                id: `dexie-${b.bookingId}`,
                bookingId: b.bookingId,
                propertyId: b.propertyId,
                type: 'income',
                category: 'Property Payout',
                amount: Number(b.payout),
                date: normalizeDate(b.checkIn),
                notes: `${b.listing} | ${b.guestName}`,
            }));
    });
    const unifiedPropertyFinances = computed<PropertyFinance[]>(() => {
        const existingBookingIds = new Set<string>();
        const sheetsList = sheetPropertyFinances.value;

        for (let i = 0; i < sheetsList.length; i++) {
            const item = sheetsList[i];
            if (!item) continue;
            if (item.bookingId) {
                existingBookingIds.add(item.bookingId);
            } else if (item.notes) {
                const match = REGEX_MHJ_BOOKING.exec(item.notes);
                if (match?.[1]) existingBookingIds.add(match[1].trim());
            }
        }

        const syntheticEntries = bookingIncomeRecords.value.filter(
            (entry) => !existingBookingIds.has(entry.bookingId || '')
        );

        return [...sheetsList, ...syntheticEntries];
    });
    const filteredPropertyFinances = computed(() =>
        unifiedPropertyFinances.value
            .filter((item) => isDateInMonth(item.date, selectedMonth.value))
            .sort(sortNewestFirst)
    );
    const monthlyPropertyRevenue = computed<number>(() => {
        let sum = 0;
        const list = filteredPropertyFinances.value;
        for (let i = 0; i < list.length; i++) {
            const item = list[i];
            if (!item) continue;
            if (
                item.type === 'income' &&
                item.category !== 'Owner Payout Outflow' &&
                item.category !== 'Mai House Jogja Share'
            ) {
                sum += Number(item.amount);
            }
        }
        return sum;
    });
    const monthlyPropertyExpenses = computed<number>(() => {
        let sum = 0;
        const list = filteredPropertyFinances.value;
        for (let i = 0; i < list.length; i++) {
            const item = list[i];
            if (!item) continue;
            if (item.type === 'expense' && item.category !== 'Owner Payout Outflow') {
                sum += Number(item.amount);
            }
        }
        return sum;
    });
    const monthlyOwnerDraws = computed<number>(() => {
        let sum = 0;
        const list = filteredPropertyFinances.value;
        for (let i = 0; i < list.length; i++) {
            const item = list[i];
            if (item?.category === 'Owner Payout Outflow') sum += Number(item.amount);
        }
        return sum;
    });
    const netPropertyProfit = computed<number>(
        () => monthlyPropertyRevenue.value - monthlyPropertyExpenses.value
    );
    const previousMonthPropertyRevenue = computed<number>(() => {
        let sum = 0;
        const list = unifiedPropertyFinances.value;
        for (let i = 0; i < list.length; i++) {
            const item = list[i];
            if (!item) continue;
            if (
                isDateInMonth(item.date, previousMonth.value) &&
                item.type === 'income' &&
                item.category !== 'Owner Payout Outflow' &&
                item.category !== 'Mai House Jogja Share'
            ) {
                sum += Number(item.amount);
            }
        }
        return sum;
    });
    const previousMonthPropertyExpenses = computed<number>(() => {
        let sum = 0;
        const list = unifiedPropertyFinances.value;
        for (let i = 0; i < list.length; i++) {
            const item = list[i];
            if (!item) continue;
            if (
                isDateInMonth(item.date, previousMonth.value) &&
                item.type === 'expense' &&
                item.category !== 'Owner Payout Outflow'
            ) {
                sum += Number(item.amount);
            }
        }
        return sum;
    });
    const propertyRevenueGrowthPct = computed<number | null>(() =>
        calculateGrowthPct(monthlyPropertyRevenue.value, previousMonthPropertyRevenue.value)
    );
    const propertyExpenseGrowthPct = computed<number | null>(() =>
        calculateGrowthPct(monthlyPropertyExpenses.value, previousMonthPropertyExpenses.value)
    );

    async function addPropertyTransaction(payload: Omit<PropertyFinance, 'id'>): Promise<void> {
        const id = crypto.randomUUID();
        const cleanDate = normalizeDate(payload.date);
        const item: PropertyFinance = { ...payload, id, date: cleanDate };

        await appendSheetRow(
            SPREADSHEET_ID,
            [id, item.propertyId, item.type, item.category, item.amount, cleanDate, item.notes],
            "'Property_Finances'!A1"
        );
        sheetPropertyFinances.value = [...sheetPropertyFinances.value, item];
        await db.propertyFinances.put(item);
    }

    async function updatePropertyTransaction(
        id: string,
        payload: Omit<PropertyFinance, 'id'>
    ): Promise<void> {
        if (id.startsWith('dexie-')) {
            throw new Error('Auto-populated Dexie booking records cannot be edited here.');
        }

        const cleanDate = normalizeDate(payload.date);
        const updatedRecord: PropertyFinance = { ...payload, id, date: cleanDate };

        await updateSheetRowByBookingId(
            SPREADSHEET_ID,
            id,
            [
                id,
                updatedRecord.propertyId,
                updatedRecord.type,
                updatedRecord.category,
                updatedRecord.amount,
                cleanDate,
                updatedRecord.notes,
            ],
            'Property_Finances'
        );

        sheetPropertyFinances.value = sheetPropertyFinances.value.map((i) =>
            i.id === id ? updatedRecord : i
        );
        await db.propertyFinances.put(updatedRecord);
    }

    async function deletePropertyTransaction(id: string): Promise<void> {
        if (id.startsWith('dexie-')) {
            throw new Error('This transaction is auto-populated from Dexie bookings.');
        }

        await deleteSheetRowById(SPREADSHEET_ID, id, { sheetName: 'Property_Finances' });
        sheetPropertyFinances.value = sheetPropertyFinances.value.filter((i) => i.id !== id);
        await db.propertyFinances.delete(id);
    }

    async function persistDexieBookingsToRemoteSheet(): Promise<number> {
        const existingIds = new Set<string>();
        const finances = sheetPropertyFinances.value;

        for (let i = 0; i < finances.length; i++) {
            const item = finances[i];
            if (!item) continue;
            if (item.bookingId) existingIds.add(item.bookingId);
            const match = REGEX_MHJ_BOOKING.exec(item.notes || '');
            if (match?.[1]) existingIds.add(match[1].trim());
        }

        const unrecorded = bookingIncomeRecords.value.filter(
            (entry) => !existingIds.has(entry.bookingId || '')
        );

        const newEntries: PropertyFinance[] = [];
        for (let i = 0; i < unrecorded.length; i++) {
            const record = unrecorded[i];
            if (!record) continue;
            const rowId = crypto.randomUUID();
            const taggedNotes = `[MHJ-BOOKING: ${record.bookingId}] ${record.notes}`;
            await appendSheetRow(
                SPREADSHEET_ID,
                [
                    rowId,
                    record.propertyId,
                    record.type,
                    record.category,
                    record.amount,
                    record.date,
                    taggedNotes,
                ],
                "'Property_Finances'!A1"
            );

            newEntries.push({ ...record, id: rowId, notes: taggedNotes });
        }

        sheetPropertyFinances.value = [...sheetPropertyFinances.value, ...newEntries];
        await db.propertyFinances.bulkPut(newEntries);
        return unrecorded.length;
    }

    return {
        bookingIncomeRecords,
        unifiedPropertyFinances,
        filteredPropertyFinances,
        monthlyPropertyRevenue,
        monthlyPropertyExpenses,
        monthlyOwnerDraws,
        netPropertyProfit,
        previousMonthPropertyRevenue,
        previousMonthPropertyExpenses,
        propertyRevenueGrowthPct,
        propertyExpenseGrowthPct,
        addPropertyTransaction,
        updatePropertyTransaction,
        deletePropertyTransaction,
        persistDexieBookingsToRemoteSheet,
    };
}
