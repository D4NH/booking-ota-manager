import { defineStore } from 'pinia';
import { ref, shallowRef, computed } from 'vue';
import { db } from '@/db';
import { useGoogleSheets } from '@/composables/useGoogleSheets';
import { useBookingStore } from '@/stores/useBookingStore';
import { normalizeDate, getCurrentMonth } from '@/utils/date';
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
    SbnInvestment,
    InvestmentPortfolioSummary,
} from '@/types/finance';

const SPREADSHEET_ID = import.meta.env.VITE_FINANCE_SPREADSHEET_ID as string;
const REGEX_MHJ_BOOKING = /\[MHJ-BOOKING:\s*([^\]]+)\]/;
const REGEX_SAVINGS_TAG = /\[(BCA|Bank Jago|Blu by BCA|Seabank|Mandiri|Bibit)\]/i;

export const useFinanceStore = defineStore('finance', () => {
    const {
        fetchSheetRows,
        appendSheetRow,
        updateSheetRowByBookingId,
        deleteSheetRowByBookingId,
        batchFetchSheetRows,
    } = useGoogleSheets();

    const bookingStore = useBookingStore();

    const properties = shallowRef<Property[]>([]);
    const sheetPropertyFinances = shallowRef<PropertyFinance[]>([]);
    const personalFinances = shallowRef<PersonalFinance[]>([]);
    const sharedFinances = shallowRef<SharedFinance[]>([]);
    const transfers = shallowRef<OwnerTransfer[]>([]);
    const goldAssets = shallowRef<GoldAsset[]>([]);
    const recurringTemplates = shallowRef<RecurringTemplate[]>([]);

    const currentGoldPricePerGram = ref<number>(2450000);
    const selectedMonth = ref<string>(getCurrentMonth());
    const isLoading = ref<boolean>(false);
    const error = ref<string | null>(null);

    const capitalize = (str: string): string =>
        str ? str.charAt(0).toUpperCase() + str.slice(1) : '';

    const previousMonth = computed<string>(() => {
        const parts = selectedMonth.value.split('-');
        let year = Number(parts[0]);
        let month = Number(parts[1]) - 1;
        if (month === 0) {
            month = 12;
            year -= 1;
        }
        return `${year}-${String(month).padStart(2, '0')}`;
    });
    const isInSelectedMonth = (dateStr: string): boolean =>
        Boolean(dateStr && normalizeDate(dateStr).startsWith(selectedMonth.value));
    const isInPreviousMonth = (dateStr: string): boolean =>
        Boolean(dateStr && normalizeDate(dateStr).startsWith(previousMonth.value));

    const loadLocalFinanceData = async (): Promise<void> => {
        try {
            if (!db.propertyFinances) return;
            const [pFin, persFin, sFin, trans, gold, rec] = await Promise.all([
                db.propertyFinances.toArray(),
                db.personalFinances.toArray(),
                db.sharedFinances.toArray(),
                db.transfers.toArray(),
                db.goldAssets.toArray(),
                db.recurringTemplates.toArray(),
            ]);

            if (pFin.length) sheetPropertyFinances.value = pFin;
            if (persFin.length) personalFinances.value = persFin;
            if (sFin.length) sharedFinances.value = sFin;
            if (trans.length) transfers.value = trans;
            if (gold.length) goldAssets.value = gold;
            if (rec.length) recurringTemplates.value = rec;
        } catch (err) {
            console.error('Failed to load local finance storage:', err);
        }
    };

    const bookingIncomeRecords = computed<PropertyFinance[]>(() => {
        const eligibleStatuses = new Set(['Completed', 'Waiting for payout', 'Checked-in']);
        return bookingStore.bookings
            .filter((b: Booking) => eligibleStatuses.has(b.status) && Number(b.payout) > 0)
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

    const sortNewestFirst = <T extends { date: string; amount: number; id: string }>(
        a: T,
        b: T
    ): number => {
        const dateComp = b.date.localeCompare(a.date);
        if (dateComp !== 0) return dateComp;
        const amountDiff = Number(b.amount) - Number(a.amount);
        if (amountDiff !== 0) return amountDiff;
        return b.id.localeCompare(a.id);
    };

    // 5. Filtered Month Arrays (Pre-sorted Newest-First)
    const filteredPropertyFinances = computed(() =>
        unifiedPropertyFinances.value
            .filter((item) => isInSelectedMonth(item.date))
            .sort(sortNewestFirst)
    );
    const filteredPersonalFinances = computed(() =>
        personalFinances.value.filter((item) => isInSelectedMonth(item.date)).sort(sortNewestFirst)
    );
    const filteredSharedFinances = computed(() =>
        sharedFinances.value.filter((item) => isInSelectedMonth(item.date)).sort(sortNewestFirst)
    );
    const filteredTransfers = computed(() =>
        transfers.value.filter((item) => isInSelectedMonth(item.date)).sort(sortNewestFirst)
    );

    // Savings & Gold Aggregations
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

    // Financial Totals & Balances
    const monthlyPropertyRevenue = computed<number>(() => {
        let sum = 0;
        const list = filteredPropertyFinances.value;
        for (let i = 0; i < list.length; i++) {
            const item = list[i];
            if (!item) continue;
            if (
                item.type === 'income' &&
                item.category !== 'Owner Payout' &&
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

    const calculateNetForOwner = (ownerName: PersonalFinance['owner']): number => {
        let net = 0;
        const list = filteredPersonalFinances.value;
        for (let i = 0; i < list.length; i++) {
            const item = list[i];
            if (!item || item.owner !== ownerName) continue;
            const amt = Number(item.amount);
            net += item.type === 'income' ? amt : -amt;
        }
        return net;
    };

    const danhNetBalance = computed<number>(() => calculateNetForOwner('Danh Nguyen'));
    const citraNetBalance = computed<number>(() => calculateNetForOwner('Citra Ayu Wardani'));
    const sharedNetBalance = computed<number>(() => {
        let net = 0;
        const list = filteredSharedFinances.value;
        for (let i = 0; i < list.length; i++) {
            const item = list[i];
            if (!item) continue;
            const amt = Number(item.amount);
            net += item.type === 'income' ? amt : -amt;
        }
        return net;
    });
    const totalOwnerDraws = computed<number>(() =>
        filteredTransfers.value.reduce((sum, item) => sum + Number(item.amount), 0)
    );

    const monthlyProjectedRecurring = computed<ProjectedRecurringItem[]>(() => {
        const cycle = selectedMonth.value;
        const templates = recurringTemplates.value.filter((t) => t.active);
        if (!templates.length) return [];

        // Build lookup sets for constant-time existence checks
        const propSet = new Set(
            filteredPropertyFinances.value.map(
                (p) => `${p.category.toLowerCase().trim()}_${Math.round(p.amount)}`
            )
        );
        const sharedSet = new Set(
            filteredSharedFinances.value.map(
                (s) => `${s.category.toLowerCase().trim()}_${Math.round(s.amount)}`
            )
        );
        const personalSet = new Set(
            filteredPersonalFinances.value.map(
                (p) => `${p.owner}_${p.category.toLowerCase().trim()}_${Math.round(p.amount)}`
            )
        );

        return templates.map((template) => {
            const dayStr = String(Math.min(Math.max(template.dueDayOfMonth, 1), 28)).padStart(
                2,
                '0'
            );
            const dueDate = `${cycle}-${dayStr}`;
            const keyBase = `${template.category.toLowerCase().trim()}_${Math.round(template.amount)}`;

            let isSettled = false;
            if (template.targetLedger === 'Property') {
                isSettled = propSet.has(keyBase);
            } else if (template.targetLedger === 'Shared') {
                isSettled = sharedSet.has(keyBase);
            } else if (template.targetLedger === 'Personal' && template.owner) {
                isSettled = personalSet.has(`${template.owner}_${keyBase}`);
            }

            return {
                ...template,
                cycleMonth: cycle,
                dueDate,
                isSettled,
            };
        });
    });
    const recurringMetrics = computed(() => {
        let pendingIncome = 0;
        let pendingExpense = 0;
        const incomeList: ProjectedRecurringItem[] = [];
        const expenseList: ProjectedRecurringItem[] = [];

        const projected = monthlyProjectedRecurring.value;
        for (let i = 0; i < projected.length; i++) {
            const item = projected[i];
            if (!item) continue;
            if (item.type === 'income') {
                incomeList.push(item);
                if (!item.isSettled) pendingIncome += item.amount;
            } else {
                expenseList.push(item);
                if (!item.isSettled) pendingExpense += item.amount;
            }
        }

        return {
            incomeList,
            expenseList,
            pendingIncome,
            pendingExpense,
            spread: pendingIncome - pendingExpense,
        };
    });

    const monthlyProjectedIncome = computed(() => recurringMetrics.value.incomeList);
    const monthlyProjectedExpenses = computed(() => recurringMetrics.value.expenseList);
    const pendingRecurringIncome = computed(() => recurringMetrics.value.pendingIncome);
    const pendingRecurringExpenses = computed(() => recurringMetrics.value.pendingExpense);
    const netProjectedRecurringSpread = computed(() => recurringMetrics.value.spread);

    // Previous Month Historical Comparisons
    const previousMonthPropertyRevenue = computed<number>(() => {
        let sum = 0;
        const list = unifiedPropertyFinances.value;
        for (let i = 0; i < list.length; i++) {
            const item = list[i];
            if (!item) continue;
            if (
                isInPreviousMonth(item.date) &&
                item.type === 'income' &&
                item.category !== 'Owner Payout' &&
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
                isInPreviousMonth(item.date) &&
                item.type === 'expense' &&
                item.category !== 'Owner Payout Outflow'
            ) {
                sum += Number(item.amount);
            }
        }
        return sum;
    });
    const propertyRevenueGrowthPct = computed<number | null>(() => {
        const prev = previousMonthPropertyRevenue.value;
        const curr = monthlyPropertyRevenue.value;
        if (prev === 0) return null;
        return Number((((curr - prev) / prev) * 100).toFixed(1));
    });
    const propertyExpenseGrowthPct = computed<number | null>(() => {
        const prev = previousMonthPropertyExpenses.value;
        const curr = monthlyPropertyExpenses.value;
        if (prev === 0) return null;
        return Number((((curr - prev) / prev) * 100).toFixed(1));
    });

    async function fetchFinancialData(): Promise<void> {
        isLoading.value = true;
        error.value = null;

        try {
            await Promise.all([bookingStore.loadBookings(), loadLocalFinanceData()]);

            const financeRanges = [
                "'Properties'!A2:C",
                "'Property_Finances'!A2:G",
                "'Personal_Transactions'!A2:I",
                "'Shared_Transactions'!A2:F",
                "'Transfers'!A2:F",
                "'Gold_Assets'!A2:G",
                "'Recurring_Templates'!A2:K",
            ];

            const batchResults = await batchFetchSheetRows(SPREADSHEET_ID, financeRanges);

            const propsRows = batchResults[0] || [];
            const propFinRows = batchResults[1] || [];
            const personalRows = batchResults[2] || [];
            const sharedRows = batchResults[3] || [];
            const transferRows = batchResults[4] || [];
            const goldRows = batchResults[5] || [];
            const recurringRows = batchResults[6] || [];

            if (propsRows.length) {
                properties.value = propsRows
                    .filter((r) => r[0] && String(r[0]).trim())
                    .map((r) => ({
                        id: String(r[0]),
                        name: String(r[1] || ''),
                        address: String(r[2] || ''),
                    }));
            }

            const parsedPropFinances: PropertyFinance[] = propFinRows
                .filter((r) => r[0] && String(r[0]).trim())
                .map((r) => ({
                    id: String(r[0]),
                    propertyId: String(r[1] || ''),
                    type: (r[2] as PropertyFinance['type']) || 'expense',
                    category: String(r[3] || ''),
                    amount: Number(r[4]) || 0,
                    date: normalizeDate(r[5]),
                    notes: String(r[6] || ''),
                }));

            const parsedPersonal: PersonalFinance[] = personalRows
                .filter((r) => r[0] && String(r[0]).trim())
                .map((r) => ({
                    id: String(r[0]),
                    owner: (r[1] as PersonalFinance['owner']) || 'Danh Nguyen',
                    type: (r[2] as PersonalFinance['type']) || 'expense',
                    category: String(r[3] || ''),
                    amount: Number(r[4]) || 0,
                    date: normalizeDate(r[5]),
                    notes: String(r[6] || ''),
                    savingsInstitution: String(r[7] || ''),
                    goldWeightGrams: Number(r[8]) || undefined,
                }));

            const parsedShared: SharedFinance[] = sharedRows
                .filter((r) => r[0] && String(r[0]).trim())
                .map((r) => ({
                    id: String(r[0]),
                    type: (r[1] as SharedFinance['type']) || 'expense',
                    category: String(r[2] || ''),
                    amount: Number(r[3]) || 0,
                    date: normalizeDate(r[4]),
                    notes: String(r[5] || ''),
                }));

            const parsedTransfers: OwnerTransfer[] = transferRows
                .filter((r) => r[0] && String(r[0]).trim())
                .map((r) => ({
                    id: String(r[0]),
                    sourcePropertyId: String(r[1] || ''),
                    targetAccount: (r[2] as OwnerTransfer['targetAccount']) || 'Shared',
                    amount: Number(r[3]) || 0,
                    date: normalizeDate(r[4]),
                    notes: String(r[5] || ''),
                }));

            const parsedGold: GoldAsset[] = goldRows
                .filter((r) => r[0] && String(r[0]).trim())
                .map((r) => ({
                    id: String(r[0]),
                    owner: (r[1] as GoldAsset['owner']) || 'Danh Nguyen',
                    type: (r[2] as GoldAsset['type']) || 'Antam',
                    weightGrams: Number(r[3]) || 0,
                    buyPriceTotal: Number(r[4]) || 0,
                    purchaseDate: normalizeDate(r[5]),
                    certificateNumber: String(r[6] || ''),
                }));

            const parsedRecurring: RecurringTemplate[] = recurringRows
                .filter((r) => r[0] && String(r[0]).trim())
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
                    notes: String(r[10] || '').trim(),
                }));

            sheetPropertyFinances.value = parsedPropFinances;
            personalFinances.value = parsedPersonal;
            sharedFinances.value = parsedShared;
            transfers.value = parsedTransfers;
            goldAssets.value = parsedGold;
            recurringTemplates.value = parsedRecurring;

            db.transaction(
                'rw',
                [
                    db.propertyFinances,
                    db.personalFinances,
                    db.sharedFinances,
                    db.transfers,
                    db.goldAssets,
                    db.recurringTemplates,
                ],
                async () => {
                    await Promise.all([
                        db.propertyFinances
                            .clear()
                            .then(() => db.propertyFinances.bulkPut(parsedPropFinances)),
                        db.personalFinances
                            .clear()
                            .then(() => db.personalFinances.bulkPut(parsedPersonal)),
                        db.sharedFinances
                            .clear()
                            .then(() => db.sharedFinances.bulkPut(parsedShared)),
                        db.transfers.clear().then(() => db.transfers.bulkPut(parsedTransfers)),
                        db.goldAssets.clear().then(() => db.goldAssets.bulkPut(parsedGold)),
                        db.recurringTemplates
                            .clear()
                            .then(() => db.recurringTemplates.bulkPut(parsedRecurring)),
                    ]);
                }
            ).catch((err) => console.warn('Dexie background sync warning:', err));
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

        if (payload.category === 'Gold') {
            const grams =
                payload.goldWeightGrams && payload.goldWeightGrams > 0
                    ? payload.goldWeightGrams
                    : Number((Number(payload.amount) / currentGoldPricePerGram.value).toFixed(2));

            const goldRecord: GoldAsset = {
                id: crypto.randomUUID(),
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
                    goldRecord.id,
                    goldRecord.owner,
                    goldRecord.type,
                    goldRecord.weightGrams,
                    goldRecord.buyPriceTotal,
                    cleanDate,
                    goldRecord.certificateNumber || '',
                ],
                "'Gold_Assets'!A1"
            );
            goldAssets.value = [...goldAssets.value, goldRecord];
            await db.goldAssets.put(goldRecord);
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
        sheetPropertyFinances.value = [...sheetPropertyFinances.value, item];
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
        sharedFinances.value = [...sharedFinances.value, item];
        await db.sharedFinances.put(item);
    }
    async function recordOwnerTransfer(payload: Omit<OwnerTransfer, 'id'>): Promise<void> {
        const cleanDate = normalizeDate(payload.date);
        const sourceProperty = capitalize(payload.sourcePropertyId);
        const amount = Number(payload.amount);

        // CASE 1: BOTH RECIPIENTS (2 SEPARATE RECORDS FOR PROPERTY, TRANSFERS, AND PERSONAL)
        if (payload.targetAccount === 'Split') {
            const owners: PersonalFinance['owner'][] = ['Danh Nguyen', 'Citra Ayu Wardani'];

            for (const owner of owners) {
                const outflowId = crypto.randomUUID();
                const transferId = crypto.randomUUID();
                const entryId = crypto.randomUUID();

                const noteText = [`Payout to ${owner}`, payload.notes].filter(Boolean).join(' | ');

                // 1. Separate Property Outflow row per owner
                await appendSheetRow(
                    SPREADSHEET_ID,
                    [
                        outflowId,
                        payload.sourcePropertyId,
                        'expense',
                        'Owner Payout Outflow',
                        amount,
                        cleanDate,
                        noteText,
                    ],
                    "'Property_Finances'!A1"
                );

                // 2. Separate Transfer Audit row per owner
                await appendSheetRow(
                    SPREADSHEET_ID,
                    [transferId, payload.sourcePropertyId, owner, amount, cleanDate, noteText],
                    "'Transfers'!A1"
                );

                // 3. Separate Personal Income row per owner
                await appendSheetRow(
                    SPREADSHEET_ID,
                    [
                        entryId,
                        owner,
                        'income',
                        'Owner Payout',
                        amount,
                        cleanDate,
                        `Payout from ${sourceProperty}`,
                        '',
                        '',
                    ],
                    "'Personal_Transactions'!A1"
                );
            }

            await fetchFinancialData();
            return;
        }

        // CASE 2: SINGLE RECIPIENT
        const transferId = crypto.randomUUID();
        const outflowId = crypto.randomUUID();
        const entryId = crypto.randomUUID();
        const noteText = [`Payout to ${payload.targetAccount}`, payload.notes]
            .filter(Boolean)
            .join(' | ');

        await appendSheetRow(
            SPREADSHEET_ID,
            [
                transferId,
                payload.sourcePropertyId,
                payload.targetAccount,
                amount,
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
                amount,
                cleanDate,
                noteText,
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
                    amount,
                    cleanDate,
                    `Payout from ${sourceProperty}`,
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
                    amount,
                    cleanDate,
                    `Payout from ${sourceProperty}`,
                    '',
                    '',
                ],
                "'Personal_Transactions'!A1"
            );
        }

        await fetchFinancialData();
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
        goldAssets.value = [...goldAssets.value, record];
        await db.goldAssets.put(record);
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
            throw new Error(
                'This transaction is auto-populated from Dexie bookings. Delete or cancel the booking instead.'
            );
        }

        const targetItem = sheetPropertyFinances.value.find((i) => i.id === id);
        if (!targetItem) return;

        await deleteSheetRowByBookingId(SPREADSHEET_ID, id, 'Property_Finances');

        sheetPropertyFinances.value = sheetPropertyFinances.value.filter((i) => i.id !== id);
        await db.propertyFinances.delete(id);

        // Cascading delete for 1-to-1 matching payout row
        if (targetItem.category === 'Owner Payout Outflow') {
            const targetDate = targetItem.date;
            const targetAmount = Number(targetItem.amount);

            // Detect recipient name from notes (e.g., "Payout to Danh Nguyen | ...")
            const ownerMatch = targetItem.notes.match(
                /Payout to (Danh Nguyen|Citra Ayu Wardani|Shared)/i
            );
            const recipient = ownerMatch ? ownerMatch[1] : null;

            const matchingTransfer = transfers.value.find(
                (t) =>
                    t.date === targetDate &&
                    Math.abs(Number(t.amount) - targetAmount) < 100 &&
                    (!recipient || t.targetAccount.toLowerCase() === recipient.toLowerCase())
            );

            if (matchingTransfer) {
                await deleteSheetRowByBookingId(SPREADSHEET_ID, matchingTransfer.id, 'Transfers');
                transfers.value = transfers.value.filter((t) => t.id !== matchingTransfer.id);
                await db.transfers.delete(matchingTransfer.id);

                if (matchingTransfer.targetAccount === 'Shared') {
                    const matchingShared = sharedFinances.value.find(
                        (s) =>
                            s.date === targetDate &&
                            s.type === 'income' &&
                            Math.abs(Number(s.amount) - targetAmount) < 100
                    );
                    if (matchingShared) {
                        await deleteSheetRowByBookingId(
                            SPREADSHEET_ID,
                            matchingShared.id,
                            'Shared_Transactions'
                        );
                        sharedFinances.value = sharedFinances.value.filter(
                            (s) => s.id !== matchingShared.id
                        );
                        await db.sharedFinances.delete(matchingShared.id);
                    }
                } else {
                    const matchingPersonal = personalFinances.value.find(
                        (p) =>
                            p.owner === matchingTransfer.targetAccount &&
                            p.date === targetDate &&
                            p.type === 'income' &&
                            Math.abs(Number(p.amount) - targetAmount) < 100
                    );
                    if (matchingPersonal) {
                        await deleteSheetRowByBookingId(
                            SPREADSHEET_ID,
                            matchingPersonal.id,
                            'Personal_Transactions'
                        );
                        personalFinances.value = personalFinances.value.filter(
                            (p) => p.id !== matchingPersonal.id
                        );
                        await db.personalFinances.delete(matchingPersonal.id);
                    }
                }
            }
        }
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
    async function fetchRecurringTemplates(): Promise<void> {
        try {
            const rows = await fetchSheetRows(SPREADSHEET_ID, "'Recurring_Templates'!A2:K").catch(
                () => []
            );
            if (rows.length) {
                const parsed: RecurringTemplate[] = rows
                    .filter((r) => r[0] && String(r[0]).trim())
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
                        notes: String(r[10] || '').trim(),
                    }));

                recurringTemplates.value = parsed;
                db.recurringTemplates
                    .clear()
                    .then(() => db.recurringTemplates.bulkPut(parsed))
                    .catch(() => {});
            }
        } catch (err) {
            console.error('Failed fetching recurring templates:', err);
        }
    }
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

    const sbnInvestments = ref<SbnInvestment[]>([
        {
            id: 'SBN-SR022-01',
            series: 'SR022-T3',
            owner: 'Shared',
            principalAmount: Number(import.meta.env.VITE_SBN_AMOUNT) || 0,
            couponRatePct: 6.45,
            taxRatePct: 10,
            issueDate: '2025-06-25',
            maturityDate: '2028-06-10',
            payoutDayOfMonth: 10,
            active: true,
            notes: 'Kemenkeu Sukuk Ritel Syariah via BCA',
        },
    ]);

    // SBN Yield Computations
    const sbnTotalPrincipal = computed<number>(() =>
        sbnInvestments.value.filter((s) => s.active).reduce((sum, s) => sum + s.principalAmount, 0)
    );

    // Monthly Gross Coupon = (Principal * Rate / 12)
    const sbnMonthlyGrossYield = computed<number>(() =>
        sbnInvestments.value
            .filter((s) => s.active)
            .reduce((sum, s) => sum + (s.principalAmount * (s.couponRatePct / 100)) / 12, 0)
    );

    // Monthly Net Coupon = Gross - 10% Final Tax
    const sbnMonthlyNetYield = computed<number>(() =>
        sbnInvestments.value
            .filter((s) => s.active)
            .reduce((sum, s) => {
                const gross = (s.principalAmount * (s.couponRatePct / 100)) / 12;
                return sum + gross * (1 - s.taxRatePct / 100);
            }, 0)
    );

    // Historical SBN coupons actually collected across Shared & Personal ledgers
    const sbnTotalCollectedYield = computed<number>(() => {
        const fromShared = sharedFinances.value
            .filter((s) => s.type === 'income' && /SR022|SBN/i.test(s.category))
            .reduce((sum, s) => sum + Number(s.amount), 0);

        const fromPersonal = personalFinances.value
            .filter((p) => p.type === 'income' && /SR022|SBN/i.test(p.notes))
            .reduce((sum, p) => sum + Number(p.amount), 0);

        return fromShared + fromPersonal;
    });

    // Gold Metrics
    const goldTotalCostBasis = computed<number>(() =>
        goldAssets.value.reduce((sum, g) => sum + Number(g.buyPriceTotal), 0)
    );

    const goldPnLPct = computed<number>(() => {
        if (goldTotalCostBasis.value === 0) return 0;
        return Number(((goldUnrealizedPnL.value / goldTotalCostBasis.value) * 100).toFixed(1));
    });

    // Combined Portfolio Summary
    const portfolioSummary = computed<InvestmentPortfolioSummary>(() => {
        const totalVal = sbnTotalPrincipal.value + estimatedGoldMarketValue.value;
        return {
            sbnTotalPrincipal: sbnTotalPrincipal.value,
            sbnMonthlyGrossYield: sbnMonthlyGrossYield.value,
            sbnMonthlyNetYield: sbnMonthlyNetYield.value,
            sbnTotalCollectedYield: sbnTotalCollectedYield.value,
            goldTotalGrams: totalGoldGrams.value,
            goldTotalCostBasis: goldTotalCostBasis.value,
            goldCurrentValuation: estimatedGoldMarketValue.value,
            goldUnrealizedPnL: goldUnrealizedPnL.value,
            goldPnLPct: goldPnLPct.value,
            totalPortfolioValue: totalVal,
        };
    });

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
        updatePropertyTransaction,
        deletePropertyTransaction,
        deletePersonalTransaction,
        deleteSharedTransaction,
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
        sbnInvestments,
        sbnTotalPrincipal,
        sbnMonthlyGrossYield,
        sbnMonthlyNetYield,
        sbnTotalCollectedYield,
        goldPnLPct,
        portfolioSummary,
    };
});
