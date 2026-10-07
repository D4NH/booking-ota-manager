import { defineStore } from 'pinia';
import { ref, shallowRef, computed } from 'vue';
import { db } from '@/db';
import { useGoogleSheets } from '@/composables/useGoogleSheets';
import { useBookingStore } from '@/stores/useBookingStore';
import { usePropertyFinance } from '@/composables/finance/usePropertyFinance';
import { usePersonalFinance } from '@/composables/finance/usePersonalFinance';
import { getCurrentMonth, normalizeDate } from '@/utils/date';
import { capitalize, getPreviousMonthStr, isDateInMonth, sortNewestFirst } from '@/utils/finance';
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
    SbnSeries,
    InvestmentPortfolioSummary,
    AccountSbnBreakdown,
    SavingGoal,
    ComputedSavingGoal,
    BrandGoldBreakdown,
    AccountGoldBreakdown,
    PersonalOwner,
} from '@/types/finance';

const SPREADSHEET_ID = import.meta.env.VITE_FINANCE_SPREADSHEET_ID as string;
const BRAND_COLORS: Record<string, string> = {
    Antam: '#fbbf24', // amber-400
    UBS: '#f59e0b', // amber-500
    Semar: '#fde047', // yellow-300
    'Galeri 24': '#38bdf8', // sky-400
    'Digital Pegadaian': '#34d399', // emerald-400
    Pluang: '#a78bfa', // violet-400
};
const GOLD_PRICE_CACHE_KEY = 'app_gold_price';
const GOLD_PRICE_TIME_KEY = 'app_gold_price_time';
const DEFAULT_GOLD_PRICE = 2300000;

function computeBrandDistribution(assets: GoldAsset[], pricePerGram: number): BrandGoldBreakdown[] {
    const totalGrams = assets.reduce((sum, a) => sum + Number(a.weightGrams || 0), 0);
    const groups = new Map<string, { grams: number; cost: number; count: number }>();

    for (let i = 0; i < assets.length; i++) {
        const a = assets[i];
        if (!a) continue;
        const brand = a.type || 'Other';
        const existing = groups.get(brand) || { grams: 0, cost: 0, count: 0 };
        existing.grams += Number(a.weightGrams || 0);
        existing.cost += Number(a.buyPriceTotal || 0);
        existing.count += 1;
        groups.set(brand, existing);
    }

    return Array.from(groups.entries())
        .map(([brand, data]) => {
            const valuation = data.grams * pricePerGram;
            const pnl = valuation - data.cost;
            const pct = totalGrams > 0 ? Number(((data.grams / totalGrams) * 100).toFixed(1)) : 0;
            const color = BRAND_COLORS[brand] || '#71717a';

            return {
                brand,
                weightGrams: Number(data.grams.toFixed(2)),
                buyPriceTotal: data.cost,
                valuation,
                unrealizedPnL: pnl,
                pctOfTotal: pct,
                certificateCount: data.count,
                color,
            };
        })
        .sort((a, b) => b.weightGrams - a.weightGrams);
}

export const useFinanceStore = defineStore('finance', () => {
    const { appendSheetRow, updateSheetRowById, deleteSheetRowById, batchFetchSheetRows } =
        useGoogleSheets();
    const bookingStore = useBookingStore();

    const properties = shallowRef<Property[]>([]);
    const sheetPropertyFinances = shallowRef<PropertyFinance[]>([]);
    const personalFinances = shallowRef<PersonalFinance[]>([]);
    const sharedFinances = shallowRef<SharedFinance[]>([]);
    const transfers = shallowRef<OwnerTransfer[]>([]);
    const goldAssets = shallowRef<GoldAsset[]>([]);
    const recurringTemplates = shallowRef<RecurringTemplate[]>([]);
    const currentGoldPricePerGram = ref<number>(
        Number(localStorage.getItem(GOLD_PRICE_CACHE_KEY)) || DEFAULT_GOLD_PRICE
    );
    const lastGoldPriceSync = ref<string>(localStorage.getItem(GOLD_PRICE_TIME_KEY) || '');
    const isFetchingGoldPrice = ref<boolean>(false);
    const sbnInvestments = ref<SbnInvestment[]>([]);
    const savingGoals = ref<SavingGoal[]>([]);
    const selectedMonth = ref<string>(getCurrentMonth());
    const isLoading = ref<boolean>(false);
    const error = ref<string | null>(null);

    const previousMonth = computed<string>(() => getPreviousMonthStr(selectedMonth.value));

    const propertyDomain = usePropertyFinance(sheetPropertyFinances, selectedMonth, previousMonth);
    const personalDomain = usePersonalFinance(
        personalFinances,
        sharedFinances,
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

    // Investments
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
        return (
            getCollectedYieldForOwner('Shared') +
            getCollectedYieldForOwner('Danh Nguyen') +
            getCollectedYieldForOwner('Citra Ayu Wardani')
        );
    });
    const sbnAccountAllocation = computed<AccountSbnBreakdown[]>(() => {
        const totalPrincipal = sbnTotalPrincipal.value || 0;

        const accountsConfig: {
            owner: PersonalOwner | 'Shared';
            label: string;
            badgeClass: string;
        }[] = [
            {
                owner: 'Danh Nguyen',
                label: 'Danh',
                badgeClass: 'text-lime-400 bg-lime-400/10 border-lime-400/20',
            },
            {
                owner: 'Citra Ayu Wardani',
                label: 'Citra',
                badgeClass: 'text-sky-300 bg-sky-400/10 border-sky-400/20',
            },
            {
                owner: 'Shared',
                label: 'Shared',
                badgeClass: 'text-amber-300 bg-amber-400/10 border-amber-400/20',
            },
        ];

        return accountsConfig.map(({ owner, label, badgeClass }) => {
            const activeItems = sbnInvestments.value.filter((s) => s.active && s.owner === owner);
            const principal = activeItems.reduce(
                (sum, s) => sum + (Number(s.principalAmount) || 0),
                0
            );

            const grossYield = activeItems.reduce((sum, s) => {
                return sum + (s.principalAmount * (s.couponRatePct / 100)) / 12;
            }, 0);

            const netYield = activeItems.reduce((sum, s) => {
                const gross = (s.principalAmount * (s.couponRatePct / 100)) / 12;
                return sum + gross * (1 - s.taxRatePct / 100);
            }, 0);

            const collectedYield = getCollectedYieldForOwner(owner);
            const pctOfTotal =
                totalPrincipal > 0 ? Number(((principal / totalPrincipal) * 100).toFixed(1)) : 0;

            return {
                owner,
                label,
                badgeClass,
                principalAmount: principal,
                monthlyGrossYield: Math.round(grossYield),
                monthlyNetYield: Math.round(netYield),
                totalCollectedYield: collectedYield,
                pctOfTotal,
                activeCount: activeItems.length,
                investments: activeItems,
            };
        });
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
    const goldBrandAllocation = computed<BrandGoldBreakdown[]>(() =>
        computeBrandDistribution(goldAssets.value, currentGoldPricePerGram.value)
    );
    const goldAccountAllocation = computed<AccountGoldBreakdown[]>(() => {
        const totalReserveGrams = totalGoldGrams.value || 0;
        const pricePerGram = currentGoldPricePerGram.value || 0;

        const accountsConfig: {
            owner: PersonalOwner | 'Shared';
            label: string;
            badgeClass: string;
        }[] = [
            {
                owner: 'Danh Nguyen',
                label: 'Danh',
                badgeClass: 'text-lime-400 bg-lime-400/10 border-lime-400/20',
            },
            {
                owner: 'Citra Ayu Wardani',
                label: 'Citra',
                badgeClass: 'text-sky-300 bg-sky-400/10 border-sky-400/20',
            },
            {
                owner: 'Shared',
                label: 'Shared',
                badgeClass: 'text-amber-300 bg-amber-400/10 border-amber-400/20',
            },
        ];

        return accountsConfig.map(({ owner, label, badgeClass }) => {
            const accountAssets = goldAssets.value.filter((a) => a.owner === owner);
            const grams = accountAssets.reduce((sum, a) => sum + Number(a.weightGrams || 0), 0);
            const costBasis = accountAssets.reduce(
                (sum, a) => sum + Number(a.buyPriceTotal || 0),
                0
            );
            const valuation = grams * pricePerGram;
            const pnl = valuation - costBasis;
            const pnlPct = costBasis > 0 ? Number(((pnl / costBasis) * 100).toFixed(1)) : 0;
            const pctOfTotal =
                totalReserveGrams > 0 ? Number(((grams / totalReserveGrams) * 100).toFixed(1)) : 0;

            // Brand breakdown specific to this account
            const accountBrands = computeBrandDistribution(accountAssets, pricePerGram);

            return {
                owner,
                label,
                badgeClass,
                weightGrams: Number(grams.toFixed(2)),
                buyPriceTotal: costBasis,
                valuation,
                unrealizedPnL: pnl,
                pnLPct: pnlPct,
                pctOfTotal,
                certificateCount: accountAssets.length,
                brands: accountBrands,
            };
        });
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
        // Compute total available savings per owner
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
        const cycle = selectedMonth.value; // "2026-09"
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
            const tasks: Promise<unknown>[] = [];

            for (const owner of owners) {
                const outflowId = crypto.randomUUID();
                const transferId = crypto.randomUUID();
                const entryId = crypto.randomUUID();
                const noteText = [`Payout to ${owner}`, payload.notes].filter(Boolean).join(' | ');

                tasks.push(
                    appendSheetRow(
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
                    ),
                    appendSheetRow(
                        SPREADSHEET_ID,
                        [transferId, payload.sourcePropertyId, owner, amount, cleanDate, noteText],
                        "'Transfers'!A1"
                    ),
                    appendSheetRow(
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
                    )
                );
            }

            await Promise.all(tasks);
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

        await deleteSheetRowById(SPREADSHEET_ID, id, 'Property_Finances');
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
                await deleteSheetRowById(SPREADSHEET_ID, matchingTransfer.id, 'Transfers');
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
                        await deleteSheetRowById(
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
                        await deleteSheetRowById(
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
    async function updateGoldAsset(id: string, payload: Omit<GoldAsset, 'id'>): Promise<void> {
        const cleanDate = normalizeDate(payload.purchaseDate);
        const updatedRecord: GoldAsset = {
            ...payload,
            id,
            purchaseDate: cleanDate,
            weightGrams: Number(payload.weightGrams),
            buyPriceTotal: Number(payload.buyPriceTotal),
            certificateNumber: payload.certificateNumber?.trim() || '',
        };

        await updateSheetRowById(
            SPREADSHEET_ID,
            id,
            [
                id,
                updatedRecord.owner,
                updatedRecord.type,
                updatedRecord.weightGrams,
                updatedRecord.buyPriceTotal,
                cleanDate,
                updatedRecord.certificateNumber || '',
            ],
            'Gold_Assets'
        );

        goldAssets.value = goldAssets.value.map((g) => (g.id === id ? updatedRecord : g));
        if (db.goldAssets) {
            await db.goldAssets.put(updatedRecord).catch(() => {});
        }
    }
    async function deleteGoldAsset(id: string): Promise<void> {
        await deleteSheetRowById(SPREADSHEET_ID, id, 'Gold_Assets');
        goldAssets.value = goldAssets.value.filter((g) => g.id !== id);
        if (db.goldAssets) {
            await db.goldAssets.delete(id).catch(() => {});
        }
    }
    /**
     * Fetches live Antam gold price per gram from logam-mulia-api.
     * Caches in localStorage for 1 hour to prevent redundant requests.
     */
    async function fetchLiveGoldPrice(force = false): Promise<number> {
        const lastSync = Number(localStorage.getItem(GOLD_PRICE_TIME_KEY)) || 0;
        const oneHourMs = 60 * 60 * 1000;

        // Use cache if fetched less than 1 hour ago
        if (!force && Date.now() - lastSync < oneHourMs && currentGoldPricePerGram.value > 0) {
            return currentGoldPricePerGram.value;
        }

        isFetchingGoldPrice.value = true;
        try {
            const workerUrl = import.meta.env.VITE_GOLD_PRICE_API_URL;

            let res = await fetch(workerUrl).catch(() => null);

            if (!res || !res.ok) {
                res = await fetch(
                    'https://logam-mulia-api.iamutaki.workers.dev/api/prices/logammulia'
                );
            }

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const json = (await res.json()) as {
                success?: boolean;
                price?: number;
                data?: Array<{
                    material?: string;
                    materialType?: string;
                    weight?: number;
                    sellPrice?: number;
                }>;
            };

            let livePrice = 0;

            if (json.price && typeof json.price === 'number') {
                livePrice = json.price;
            } else if (Array.isArray(json.data)) {
                const standardOneGram = json.data.find(
                    (item) =>
                        item.material === 'gold' &&
                        item.materialType === 'Emas Batangan' &&
                        Number(item.weight) === 1
                );
                const fallbackOneGram = json.data.find(
                    (item) => item.material === 'gold' && Number(item.weight) === 1
                );
                livePrice = Number(standardOneGram?.sellPrice ?? fallbackOneGram?.sellPrice ?? 0);
            }

            if (livePrice >= 1_500_000 && livePrice <= 5_000_000) {
                currentGoldPricePerGram.value = livePrice;
                const recordedAt = new Date().toISOString();
                lastGoldPriceSync.value = recordedAt;
                localStorage.setItem(GOLD_PRICE_CACHE_KEY, String(livePrice));
                localStorage.setItem(GOLD_PRICE_TIME_KEY, String(Date.now()));
                return livePrice;
            }

            return currentGoldPricePerGram.value;
        } catch (err) {
            console.warn(
                '[Gold Price Sync] Failed to fetch live Antam price, using cached fallback:',
                err
            );
            return currentGoldPricePerGram.value;
        } finally {
            isFetchingGoldPrice.value = false;
        }
    }
    function setGoldPricePerGram(newPrice: number): void {
        if (newPrice > 0) {
            currentGoldPricePerGram.value = newPrice;
            localStorage.setItem(GOLD_PRICE_CACHE_KEY, String(newPrice));
        }
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
    async function updateSavingGoal(id: string, payload: Omit<SavingGoal, 'id'>): Promise<void> {
        const updatedGoal: SavingGoal = {
            ...payload,
            id,
            targetAmount: Number(payload.targetAmount),
            priority: Number(payload.priority) || 1,
            deadline: payload.deadline ? normalizeDate(payload.deadline) : undefined,
            notes: payload.notes?.trim() || '',
        };

        await updateSheetRowById(
            SPREADSHEET_ID,
            id,
            [
                updatedGoal.id,
                updatedGoal.name,
                updatedGoal.owner,
                updatedGoal.targetAmount,
                updatedGoal.priority ?? 1,
                updatedGoal.deadline || '',
                updatedGoal.notes || '',
            ],
            'Saving_Goals'
        );

        savingGoals.value = savingGoals.value.map((g) => (g.id === id ? updatedGoal : g));
        if (db.savingGoals) {
            await db.savingGoals.put(updatedGoal).catch(() => {});
        }
    }
    async function deleteSavingGoal(id: string): Promise<void> {
        await deleteSheetRowById(SPREADSHEET_ID, id, { sheetName: 'Saving_Goals' });
        savingGoals.value = savingGoals.value.filter((g) => g.id !== id);
        if (db.savingGoals) {
            await db.savingGoals.delete(id).catch(() => {});
        }
    }

    // Data Synchronization
    async function loadLocalFinanceData(): Promise<void> {
        try {
            if (!db.propertyFinances) return;
            const [pFin, persFin, sFin, trans, gold, rec, goals, sbn] = await Promise.all([
                db.propertyFinances.toArray(),
                db.personalFinances.toArray(),
                db.sharedFinances.toArray(),
                db.transfers.toArray(),
                db.goldAssets.toArray(),
                db.recurringTemplates.toArray(),
                db.savingGoals ? db.savingGoals.toArray() : Promise.resolve([]),
                db.sbnInvestments ? db.sbnInvestments.toArray() : Promise.resolve([]),
            ]);

            if (pFin.length) sheetPropertyFinances.value = pFin;
            if (persFin.length) personalFinances.value = persFin;
            if (sFin.length) sharedFinances.value = sFin;
            if (trans.length) transfers.value = trans;
            if (gold.length) goldAssets.value = gold;
            if (rec.length) recurringTemplates.value = rec;
            if (goals.length) savingGoals.value = goals;
            if (sbn.length) sbnInvestments.value = sbn;
        } catch (err) {
            console.error('Failed to load local finance storage:', err);
        }
    }
    async function fetchFinancialData(): Promise<void> {
        isLoading.value = true;
        error.value = null;

        try {
            await Promise.all([
                bookingStore.loadBookings(),
                loadLocalFinanceData(),
                fetchLiveGoldPrice(),
            ]);

            const financeRanges = [
                "'Properties'!A2:C",
                "'Property_Finances'!A2:G",
                "'Personal_Transactions'!A2:I",
                "'Shared_Transactions'!A2:F",
                "'Transfers'!A2:F",
                "'Gold_Assets'!A2:G",
                "'Recurring_Templates'!A2:L",
                "'Saving_Goals'!A2:G",
                "'SBN_Investments'!A2:K",
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

            const REGEX_MHJ_BOOKING = /\[MHJ-BOOKING:\s*([^\]]+)\]/;

            const existingPropTimestamps = new Map(
                sheetPropertyFinances.value.map((i) => [i.id, i.createdAt])
            );
            const existingPersTimestamps = new Map(
                personalFinances.value.map((i) => [i.id, i.createdAt])
            );
            const existingSharedTimestamps = new Map(
                sharedFinances.value.map((i) => [i.id, i.createdAt])
            );

            const parsedPropFinances = (batchResults[1] || [])
                .filter((r) => r[0] && String(r[0]).trim())
                .map((r): PropertyFinance => {
                    const id = String(r[0]).trim();
                    const rawType = String(r[2] || '')
                        .trim()
                        .toLowerCase();
                    const type: PropertyFinance['type'] =
                        rawType === 'income' ? 'income' : 'expense';

                    // Strip "Rp", spaces, and non-numeric punctuation (preserves negative sign & decimals)
                    const rawAmount = String(r[4] ?? '').replace(/[^0-9.-]+/g, '');
                    const amount = Number(rawAmount) || 0;
                    const notes = String(r[6] || '').trim();
                    const bookingMatch = REGEX_MHJ_BOOKING.exec(notes);

                    return {
                        id,
                        propertyId: String(r[1] || '').trim(),
                        bookingId: bookingMatch ? bookingMatch[1]?.trim() : undefined,
                        type,
                        category: String(r[3] || '').trim(),
                        amount,
                        date: normalizeDate(r[5]),
                        notes,
                        createdAt: existingPropTimestamps.get(id), // Retains local timestamp
                    };
                });

            const parsedPersonal = (batchResults[2] || [])
                .filter((r) => r[0] && String(r[0]).trim())
                .map((r): PersonalFinance => {
                    const id = String(r[0]);
                    return {
                        id,
                        owner: (r[1] as PersonalFinance['owner']) || 'Danh Nguyen',
                        type: (r[2] as PersonalFinance['type']) || 'expense',
                        category: String(r[3] || ''),
                        amount: Number(String(r[4] ?? '').replace(/[^0-9.-]+/g, '')) || 0,
                        date: normalizeDate(r[5]),
                        notes: String(r[6] || ''),
                        savingsInstitution: String(r[7] || ''),
                        goldWeightGrams: Number(r[8]) || undefined,
                        createdAt: existingPersTimestamps.get(id), // Retains local timestamp
                    };
                });

            const parsedShared = (batchResults[3] || [])
                .filter((r) => r[0] && String(r[0]).trim())
                .map((r): SharedFinance => {
                    const id = String(r[0]);
                    return {
                        id,
                        type: (r[1] as SharedFinance['type']) || 'expense',
                        category: String(r[2] || ''),
                        amount: Number(String(r[3] ?? '').replace(/[^0-9.-]+/g, '')) || 0,
                        date: normalizeDate(r[4]),
                        notes: String(r[5] || ''),
                        createdAt: existingSharedTimestamps.get(id), // Retains local timestamp
                    };
                });

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
            const parsedSbn: SbnInvestment[] = (batchResults[8] || [])
                .filter((r) => r[0] && String(r[0]).trim())
                .map((r) => ({
                    id: String(r[0]).trim(),
                    series: String(r[1] || 'SR022-T3').trim() as SbnSeries,
                    owner: (String(r[2] || '').trim() as SbnInvestment['owner']) || 'Shared',
                    principalAmount: Number(String(r[3] || '').replace(/[^0-9]/g, '')) || 0,
                    couponRatePct: Number(r[4]) || 6.45,
                    taxRatePct: Number(r[5]) || 10,
                    issueDate: normalizeDate(r[6]),
                    maturityDate: normalizeDate(r[7]),
                    payoutDayOfMonth: Number(r[8]) || 10,
                    active:
                        String(r[9] ?? '')
                            .trim()
                            .toUpperCase() === 'TRUE',
                    notes: String(r[10] || '').trim(),
                }));

            sbnInvestments.value = parsedSbn;

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
                    db.sbnInvestments,
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
                        db.sbnInvestments.clear().then(() => db.sbnInvestments.bulkPut(parsedSbn)),
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
    // Helpers
    function getCollectedYieldForOwner(ownerName: PersonalOwner | 'Shared'): number {
        if (ownerName === 'Shared') {
            return sharedFinances.value
                .filter(
                    (s) =>
                        s.type === 'income' &&
                        /SR022|SR021|ORI|SBN|SUKUK/i.test(s.category + ' ' + s.notes)
                )
                .reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
        }

        return personalFinances.value
            .filter(
                (p) =>
                    p.owner === ownerName &&
                    p.type === 'income' &&
                    /SR022|SR021|ORI|SBN|SUKUK/i.test(p.category + ' ' + p.notes)
            )
            .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
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
        combinedMonthlyRevenue: personalDomain.combinedMonthlyRevenue,

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
        sbnAccountAllocation,

        goldAssets,
        totalGoldGrams,
        totalGoldCostBasis,
        estimatedGoldMarketValue,
        goldUnrealizedPnL,
        goldPnLPct,
        portfolioSummary,
        addGoldPurchase,
        updateGoldAsset,
        deleteGoldAsset,
        goldBrandAllocation,
        goldAccountAllocation,
        currentGoldPricePerGram,
        isFetchingGoldPrice,
        fetchLiveGoldPrice,
        setGoldPricePerGram,

        // Savings
        savingGoals,
        addSavingGoal,
        updateSavingGoal,
        deleteSavingGoal,
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
