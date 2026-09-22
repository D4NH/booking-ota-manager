import { defineStore } from 'pinia';
import { ref, shallowRef, computed } from 'vue';
import { db } from '@/db';
import { useGoogleSheets } from '@/composables/useGoogleSheets';
import { useBookingStore } from '@/stores/useBookingStore';
import { usePropertyFinance } from '@/composables/finance/usePropertyFinance';
import { usePersonalFinance } from '@/composables/finance/usePersonalFinance';
import { getCurrentMonth, normalizeDate } from '@/utils/date';
import {
    capitalize,
    getPreviousMonthStr,
    isDateInMonth,
    sortNewestFirst,
} from '@/utils/financeCalculators';
import type {
    PropertyFinance,
    PersonalFinance,
    GoldAsset,
    SharedFinance,
    OwnerTransfer,
    Property,
    RecurringTemplate,
    ProjectedRecurringItem,
    SbnInvestment,
    InvestmentPortfolioSummary,
    SavingGoal,
    ComputedSavingGoal,
} from '@/types/finance';

const SPREADSHEET_ID = import.meta.env.VITE_FINANCE_SPREADSHEET_ID as string;

export const useFinanceStore = defineStore('finance', () => {
    const { appendSheetRow, deleteSheetRowByBookingId, batchFetchSheetRows } = useGoogleSheets();
    const bookingStore = useBookingStore();

    const properties = shallowRef<Property[]>([]);
    const sheetPropertyFinances = shallowRef<PropertyFinance[]>([]);
    const personalFinances = shallowRef<PersonalFinance[]>([]);
    const sharedFinances = shallowRef<SharedFinance[]>([]);
    const transfers = shallowRef<OwnerTransfer[]>([]);
    const goldAssets = shallowRef<GoldAsset[]>([]);
    const recurringTemplates = shallowRef<RecurringTemplate[]>([]);
    const savingGoals = ref<SavingGoal[]>([]);

    const currentGoldPricePerGram = ref<number>(2450000);
    const selectedMonth = ref<string>(getCurrentMonth());
    const isLoading = ref<boolean>(false);
    const error = ref<string | null>(null);

    const previousMonth = computed<string>(() => getPreviousMonthStr(selectedMonth.value));

    const propertyDomain = usePropertyFinance(sheetPropertyFinances, selectedMonth, previousMonth);
    const personalDomain = usePersonalFinance(
        personalFinances,
        sharedFinances,
        goldAssets,
        currentGoldPricePerGram,
        selectedMonth,
        previousMonth
    );

    // Transfers
    const filteredTransfers = computed(() =>
        transfers.value
            .filter((item) => isDateInMonth(item.date, selectedMonth.value))
            .sort(sortNewestFirst)
    );
    const totalOwnerDraws = computed<number>(() =>
        filteredTransfers.value.reduce((sum, item) => sum + Number(item.amount), 0)
    );

    // Investments (SBN & Gold)
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

    const sbnTotalPrincipal = computed<number>(() =>
        sbnInvestments.value.filter((s) => s.active).reduce((sum, s) => sum + s.principalAmount, 0)
    );

    const sbnMonthlyGrossYield = computed<number>(() =>
        sbnInvestments.value
            .filter((s) => s.active)
            .reduce((sum, s) => sum + (s.principalAmount * (s.couponRatePct / 100)) / 12, 0)
    );
    const sbnMonthlyNetYield = computed<number>(() =>
        sbnInvestments.value
            .filter((s) => s.active)
            .reduce((sum, s) => {
                const gross = (s.principalAmount * (s.couponRatePct / 100)) / 12;
                return sum + gross * (1 - s.taxRatePct / 100);
            }, 0)
    );
    const sbnTotalCollectedYield = computed<number>(() => {
        const fromShared = sharedFinances.value
            .filter((s) => s.type === 'income' && /SR022|SBN/i.test(s.category))
            .reduce((sum, s) => sum + Number(s.amount), 0);

        const fromPersonal = personalFinances.value
            .filter((p) => p.type === 'income' && /SR022|SBN/i.test(p.notes))
            .reduce((sum, p) => sum + Number(p.amount), 0);

        return fromShared + fromPersonal;
    });
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
    const goldPnLPct = computed<number>(() => {
        if (totalGoldCostBasis.value === 0) return 0;
        return Number(((goldUnrealizedPnL.value / totalGoldCostBasis.value) * 100).toFixed(1));
    });
    const portfolioSummary = computed<InvestmentPortfolioSummary>(() => {
        const totalVal = sbnTotalPrincipal.value + estimatedGoldMarketValue.value;
        return {
            sbnTotalPrincipal: sbnTotalPrincipal.value,
            sbnMonthlyGrossYield: sbnMonthlyGrossYield.value,
            sbnMonthlyNetYield: sbnMonthlyNetYield.value,
            sbnTotalCollectedYield: sbnTotalCollectedYield.value,
            goldTotalGrams: totalGoldGrams.value,
            goldTotalCostBasis: totalGoldCostBasis.value,
            goldCurrentValuation: estimatedGoldMarketValue.value,
            goldUnrealizedPnL: goldUnrealizedPnL.value,
            goldPnLPct: goldPnLPct.value,
            totalPortfolioValue: totalVal,
        };
    });
    const dynamicAllocatedGoals = computed<ComputedSavingGoal[]>(() => {
        // Compute total available liquid savings per owner
        const pools: Record<string, number> = {
            'Danh Nguyen': 0,
            'Citra Ayu Wardani': 0,
            Shared: 0,
        };

        personalDomain.dynamicSavingsAccounts.value.forEach((acc) => {
            const owner = acc.owner || 'Shared';
            pools[owner] = (pools[owner] || 0) + Math.max(0, Number(acc.balance) || 0);
        });

        // Create a mutable balance pool copy
        const remainingPools: Record<string, number> = { ...pools };

        // Sort goals by priority (or earliest deadline if priority is identical)
        const sortedGoals = [...savingGoals.value].sort((a, b) => {
            const pA = a.priority ?? 99;
            const pB = b.priority ?? 99;
            if (pA !== pB) return pA - pB;
            return (a.deadline || '9999').localeCompare(b.deadline || '9999');
        });

        // Cascade allocate funds up to 100% capacity
        return sortedGoals.map((goal): ComputedSavingGoal => {
            const ownerPool = remainingPools[goal.owner] ?? 0;
            const needed = goal.targetAmount;

            // Take from pool up to the target amount, never exceeding it
            const allocated = Math.min(ownerPool, needed);

            // Deduct allocated amount so next goal gets only the remainder
            remainingPools[goal.owner] = Math.max(0, ownerPool - allocated);

            const progressPct =
                needed > 0 ? Math.min(100, Math.round((allocated / needed) * 100)) : 0;
            const isCompleted = allocated >= needed;

            return {
                ...goal,
                allocatedAmount: allocated,
                progressPct,
                isCompleted,
                remainingAmount: Math.max(0, needed - allocated),
            };
        });
    });

    // Recurring Templates
    const monthlyProjectedRecurring = computed<ProjectedRecurringItem[]>(() => {
        const cycle = selectedMonth.value; // e.g. "2026-09"
        const currentMonthNumber = Number(cycle.split('-')[1]); // 9

        // Filter active templates that apply to THIS month
        const applicableTemplates = recurringTemplates.value.filter((t) => {
            if (!t.active) return false;
            if (t.frequency === 'yearly') {
                // Only include if dueMonthOfYear matches active selectedMonth
                return Number(t.dueMonthOfYear) === currentMonthNumber;
            }
            return true; // 'monthly' items apply to all months
        });

        if (!applicableTemplates.length) return [];

        // Pre-indexed sets for O(1) matching
        const propSet = new Set(
            propertyDomain.filteredPropertyFinances.value.map(
                (p) => `${p.category.toLowerCase().trim()}_${Math.round(p.amount)}`
            )
        );
        const sharedSet = new Set(
            personalDomain.filteredSharedFinances.value.map(
                (s) => `${s.category.toLowerCase().trim()}_${Math.round(s.amount)}`
            )
        );
        const personalSet = new Set(
            personalDomain.filteredPersonalFinances.value.map(
                (p) => `${p.owner}_${p.category.toLowerCase().trim()}_${Math.round(p.amount)}`
            )
        );

        return applicableTemplates.map((template) => {
            const dayStr = String(Math.min(Math.max(template.dueDayOfMonth, 1), 28)).padStart(
                2,
                '0'
            );
            const dueDate = `${cycle}-${dayStr}`;
            const keyBase = `${template.category.toLowerCase().trim()}_${Math.round(template.amount)}`;

            let isSettled = false;
            if (template.targetLedger === 'Property') isSettled = propSet.has(keyBase);
            else if (template.targetLedger === 'Shared') isSettled = sharedSet.has(keyBase);
            else if (template.targetLedger === 'Personal' && template.owner) {
                isSettled = personalSet.has(`${template.owner}_${keyBase}`);
            }

            return { ...template, cycleMonth: cycle, dueDate, isSettled };
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

    // Transfers
    async function recordOwnerTransfer(payload: Omit<OwnerTransfer, 'id'>): Promise<void> {
        const cleanDate = normalizeDate(payload.date);
        const sourceProperty = capitalize(payload.sourcePropertyId);
        const amount = Number(payload.amount);

        if (payload.targetAccount === 'Split') {
            const owners: PersonalFinance['owner'][] = ['Danh Nguyen', 'Citra Ayu Wardani'];
            for (const owner of owners) {
                const outflowId = crypto.randomUUID();
                const transferId = crypto.randomUUID();
                const entryId = crypto.randomUUID();
                const noteText = [`Payout to ${owner}`, payload.notes].filter(Boolean).join(' | ');

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
                await appendSheetRow(
                    SPREADSHEET_ID,
                    [transferId, payload.sourcePropertyId, owner, amount, cleanDate, noteText],
                    "'Transfers'!A1"
                );
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
    async function deletePropertyTransaction(id: string): Promise<void> {
        if (id.startsWith('dexie-')) {
            throw new Error('This transaction is auto-populated from Dexie bookings.');
        }

        const targetItem = sheetPropertyFinances.value.find((i) => i.id === id);
        if (!targetItem) return;

        await deleteSheetRowByBookingId(SPREADSHEET_ID, id, 'Property_Finances');
        sheetPropertyFinances.value = sheetPropertyFinances.value.filter((i) => i.id !== id);
        await db.propertyFinances.delete(id);

        if (targetItem.category === 'Owner Payout Outflow') {
            const targetDate = targetItem.date;
            const targetAmount = Number(targetItem.amount);
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
    async function settleRecurringItem(item: ProjectedRecurringItem): Promise<void> {
        if (item.isSettled) return;
        const itemNote = item.notes?.trim() || '';
        const formattedNotes = itemNote
            ? `[RECURRING] ${itemNote}`
            : `[RECURRING] ${item.category}`;

        if (item.targetLedger === 'Property') {
            await propertyDomain.addPropertyTransaction({
                propertyId: item.propertyId || 'piyungan',
                type: item.type === 'income' ? 'income' : 'expense',
                category: item.category,
                amount: item.amount,
                date: item.dueDate,
                notes: formattedNotes,
            });
        } else if (item.targetLedger === 'Shared') {
            await personalDomain.addSharedTransaction({
                type: item.type,
                category: item.category,
                amount: item.amount,
                date: item.dueDate,
                notes: formattedNotes,
            });
        } else if (item.targetLedger === 'Personal' && item.owner) {
            await personalDomain.addPersonalTransaction({
                owner: item.owner,
                type: item.type,
                category: item.category,
                amount: item.amount,
                date: item.dueDate,
                notes: formattedNotes,
            });
        }
    }
    async function addSavingGoal(payload: Omit<SavingGoal, 'id'>): Promise<void> {
        const id = `GOAL-${Date.now()}-${crypto.randomUUID().slice(0, 4)}`;
        const newGoal: SavingGoal = {
            ...payload,
            id,
            targetAmount: Number(payload.targetAmount),
            priority: Number(payload.priority) || 1,
        };

        await appendSheetRow(
            SPREADSHEET_ID,
            [
                newGoal.id,
                newGoal.name,
                newGoal.owner,
                newGoal.targetAmount,
                newGoal.priority ?? 1,
                newGoal.deadline || '',
                newGoal.notes || '',
            ],
            "'Saving_Goals'!A1"
        );

        savingGoals.value = [...savingGoals.value, newGoal];

        if (db.savingGoals) {
            await db.savingGoals
                .put(newGoal)
                .catch((e) => console.warn('Dexie goal save error:', e));
        }
    }

    // Data Synchronization
    const loadLocalFinanceData = async (): Promise<void> => {
        try {
            if (!db.propertyFinances) return;
            const [pFin, persFin, sFin, trans, gold, rec, goals] = await Promise.all([
                db.propertyFinances.toArray(),
                db.personalFinances.toArray(),
                db.sharedFinances.toArray(),
                db.transfers.toArray(),
                db.goldAssets.toArray(),
                db.recurringTemplates.toArray(),
                db.savingGoals ? db.savingGoals.toArray() : Promise.resolve([]),
            ]);

            if (pFin.length) sheetPropertyFinances.value = pFin;
            if (persFin.length) personalFinances.value = persFin;
            if (sFin.length) sharedFinances.value = sFin;
            if (trans.length) transfers.value = trans;
            if (gold.length) goldAssets.value = gold;
            if (rec.length) recurringTemplates.value = rec;
            if (goals.length) savingGoals.value = goals;
        } catch (err) {
            console.error('Failed to load local finance storage:', err);
        }
    };
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
                "'Recurring_Templates'!A2:L",
                "'Saving_Goals'!A2:G",
            ];

            const batchResults = await batchFetchSheetRows(SPREADSHEET_ID, financeRanges);

            if (batchResults[0]?.length) {
                properties.value = batchResults[0]
                    .filter((r) => r[0] && String(r[0]).trim())
                    .map((r) => ({
                        id: String(r[0]),
                        name: String(r[1] || ''),
                        address: String(r[2] || ''),
                    }));
            }

            const parsedPropFinances = (batchResults[1] || [])
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

            const parsedPersonal = (batchResults[2] || [])
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

            const parsedShared = (batchResults[3] || [])
                .filter((r) => r[0] && String(r[0]).trim())
                .map((r) => ({
                    id: String(r[0]),
                    type: (r[1] as SharedFinance['type']) || 'expense',
                    category: String(r[2] || ''),
                    amount: Number(r[3]) || 0,
                    date: normalizeDate(r[4]),
                    notes: String(r[5] || ''),
                }));

            const parsedTransfers = (batchResults[4] || [])
                .filter((r) => r[0] && String(r[0]).trim())
                .map((r) => ({
                    id: String(r[0]),
                    sourcePropertyId: String(r[1] || ''),
                    targetAccount: (r[2] as OwnerTransfer['targetAccount']) || 'Shared',
                    amount: Number(r[3]) || 0,
                    date: normalizeDate(r[4]),
                    notes: String(r[5] || ''),
                }));

            const parsedGold = (batchResults[5] || [])
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

            const parsedRecurring = (batchResults[6] || [])
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
                    dueMonthOfYear: r[11] ? Number(r[11]) : undefined,
                }));

            const parsedGoals: SavingGoal[] = (batchResults[7] || [])
                .filter((r) => r[0] && String(r[0]).trim())
                .map((r) => ({
                    id: String(r[0]),
                    name: String(r[1] || ''),
                    owner: (r[2] as SavingGoal['owner']) || 'Shared',
                    targetAmount: Number(r[3]) || 0,
                    priority: Number(r[4]) || 1,
                    deadline: r[5] ? normalizeDate(r[5]) : undefined,
                    notes: String(r[6] || '').trim(),
                }));

            sheetPropertyFinances.value = parsedPropFinances;
            personalFinances.value = parsedPersonal;
            sharedFinances.value = parsedShared;
            transfers.value = parsedTransfers;
            goldAssets.value = parsedGold;
            recurringTemplates.value = parsedRecurring;
            savingGoals.value = parsedGoals;

            db.transaction(
                'rw',
                [
                    db.propertyFinances,
                    db.personalFinances,
                    db.sharedFinances,
                    db.transfers,
                    db.goldAssets,
                    db.recurringTemplates,
                    db.savingGoals,
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
                        db.savingGoals.clear().then(() => db.savingGoals.bulkPut(parsedGoals)),
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

    return {
        properties,
        sheetPropertyFinances,
        personalFinances,
        sharedFinances,
        transfers,
        selectedMonth,
        previousMonth,
        isLoading,
        error,

        // Property Domain
        unifiedPropertyFinances: propertyDomain.unifiedPropertyFinances,
        filteredPropertyFinances: propertyDomain.filteredPropertyFinances,
        monthlyPropertyRevenue: propertyDomain.monthlyPropertyRevenue,
        monthlyPropertyExpenses: propertyDomain.monthlyPropertyExpenses,
        monthlyOwnerDraws: propertyDomain.monthlyOwnerDraws,
        netPropertyProfit: propertyDomain.netPropertyProfit,
        previousMonthPropertyRevenue: propertyDomain.previousMonthPropertyRevenue,
        previousMonthPropertyExpenses: propertyDomain.previousMonthPropertyExpenses,
        propertyRevenueGrowthPct: propertyDomain.propertyRevenueGrowthPct,
        propertyExpenseGrowthPct: propertyDomain.propertyExpenseGrowthPct,
        addPropertyTransaction: propertyDomain.addPropertyTransaction,
        updatePropertyTransaction: propertyDomain.updatePropertyTransaction,
        deletePropertyTransaction,
        persistDexieBookingsToRemoteSheet: propertyDomain.persistDexieBookingsToRemoteSheet,

        // Personal & Shared Domain
        filteredPersonalFinances: personalDomain.filteredPersonalFinances,
        filteredSharedFinances: personalDomain.filteredSharedFinances,
        dynamicSavingsTransactions: personalDomain.dynamicSavingsTransactions,
        dynamicSavingsAccounts: personalDomain.dynamicSavingsAccounts,
        dynamicTotalSavings: personalDomain.dynamicTotalSavings,

        // Current
        danhNetBalance: personalDomain.danhNetBalance,
        citraNetBalance: personalDomain.citraNetBalance,
        sharedNetBalance: personalDomain.sharedNetBalance,
        danhMonthlyRevenue: personalDomain.danhMonthlyRevenue,
        danhMonthlyExpenses: personalDomain.danhMonthlyExpenses,
        citraMonthlyRevenue: personalDomain.citraMonthlyRevenue,
        citraMonthlyExpenses: personalDomain.citraMonthlyExpenses,
        sharedMonthlyRevenue: personalDomain.sharedMonthlyRevenue,
        sharedMonthlyExpenses: personalDomain.sharedMonthlyExpenses,

        // Previous
        danhPreviousMonthRevenue: personalDomain.danhPreviousMonthRevenue,
        danhPreviousMonthExpenses: personalDomain.danhPreviousMonthExpenses,
        citraPreviousMonthRevenue: personalDomain.citraPreviousMonthRevenue,
        citraPreviousMonthExpenses: personalDomain.citraPreviousMonthExpenses,
        sharedPreviousMonthRevenue: personalDomain.sharedPreviousMonthRevenue,
        sharedPreviousMonthExpenses: personalDomain.sharedPreviousMonthExpenses,

        // Growth Rates
        danhRevenueGrowthPct: personalDomain.danhRevenueGrowthPct,
        danhExpenseGrowthPct: personalDomain.danhExpenseGrowthPct,
        citraRevenueGrowthPct: personalDomain.citraRevenueGrowthPct,
        citraExpenseGrowthPct: personalDomain.citraExpenseGrowthPct,
        sharedRevenueGrowthPct: personalDomain.sharedRevenueGrowthPct,
        sharedExpenseGrowthPct: personalDomain.sharedExpenseGrowthPct,

        // Actions
        addPersonalTransaction: personalDomain.addPersonalTransaction,
        addSharedTransaction: personalDomain.addSharedTransaction,
        updatePersonalTransaction: personalDomain.updatePersonalTransaction,
        updateSharedTransaction: personalDomain.updateSharedTransaction,
        deletePersonalTransaction: personalDomain.deletePersonalTransaction,
        deleteSharedTransaction: personalDomain.deleteSharedTransaction,

        // Transfers
        filteredTransfers,
        totalOwnerDraws,
        recordOwnerTransfer,

        // Investments
        sbnInvestments,
        sbnTotalPrincipal,
        sbnMonthlyGrossYield,
        sbnMonthlyNetYield,
        sbnTotalCollectedYield,
        goldAssets,
        currentGoldPricePerGram,
        totalGoldGrams,
        totalGoldCostBasis,
        estimatedGoldMarketValue,
        goldUnrealizedPnL,
        goldPnLPct,
        portfolioSummary,
        addGoldPurchase,

        // Savinfs
        savingGoals,
        addSavingGoal,
        dynamicAllocatedGoals,

        // Recurring
        recurringTemplates,
        monthlyProjectedRecurring,
        monthlyProjectedIncome: computed(() => recurringMetrics.value.incomeList),
        monthlyProjectedExpenses: computed(() => recurringMetrics.value.expenseList),
        pendingRecurringIncome: computed(() => recurringMetrics.value.pendingIncome),
        pendingRecurringExpenses: computed(() => recurringMetrics.value.pendingExpense),
        netProjectedRecurringSpread: computed(() => recurringMetrics.value.spread),
        settleRecurringItem,

        // Sync Actions
        loadLocalFinanceData,
        fetchFinancialData,
    };
});
