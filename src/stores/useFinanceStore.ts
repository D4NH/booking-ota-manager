import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { db } from '@/db';
import { useGoogleSheets } from '@/composables/useGoogleSheets';
import { useBookingStore } from '@/stores/useBookingStore';
import { normalizeDate, getCurrentMonth, getPreviousMonth, parseISODate } from '@/utils/date';
import type { Booking } from '@/types/booking';
import type {
    PropertyFinance,
    PersonalFinance,
    AggregatedSavingsAccount,
    GoldAsset,
    SharedFinance,
    OwnerTransfer,
    Property,
    RecurringTemplate,
    ProjectedRecurringItem,
} from '@/types/finance';

const SPREADSHEET_ID = import.meta.env.VITE_FINANCE_SPREADSHEET_ID as string;

export const useFinanceStore = defineStore('finance', () => {
    const { fetchSheetRows, appendSheetRow, updateSheetRowByBookingId, deleteSheetRowByBookingId } =
        useGoogleSheets();

    const bookingStore = useBookingStore();

    const properties = ref<Property[]>([]);
    const sheetPropertyFinances = ref<PropertyFinance[]>([]);
    const personalFinances = ref<PersonalFinance[]>([]);
    const sharedFinances = ref<SharedFinance[]>([]);
    const transfers = ref<OwnerTransfer[]>([]);
    const goldAssets = ref<GoldAsset[]>([]);
    const currentGoldPricePerGram = ref<number>(2450000);
    const recurringTemplates = ref<RecurringTemplate[]>([]);
    const selectedMonth = ref<string>(getCurrentMonth());
    const isLoading = ref<boolean>(false);
    const error = ref<string | null>(null);

    const capitalize = (str: string) => {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    };

    const isInSelectedMonth = (dateStr: string): boolean => {
        const normalized = normalizeDate(dateStr);
        return normalized.startsWith(selectedMonth.value);
    };

    // Calculate previous month string YYYY-MM based on active selectedMonth
    const previousMonth = computed<string>(() => {
        const d = parseISODate(`${selectedMonth.value}-01`);
        return getPreviousMonth(d);
    });

    const isInPreviousMonth = (dateStr: string): boolean => {
        const normalized = normalizeDate(dateStr);
        return normalized.startsWith(previousMonth.value);
    };

    const loadLocalFinanceData = async (): Promise<void> => {
        try {
            if (!db.propertyFinances) {
                console.warn('Dexie finance tables not initialized yet.');
                return;
            }
            const [pFin, persFin, sFin, trans, gold] = await Promise.all([
                db.propertyFinances.toArray(),
                db.personalFinances.toArray(),
                db.sharedFinances.toArray(),
                db.transfers.toArray(),
                db.goldAssets.toArray(),
            ]);

            if (pFin.length > 0) sheetPropertyFinances.value = pFin;
            if (persFin.length > 0) personalFinances.value = persFin;
            if (sFin.length > 0) sharedFinances.value = sFin;
            if (trans.length > 0) transfers.value = trans;
            if (gold.length > 0) goldAssets.value = gold;
        } catch (err) {
            console.error('Failed to load data from Dexie:', err);
        }
    };

    // Display existing bookings on Property Wallet
    const bookingIncomeRecords = computed<PropertyFinance[]>(() => {
        return bookingStore.bookings
            .filter((b: Booking) => {
                const isEligible =
                    b.status === 'Completed' ||
                    b.status === 'Waiting for payout' ||
                    b.status === 'Checked-in';
                return isEligible && Number(b.payout) > 0;
            })
            .map((b: Booking): PropertyFinance => ({
                id: `dexie-${b.bookingId}`,
                bookingId: b.bookingId,
                propertyId: b.propertyId,
                type: 'income',
                category: 'Payout',
                amount: Number(b.payout),
                date: normalizeDate(b.checkIn),
                notes: `${b.listing} | ${b.guestName}`,
            }));
    });

    const unifiedPropertyFinances = computed<PropertyFinance[]>(() => {
        const existingBookingIds = new Set<string>();

        sheetPropertyFinances.value.forEach((item) => {
            if (item.bookingId) existingBookingIds.add(item.bookingId);
            const match = item.notes?.match(/\[MHJ-BOOKING:\s*([^\]]+)\]/);
            if (match?.[1]) existingBookingIds.add(match[1].trim());
        });

        const activeDexieIncome = bookingIncomeRecords.value.filter(
            (entry) => !existingBookingIds.has(entry.bookingId || '')
        );

        return [...sheetPropertyFinances.value, ...activeDexieIncome];
    });

    const filteredPropertyFinances = computed(() =>
        unifiedPropertyFinances.value.filter((item) => isInSelectedMonth(item.date))
    );

    const filteredPersonalFinances = computed(() =>
        personalFinances.value.filter((item) => isInSelectedMonth(item.date))
    );

    const filteredSharedFinances = computed(() =>
        sharedFinances.value.filter((item) => isInSelectedMonth(item.date))
    );

    const filteredTransfers = computed(() =>
        transfers.value.filter((item) => isInSelectedMonth(item.date))
    );

    // Auto-pull savings entries from Personal Finance
    const dynamicSavingsTransactions = computed<PersonalFinance[]>(() => {
        return personalFinances.value.filter(
            (item) => item.category.trim().toLowerCase() === 'savings'
        );
    });

    // Aggregated balances grouped by owner & institution
    const dynamicSavingsAccounts = computed<AggregatedSavingsAccount[]>(() => {
        const groups = new Map<string, AggregatedSavingsAccount>();

        dynamicSavingsTransactions.value.forEach((tx) => {
            let inst = tx.savingsInstitution?.trim() || '';
            if (!inst) {
                const match = tx.notes?.match(
                    /\[(BCA|Bank Jago|Blu by BCA|Seabank|Mandiri|Bibit)\]/i
                );
                inst = match?.[1] || 'BCA';
            }

            const groupKey = `${tx.owner}-${inst.toLowerCase()}`;
            const existing = groups.get(groupKey);
            const amount = Number(tx.amount) || 0;

            if (existing) {
                existing.balance += amount;
                existing.transactionCount += 1;
                if (tx.date > existing.lastUpdated) {
                    existing.lastUpdated = tx.date;
                }
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
        });

        return Array.from(groups.values()).sort((a, b) => b.balance - a.balance);
    });

    const dynamicTotalSavings = computed<number>(() =>
        dynamicSavingsAccounts.value.reduce((sum, acc) => sum + acc.balance, 0)
    );

    const totalGoldGrams = computed(() =>
        goldAssets.value.reduce((sum, item) => sum + Number(item.weightGrams), 0)
    );

    const totalGoldCostBasis = computed(() =>
        goldAssets.value.reduce((sum, item) => sum + Number(item.buyPriceTotal), 0)
    );

    const estimatedGoldMarketValue = computed(
        () => totalGoldGrams.value * currentGoldPricePerGram.value
    );

    const goldUnrealizedPnL = computed(
        () => estimatedGoldMarketValue.value - totalGoldCostBasis.value
    );

    // Current month property revenue
    const monthlyPropertyRevenue = computed<number>(() =>
        filteredPropertyFinances.value
            .filter(
                (item) =>
                    item.type === 'income' &&
                    item.category !== 'Owner Payout' &&
                    item.category !== 'Mai House Jogja Share'
            )
            .reduce((sum, item) => sum + Number(item.amount), 0)
    );

    // Current month property expenses
    const monthlyPropertyExpenses = computed<number>(() =>
        filteredPropertyFinances.value
            .filter((item) => item.type === 'expense' && item.category !== 'Owner Payout Outflow')
            .reduce((sum, item) => sum + Number(item.amount), 0)
    );

    const monthlyOwnerDraws = computed<number>(() =>
        filteredPropertyFinances.value
            .filter((item) => item.category === 'Owner Payout Outflow')
            .reduce((sum, item) => sum + Number(item.amount), 0)
    );

    const netPropertyProfit = computed<number>(
        () => monthlyPropertyRevenue.value - monthlyPropertyExpenses.value
    );

    const danhNetBalance = computed<number>(() => {
        const list = filteredPersonalFinances.value.filter((i) => i.owner === 'Danh Nguyen');
        const income = list
            .filter((i) => i.type === 'income')
            .reduce((s, i) => s + Number(i.amount), 0);
        const costs = list
            .filter((i) => i.type === 'fixed_cost' || i.type === 'expense')
            .reduce((s, i) => s + Number(i.amount), 0);
        return income - costs;
    });

    const citraNetBalance = computed<number>(() => {
        const list = filteredPersonalFinances.value.filter((i) => i.owner === 'Citra Ayu Wardani');
        const income = list
            .filter((i) => i.type === 'income')
            .reduce((s, i) => s + Number(i.amount), 0);
        const costs = list
            .filter((i) => i.type === 'fixed_cost' || i.type === 'expense')
            .reduce((s, i) => s + Number(i.amount), 0);
        return income - costs;
    });

    const sharedNetBalance = computed<number>(() => {
        const income = filteredSharedFinances.value
            .filter((i) => i.type === 'income')
            .reduce((s, i) => s + Number(i.amount), 0);
        const costs = filteredSharedFinances.value
            .filter((i) => i.type === 'fixed_cost' || i.type === 'expense')
            .reduce((s, i) => s + Number(i.amount), 0);
        return income - costs;
    });

    const totalOwnerDraws = computed<number>(() =>
        filteredTransfers.value.reduce((sum, item) => sum + Number(item.amount), 0)
    );

    async function fetchFinancialData(): Promise<void> {
        isLoading.value = true;
        error.value = null;

        try {
            await bookingStore.loadBookings();
            await loadLocalFinanceData();

            // Range expanded to A2:I to load savingsInstitution (H) and goldWeightGrams (I)
            const [propsRows, propFinRows, personalRows, sharedRows, transferRows, goldRows] =
                await Promise.all([
                    fetchSheetRows(SPREADSHEET_ID, "'Properties'!A2:C").catch(() => []),
                    fetchSheetRows(SPREADSHEET_ID, "'Property_Finances'!A2:G").catch(() => []),
                    fetchSheetRows(SPREADSHEET_ID, "'Personal_Transactions'!A2:I").catch(() => []),
                    fetchSheetRows(SPREADSHEET_ID, "'Shared_Transactions'!A2:F").catch(() => []),
                    fetchSheetRows(SPREADSHEET_ID, "'Transfers'!A2:F").catch(() => []),
                    fetchSheetRows(SPREADSHEET_ID, "'Gold_Assets'!A2:G").catch(() => []),
                ]);

            if (propsRows.length > 0) {
                properties.value = propsRows
                    .filter((r) => r[0] && String(r[0]).trim() !== '')
                    .map((r) => ({
                        id: String(r[0] || ''),
                        name: String(r[1] || ''),
                        address: String(r[2] || ''),
                    }));
            }

            if (propFinRows.length > 0) {
                const parsed: PropertyFinance[] = propFinRows
                    .filter((r) => r[0] && String(r[0]).trim() !== '')
                    .map((r) => ({
                        id: String(r[0] || ''),
                        propertyId: String(r[1] || ''),
                        type: (r[2] as PropertyFinance['type']) || 'expense',
                        category: String(r[3] || ''),
                        amount: Number(r[4]) || 0,
                        date: normalizeDate(r[5]),
                        notes: String(r[6] || ''),
                    }));
                sheetPropertyFinances.value = parsed;
                await db.propertyFinances.clear();
                await db.propertyFinances.bulkPut(parsed);
            }

            if (personalRows.length > 0) {
                const parsed: PersonalFinance[] = personalRows
                    .filter((r) => r[0] && String(r[0]).trim() !== '')
                    .map((r) => ({
                        id: String(r[0] || ''),
                        owner: (r[1] as PersonalFinance['owner']) || 'Danh Nguyen',
                        type: (r[2] as PersonalFinance['type']) || 'expense',
                        category: String(r[3] || ''),
                        amount: Number(r[4]) || 0,
                        date: normalizeDate(r[5]),
                        notes: String(r[6] || ''),
                        savingsInstitution: String(r[7] || ''),
                        goldWeightGrams: Number(r[8]) || undefined,
                    }));
                personalFinances.value = parsed;
                await db.personalFinances.clear();
                await db.personalFinances.bulkPut(parsed);
            }

            if (sharedRows.length > 0) {
                const parsed: SharedFinance[] = sharedRows
                    .filter((r) => r[0] && String(r[0]).trim() !== '')
                    .map((r) => ({
                        id: String(r[0] || ''),
                        type: (r[1] as SharedFinance['type']) || 'expense',
                        category: String(r[2] || ''),
                        amount: Number(r[3]) || 0,
                        date: normalizeDate(r[4]),
                        notes: String(r[5] || ''),
                    }));
                sharedFinances.value = parsed;
                await db.sharedFinances.clear();
                await db.sharedFinances.bulkPut(parsed);
            }

            if (transferRows.length > 0) {
                const parsed: OwnerTransfer[] = transferRows
                    .filter((r) => r[0] && String(r[0]).trim() !== '')
                    .map((r) => ({
                        id: String(r[0] || ''),
                        sourcePropertyId: String(r[1] || ''),
                        targetAccount: (r[2] as OwnerTransfer['targetAccount']) || 'Shared',
                        amount: Number(r[3]) || 0,
                        date: normalizeDate(r[4]),
                        notes: String(r[5] || ''),
                    }));
                transfers.value = parsed;
                await db.transfers.clear();
                await db.transfers.bulkPut(parsed);
            }

            if (goldRows.length > 0) {
                const parsedGold: GoldAsset[] = goldRows
                    .filter((r) => r[0] && String(r[0]).trim() !== '')
                    .map((r) => ({
                        id: String(r[0]),
                        owner: (r[1] as GoldAsset['owner']) || 'Danh Nguyen',
                        type: (r[2] as GoldAsset['type']) || 'Antam',
                        weightGrams: Number(r[3]) || 0,
                        buyPriceTotal: Number(r[4]) || 0,
                        purchaseDate: normalizeDate(r[5]),
                        certificateNumber: String(r[6] || ''),
                    }));
                goldAssets.value = parsedGold;
                await db.goldAssets.clear();
                await db.goldAssets.bulkPut(parsedGold);
            }
        } catch (err: unknown) {
            error.value = err instanceof Error ? err.message : 'Sheet sync failed';
            throw err;
        } finally {
            isLoading.value = false;
        }
    }

    async function addPersonalTransaction(payload: Omit<PersonalFinance, 'id'>): Promise<void> {
        const id = crypto.randomUUID();
        const cleanDate = normalizeDate(payload.date);
        const item: PersonalFinance = { ...payload, id, date: cleanDate };

        // 1. Write row with Cols H (savingsInstitution) & I (goldWeightGrams)
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
        personalFinances.value.push(item);
        await db.personalFinances.put(item);

        // 2. Synchronize Gold Holding when category is Gold
        if (payload.category === 'Gold') {
            const grams =
                payload.goldWeightGrams && payload.goldWeightGrams > 0
                    ? payload.goldWeightGrams
                    : Number((Number(payload.amount) / currentGoldPricePerGram.value).toFixed(2));

            const goldId = crypto.randomUUID();
            const newGoldRecord: GoldAsset = {
                id: goldId,
                owner: payload.owner,
                type: 'Antam',
                weightGrams: grams,
                buyPriceTotal: Number(payload.amount),
                purchaseDate: cleanDate,
                notes: payload.notes,
            };

            await appendSheetRow(
                SPREADSHEET_ID,
                [
                    goldId,
                    newGoldRecord.owner,
                    newGoldRecord.type,
                    newGoldRecord.weightGrams,
                    newGoldRecord.buyPriceTotal,
                    cleanDate,
                    newGoldRecord.certificateNumber || '',
                ],
                "'Gold_Assets'!A1"
            );
            goldAssets.value.push(newGoldRecord);
            await db.goldAssets.put(newGoldRecord);
        }
    }

    async function addPropertyTransaction(payload: Omit<PropertyFinance, 'id'>): Promise<void> {
        const id = crypto.randomUUID();
        const cleanDate = normalizeDate(payload.date);
        const item: PropertyFinance = { ...payload, id, date: cleanDate };

        await appendSheetRow(
            SPREADSHEET_ID,
            [id, item.propertyId, item.type, item.category, item.amount, cleanDate, item.notes],
            "'Property_Finances'!A1"
        );
        sheetPropertyFinances.value.push(item);
        await db.propertyFinances.put(item);
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
        sharedFinances.value.push(item);
        await db.sharedFinances.put(item);
    }

    async function recordOwnerTransfer(payload: Omit<OwnerTransfer, 'id'>): Promise<void> {
        const transferId = crypto.randomUUID();
        const outflowId = crypto.randomUUID();
        const entryId = crypto.randomUUID();
        const cleanDate = normalizeDate(payload.date);

        await appendSheetRow(
            SPREADSHEET_ID,
            [
                transferId,
                payload.sourcePropertyId,
                payload.targetAccount,
                payload.amount,
                cleanDate,
                payload.notes,
            ],
            "'Transfers'!A1"
        );

        await appendSheetRow(
            SPREADSHEET_ID,
            [
                outflowId,
                payload.sourcePropertyId,
                'expense',
                'Owner Payout Outflow',
                payload.amount,
                cleanDate,
                [`Payout to ${payload.targetAccount}`, payload.notes].filter(Boolean).join(' | '),
            ],
            "'Property_Finances'!A1"
        );

        if (payload.targetAccount === 'Shared') {
            await appendSheetRow(
                SPREADSHEET_ID,
                [
                    entryId,
                    'income',
                    'Mai House Jogja Share',
                    payload.amount,
                    cleanDate,
                    `Payout from ${capitalize(payload.sourcePropertyId)}`,
                ],
                "'Shared_Transactions'!A1"
            );
        } else {
            await appendSheetRow(
                SPREADSHEET_ID,
                [
                    entryId,
                    payload.targetAccount,
                    'income',
                    'Owner Payout',
                    payload.amount,
                    cleanDate,
                    `Payout from ${capitalize(payload.sourcePropertyId)}`,
                    '',
                    '',
                ],
                "'Personal_Transactions'!A1"
            );
        }

        await fetchFinancialData();
    }

    async function persistDexieBookingsToRemoteSheet(): Promise<number> {
        const existingBookingIds = new Set<string>();
        sheetPropertyFinances.value.forEach((item) => {
            if (item.bookingId) existingBookingIds.add(item.bookingId);
            const match = item.notes?.match(/\[MHJ-BOOKING:\s*([^\]]+)\]/);
            if (match?.[1]) existingBookingIds.add(match[1].trim());
        });

        const unrecordedBookings = bookingIncomeRecords.value.filter(
            (entry) => !existingBookingIds.has(entry.bookingId || '')
        );

        for (const record of unrecordedBookings) {
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

            const persisted: PropertyFinance = { ...record, id: rowId, notes: taggedNotes };
            sheetPropertyFinances.value.push(persisted);
            await db.propertyFinances.put(persisted);
        }

        return unrecordedBookings.length;
    }

    async function addGoldPurchase(payload: Omit<GoldAsset, 'id'>): Promise<void> {
        const id = crypto.randomUUID();
        const record: GoldAsset = { ...payload, id };
        await appendSheetRow(
            SPREADSHEET_ID,
            [
                id,
                record.owner,
                record.type,
                record.weightGrams,
                record.buyPriceTotal,
                record.purchaseDate,
                record.certificateNumber || '',
            ],
            "'Gold_Assets'!A1"
        );
        goldAssets.value.push(record);
        await db.goldAssets.put(record).catch(() => {});
    }

    async function updatePersonalTransaction(
        id: string,
        payload: Omit<PersonalFinance, 'id'>
    ): Promise<void> {
        const cleanDate = normalizeDate(payload.date);
        const updatedRecord: PersonalFinance = { ...payload, id, date: cleanDate };

        // Remote sync using updateSheetRowByBookingId with target sheet name
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

        // Update local reactive state
        const index = personalFinances.value.findIndex((i) => i.id === id);
        if (index !== -1) {
            personalFinances.value[index] = updatedRecord;
        }

        // Update Dexie database
        await db.personalFinances.put(updatedRecord);
    }

    async function updateSharedTransaction(
        id: string,
        payload: Omit<SharedFinance, 'id'>
    ): Promise<void> {
        const cleanDate = normalizeDate(payload.date);
        const updatedRecord: SharedFinance = { ...payload, id, date: cleanDate };

        // Remote sync using updateSheetRowByBookingId with target sheet name
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

        // Update local reactive state
        const index = sharedFinances.value.findIndex((i) => i.id === id);
        if (index !== -1) {
            sharedFinances.value[index] = updatedRecord;
        }

        // Update Dexie database
        await db.sharedFinances.put(updatedRecord);
    }

    // 1. Fetching logic: read Column K (index 10)
    async function fetchRecurringTemplates(): Promise<void> {
        try {
            const localTemplates = await db.recurringTemplates.toArray().catch(() => []);
            if (localTemplates.length > 0) {
                recurringTemplates.value = localTemplates;
            }

            const rows = await fetchSheetRows(SPREADSHEET_ID, "'Recurring_Templates'!A2:K").catch(
                () => []
            );
            if (rows.length > 0) {
                const parsed: RecurringTemplate[] = rows
                    .filter((r) => r[0] && String(r[0]).trim() !== '')
                    .map((r) => ({
                        id: String(r[0]),
                        targetLedger: (r[1] as RecurringTemplate['targetLedger']) || 'Shared',
                        owner: (r[2] as PersonalFinance['owner']) || undefined,
                        propertyId: String(r[3] || '') || undefined,
                        type: (r[4] as RecurringTemplate['type']) || 'fixed_cost',
                        category: String(r[5] || ''),
                        amount: Number(r[6]) || 0,
                        dueDayOfMonth: Number(r[7]) || 1,
                        frequency: (r[8] as RecurringTemplate['frequency']) || 'monthly',
                        active: String(r[9]).toUpperCase() === 'TRUE',
                        notes: String(r[10] || '').trim(), // Column K
                    }));

                recurringTemplates.value = parsed;
                await db.recurringTemplates.clear().catch(() => {});
                await db.recurringTemplates.bulkPut(parsed).catch(() => {});
            }
        } catch (err) {
            console.error('Failed fetching recurring templates:', err);
        }
    }

    // 2. Computed projection: match against specific notes for subscriptions/shared categories
    const monthlyProjectedRecurring = computed<ProjectedRecurringItem[]>(() => {
        const cycle = selectedMonth.value;
        const activeTemplates = recurringTemplates.value.filter((t) => t.active);

        return activeTemplates.map((template) => {
            const dayStr = String(Math.min(Math.max(template.dueDayOfMonth, 1), 28)).padStart(
                2,
                '0'
            );
            const dueDate = `${cycle}-${dayStr}`;

            let isSettled = false;
            let matchedId: string | undefined;

            const templateNoteClean = (template.notes || '').toLowerCase().trim();

            const matchesItem = (entry: { category: string; amount: number; notes?: string }) => {
                const sameCategory =
                    entry.category.toLowerCase().trim() === template.category.toLowerCase().trim();
                const sameAmount = Math.abs(Number(entry.amount) - template.amount) < 100;

                if (!sameCategory || !sameAmount) return false;

                // If template has specific note (e.g. "Netflix"), require note keyword match
                if (templateNoteClean) {
                    const entryNote = (entry.notes || '').toLowerCase();
                    return entryNote.includes(templateNoteClean);
                }

                return true;
            };

            if (template.targetLedger === 'Property') {
                const match = filteredPropertyFinances.value.find(matchesItem);
                if (match) {
                    isSettled = true;
                    matchedId = match.id;
                }
            } else if (template.targetLedger === 'Shared') {
                const match = filteredSharedFinances.value.find(matchesItem);
                if (match) {
                    isSettled = true;
                    matchedId = match.id;
                }
            } else if (template.targetLedger === 'Personal' && template.owner) {
                const match = filteredPersonalFinances.value.find(
                    (p) => p.owner === template.owner && matchesItem(p)
                );
                if (match) {
                    isSettled = true;
                    matchedId = match.id;
                }
            }

            return {
                ...template,
                cycleMonth: cycle,
                dueDate,
                isSettled,
                matchedTransactionId: matchedId,
            };
        });
    });

    // 1. Separate Inflow vs Outflow Projections
    const monthlyProjectedIncome = computed<ProjectedRecurringItem[]>(() =>
        monthlyProjectedRecurring.value.filter((i) => i.type === 'income')
    );

    const monthlyProjectedExpenses = computed<ProjectedRecurringItem[]>(() =>
        monthlyProjectedRecurring.value.filter(
            (i) => i.type === 'fixed_cost' || i.type === 'expense'
        )
    );

    const pendingRecurringIncome = computed<number>(() =>
        monthlyProjectedIncome.value
            .filter((i) => !i.isSettled)
            .reduce((sum, i) => sum + Number(i.amount), 0)
    );

    const pendingRecurringExpenses = computed<number>(() =>
        monthlyProjectedExpenses.value
            .filter((i) => !i.isSettled)
            .reduce((sum, i) => sum + Number(i.amount), 0)
    );

    // Net projection: expected inflow minus expected outflow
    const netProjectedRecurringSpread = computed<number>(
        () => pendingRecurringIncome.value - pendingRecurringExpenses.value
    );

    // Previous month property revenue
    const previousMonthPropertyRevenue = computed<number>(() =>
        unifiedPropertyFinances.value
            .filter(
                (item) =>
                    isInPreviousMonth(item.date) &&
                    item.type === 'income' &&
                    item.category !== 'Owner Payout' &&
                    item.category !== 'Mai House Jogja Share'
            )
            .reduce((sum, item) => sum + Number(item.amount), 0)
    );

    // Previous month property expenses
    const previousMonthPropertyExpenses = computed<number>(() =>
        unifiedPropertyFinances.value
            .filter(
                (item) =>
                    isInPreviousMonth(item.date) &&
                    item.type === 'expense' &&
                    item.category !== 'Owner Payout Outflow'
            )
            .reduce((sum, item) => sum + Number(item.amount), 0)
    );

    // Growth percentage vs last month
    const propertyRevenueGrowthPct = computed<number>(() => {
        const prev = previousMonthPropertyRevenue.value;
        const curr = monthlyPropertyRevenue.value;
        if (prev === 0) return curr > 0 ? 100 : 0;
        return Number((((curr - prev) / prev) * 100).toFixed(1));
    });

    const propertyExpenseGrowthPct = computed<number>(() => {
        const prev = previousMonthPropertyExpenses.value;
        const curr = monthlyPropertyExpenses.value;
        if (prev === 0) return curr > 0 ? 100 : 0;
        return Number((((curr - prev) / prev) * 100).toFixed(1));
    });

    // 2. Updated Settle Action (respects item.type)
    async function settleRecurringItem(item: ProjectedRecurringItem): Promise<void> {
        if (item.isSettled) return;

        const itemNote = item.notes?.trim() || '';
        const formattedNotes = itemNote
            ? `[RECURRING] ${itemNote}`
            : `[RECURRING] ${item.category}`;

        if (item.targetLedger === 'Property') {
            await addPropertyTransaction({
                propertyId: item.propertyId || 'piyungan',
                type: item.type === 'income' ? 'income' : 'expense',
                category: item.category,
                amount: item.amount,
                date: item.dueDate,
                notes: formattedNotes,
            });
        } else if (item.targetLedger === 'Shared') {
            await addSharedTransaction({
                type: item.type,
                category: item.category,
                amount: item.amount,
                date: item.dueDate,
                notes: formattedNotes,
            });
        } else if (item.targetLedger === 'Personal' && item.owner) {
            await addPersonalTransaction({
                owner: item.owner,
                type: item.type,
                category: item.category,
                amount: item.amount,
                date: item.dueDate,
                notes: formattedNotes,
            });
        }
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

        const index = sheetPropertyFinances.value.findIndex((i) => i.id === id);
        if (index !== -1) {
            sheetPropertyFinances.value[index] = updatedRecord;
        }

        await db.propertyFinances.put(updatedRecord);
    }

    async function deletePropertyTransaction(id: string): Promise<void> {
        // Prevent accidental deletion of virtual Dexie bookings from this handler
        if (id.startsWith('dexie-')) {
            throw new Error(
                'This transaction is auto-populated from Dexie bookings. Delete or cancel the booking instead.'
            );
        }

        await deleteSheetRowByBookingId(SPREADSHEET_ID, id, 'Property_Finances');

        sheetPropertyFinances.value = sheetPropertyFinances.value.filter((i) => i.id !== id);
        await db.propertyFinances.delete(id);
    }

    async function deletePersonalTransaction(id: string): Promise<void> {
        await deleteSheetRowByBookingId(SPREADSHEET_ID, id, 'Personal_Transactions');

        personalFinances.value = personalFinances.value.filter((i) => i.id !== id);
        await db.personalFinances.delete(id);
    }

    async function deleteSharedTransaction(id: string): Promise<void> {
        await deleteSheetRowByBookingId(SPREADSHEET_ID, id, 'Shared_Transactions');

        sharedFinances.value = sharedFinances.value.filter((i) => i.id !== id);
        await db.sharedFinances.delete(id);
    }

    return {
        properties,
        sheetPropertyFinances,
        personalFinances,
        sharedFinances,
        transfers,
        selectedMonth,
        isLoading,
        error,
        unifiedPropertyFinances,
        filteredPropertyFinances,
        filteredPersonalFinances,
        filteredSharedFinances,
        filteredTransfers,
        monthlyPropertyRevenue,
        monthlyPropertyExpenses,
        monthlyOwnerDraws,
        netPropertyProfit,
        danhNetBalance,
        citraNetBalance,
        sharedNetBalance,
        totalOwnerDraws,
        loadLocalFinanceData,
        fetchFinancialData,
        addPropertyTransaction,
        addPersonalTransaction,
        addSharedTransaction,
        recordOwnerTransfer,
        persistDexieBookingsToRemoteSheet,
        goldAssets,
        currentGoldPricePerGram,
        totalGoldGrams,
        totalGoldCostBasis,
        estimatedGoldMarketValue,
        goldUnrealizedPnL,
        addGoldPurchase,
        dynamicSavingsTransactions,
        dynamicSavingsAccounts,
        dynamicTotalSavings,
        updatePersonalTransaction,
        updateSharedTransaction,
        recurringTemplates,
        monthlyProjectedRecurring,
        fetchRecurringTemplates,
        monthlyProjectedIncome,
        monthlyProjectedExpenses,
        pendingRecurringIncome,
        pendingRecurringExpenses,
        netProjectedRecurringSpread,
        settleRecurringItem,
        previousMonth,
        previousMonthPropertyRevenue,
        previousMonthPropertyExpenses,
        propertyRevenueGrowthPct,
        propertyExpenseGrowthPct,
        updatePropertyTransaction,
        deletePropertyTransaction,
        deletePersonalTransaction,
        deleteSharedTransaction,
    };
});
