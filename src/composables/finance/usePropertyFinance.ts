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
} from '@/utils/finance';
import type { PropertyFinance, PropertyMonthlyMetrics } from '@/types/finance';
import type { PropertyId } from '@/types/property';

interface RawPropertyBucket {
    revenue: number;
    expenses: number;
    ownerDraws: number;
    prevRevenue: number;
    prevExpenses: number;
}

const SPREADSHEET_ID = import.meta.env.VITE_FINANCE_SPREADSHEET_ID as string;

const ELIGIBLE_STATUSES = new Set([
    'Booked',
    'Completed',
    'Waiting for payout',
    'Checked-in',
    'No show',
]);

function createEmptyBucket(): RawPropertyBucket {
    return {
        revenue: 0,
        expenses: 0,
        ownerDraws: 0,
        prevRevenue: 0,
        prevExpenses: 0,
    };
}
function finalizeBucket(b: RawPropertyBucket): PropertyMonthlyMetrics {
    return {
        revenue: b.revenue,
        expenses: b.expenses,
        netProfit: b.revenue - b.expenses,
        ownerDraws: b.ownerDraws,
        prevRevenue: b.prevRevenue,
        prevExpenses: b.prevExpenses,
        revenueGrowthPct: calculateGrowthPct(b.revenue, b.prevRevenue),
        expenseGrowthPct: calculateGrowthPct(b.expenses, b.prevExpenses),
    };
}

const EMPTY_PROPERTY_METRICS: PropertyMonthlyMetrics = finalizeBucket(createEmptyBucket());

export function usePropertyFinance(
    sheetPropertyFinances: ShallowRef<PropertyFinance[]>,
    selectedMonth: Ref<string>,
    previousMonth: Ref<string>
) {
    const bookingStore = useBookingStore();
    const { appendSheetRow, updateSheetRowById } = useGoogleSheets();

    const recordedBookingIds = computed<Set<string>>(() => {
        const ids = new Set<string>();
        const list = sheetPropertyFinances.value;

        for (let i = 0; i < list.length; i++) {
            const item = list[i];
            if (!item) continue;

            if (item.bookingId && item.bookingId.trim()) {
                ids.add(item.bookingId.trim());
            } else if (item.notes && item.notes.includes('[MHJ-BOOKING:')) {
                const match = REGEX_MHJ_BOOKING.exec(item.notes);
                if (match?.[1]?.trim()) {
                    ids.add(match[1].trim());
                }
            }
        }
        return ids;
    });
    const unrecordedBookingRecords = computed<PropertyFinance[]>(() => {
        const recorded = recordedBookingIds.value;
        const bookings = bookingStore.bookings;
        const result: PropertyFinance[] = [];

        for (let i = 0; i < bookings.length; i++) {
            const b = bookings[i];
            if (!b || !ELIGIBLE_STATUSES.has(b.status)) continue;

            const payout = Number(b.payout);
            if (!(payout > 0)) continue;

            const bookingId = b.bookingId?.trim();
            if (bookingId && recorded.has(bookingId)) continue;

            result.push({
                id: `dexie-${b.bookingId}`,
                bookingId: b.bookingId,
                propertyId: b.propertyId,
                type: 'income',
                category: 'Property Payout',
                amount: payout,
                date: normalizeDate(b.checkIn),
                notes: `${b.listing} | ${b.guestName}`,
            });
        }

        return result;
    });
    const unifiedPropertyFinances = computed<PropertyFinance[]>(() => [
        ...sheetPropertyFinances.value,
        ...unrecordedBookingRecords.value,
    ]);
    const filteredPropertyFinances = computed<PropertyFinance[]>(() =>
        unifiedPropertyFinances.value
            .filter((item) => isDateInMonth(item.date, selectedMonth.value))
            .sort(sortNewestFirst)
    );
    const propertyMetricsMap = computed<Map<string, PropertyMonthlyMetrics>>(() => {
        const currentCycle = selectedMonth.value;
        const prevCycle = previousMonth.value;
        const list = unifiedPropertyFinances.value;

        const buckets = new Map<string, RawPropertyBucket>();
        const allBucket = createEmptyBucket();
        buckets.set('all', allBucket);

        for (let i = 0; i < list.length; i++) {
            const item = list[i];
            if (!item?.date) continue;

            const isCurrent = isDateInMonth(item.date, currentCycle);
            const isPrev = !isCurrent && isDateInMonth(item.date, prevCycle);
            if (!isCurrent && !isPrev) continue;

            const propKey = item.propertyId || 'other';
            let propBucket = buckets.get(propKey);
            if (!propBucket) {
                propBucket = createEmptyBucket();
                buckets.set(propKey, propBucket);
            }

            const amount = Number(item.amount) || 0;
            const isDraw =
                item.category === 'Owner Payout Outflow' ||
                item.category === 'Mai House Jogja Share';

            if (isCurrent) {
                if (item.category === 'Owner Payout Outflow') {
                    allBucket.ownerDraws += amount;
                    propBucket.ownerDraws += amount;
                } else if (!isDraw) {
                    if (item.type === 'income') {
                        allBucket.revenue += amount;
                        propBucket.revenue += amount;
                    } else if (item.type === 'expense') {
                        allBucket.expenses += amount;
                        propBucket.expenses += amount;
                    }
                }
            } else if (isPrev && !isDraw) {
                if (item.type === 'income') {
                    allBucket.prevRevenue += amount;
                    propBucket.prevRevenue += amount;
                } else if (item.type === 'expense') {
                    allBucket.prevExpenses += amount;
                    propBucket.prevExpenses += amount;
                }
            }
        }

        const result = new Map<string, PropertyMonthlyMetrics>();
        buckets.forEach((bucket, key) => {
            result.set(key, finalizeBucket(bucket));
        });
        return result;
    });

    function getPropertyFinancialMetrics(
        propertyId: PropertyId | 'all' | string = 'all'
    ): PropertyMonthlyMetrics {
        return propertyMetricsMap.value.get(propertyId) ?? EMPTY_PROPERTY_METRICS;
    }
    async function addPropertyTransaction(payload: Omit<PropertyFinance, 'id'>): Promise<void> {
        const id = crypto.randomUUID();
        const cleanDate = normalizeDate(payload.date);
        const createdAt = new Date().toISOString();

        const item: PropertyFinance = {
            ...payload,
            id,
            date: cleanDate,
            createdAt,
        };

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

        const existing = sheetPropertyFinances.value.find((i) => i.id === id);
        const cleanDate = normalizeDate(payload.date);
        const updatedRecord: PropertyFinance = {
            ...payload,
            id,
            date: cleanDate,
            createdAt: existing?.createdAt ?? payload.createdAt,
        };

        await updateSheetRowById(
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
    async function persistDexieBookingsToRemoteSheet(): Promise<number> {
        const unrecorded = [...unrecordedBookingRecords.value];
        if (unrecorded.length === 0) return 0;

        const newEntries: PropertyFinance[] = [];
        try {
            for (let i = 0; i < unrecorded.length; i++) {
                const record = unrecorded[i];
                if (!record) continue;

                const rowId = crypto.randomUUID();
                const taggedNotes = `[MHJ-BOOKING: ${record.bookingId}] ${record.notes}`;
                const createdAt = new Date().toISOString();

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

                newEntries.push({ ...record, id: rowId, notes: taggedNotes, createdAt });
            }
        } finally {
            if (newEntries.length > 0) {
                sheetPropertyFinances.value = [...sheetPropertyFinances.value, ...newEntries];
                await db.propertyFinances.bulkPut(newEntries);
            }
        }

        return newEntries.length;
    }

    return {
        unrecordedBookingRecords,
        unifiedPropertyFinances,
        filteredPropertyFinances,
        getPropertyFinancialMetrics,
        addPropertyTransaction,
        updatePropertyTransaction,
        persistDexieBookingsToRemoteSheet,
    };
}
