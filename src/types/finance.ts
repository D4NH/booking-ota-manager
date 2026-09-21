export type PropertyFinanceType = 'income' | 'expense';
export type PropertyCategory =
    | 'Payout'
    | 'Cleaning'
    | 'Maintenance'
    | 'Electricity'
    | 'Internet'
    | 'Owner Payout Outflow'
    | 'Other'
    | string;

export interface PropertyFinance {
    id: string;
    propertyId: string;
    bookingId?: string;
    type: PropertyFinanceType;
    category: PropertyCategory;
    amount: number;
    date: string;
    notes: string;
}

export type PersonalOwner = 'Danh Nguyen' | 'Citra Ayu Wardani';
export type TransactionType = 'income' | 'fixed_cost' | 'expense';

export type PersonalCategory =
    'Creditcard' | 'Gold' | 'Other' | 'Payout' | 'Savings' | 'Subscriptions' | string;

export interface PersonalFinance {
    id: string;
    owner: PersonalOwner;
    type: TransactionType;
    category: PersonalCategory;
    amount: number;
    date: string;
    notes: string;
    savingsInstitution?: string;
    goldWeightGrams?: number;
}

export interface PersonalSavings {
    id: string;
    owner: PersonalOwner | 'Shared';
    institution: string;
    accountNumber?: string;
    balance: number;
    updatedAt: string;
    notes?: string;
}

export interface AggregatedSavingsAccount {
    key: string;
    owner: PersonalFinance['owner'];
    institution: string;
    balance: number;
    lastUpdated: string;
    transactionCount: number;
}

export type SharedCategory =
    | 'BPJS'
    | 'Creditcard'
    | 'Electricity'
    | 'House'
    | 'Internet'
    | 'Investments'
    | 'Kirana'
    | 'Mai House Jogja Share'
    | 'Other'
    | 'Subscriptions'
    | string;

export interface SharedFinance {
    id: string;
    type: TransactionType;
    category: SharedCategory;
    amount: number;
    date: string;
    notes: string;
    savingsInstitution?: string;
    goldWeightGrams?: number;
}

export type TransferTargetAccount = 'Danh Nguyen' | 'Citra Ayu Wardani' | 'Shared' | 'Split';
export interface OwnerTransfer {
    id: string;
    sourcePropertyId: string;
    targetAccount: TransferTargetAccount;
    amount: number;
    date: string;
    notes: string;
}

export interface Property {
    id: string;
    name: string;
    address: string;
}

export interface MonthlyBudgetSummary {
    month: string;
    propertyRevenue: number;
    propertyExpenses: number;
    propertyNetProfit: number;
    danhIncome: number;
    danhFixedCosts: number;
    danhExpenses: number;
    danhNetBalance: number;
    citraIncome: number;
    citraFixedCosts: number;
    citraExpenses: number;
    citraNetBalance: number;
    sharedIncome: number;
    sharedFixedCosts: number;
    sharedExpenses: number;
    sharedNetBalance: number;
    totalOwnerDraws: number;
}

export type GoldType = 'Antam' | 'UBS' | 'Digital Pegadaian' | 'Pluang';

export interface GoldAsset {
    id: string;
    owner: PersonalOwner | 'Shared';
    type: GoldType;
    weightGrams: number;
    buyPriceTotal: number;
    purchaseDate: string;
    certificateNumber?: string;
    notes?: string;
}

export type RecurrenceFrequency = 'monthly' | 'yearly';
export type RecurrenceTargetLedger = 'Property' | 'Personal' | 'Shared';

export interface RecurringTemplate {
    id: string;
    targetLedger: RecurrenceTargetLedger;
    owner?: PersonalOwner;
    propertyId?: string;
    type: TransactionType;
    category: string;
    amount: number;
    dueDayOfMonth: number;
    frequency: RecurrenceFrequency;
    active: boolean;
    notes?: string;
}

export interface ProjectedRecurringItem extends RecurringTemplate {
    cycleMonth: string;
    dueDate: string;
    isSettled: boolean;
    matchedTransactionId?: string;
}

export type SbnSeries = 'SR022-T3' | 'SR022-T5' | 'SR021' | 'ORI026';

export interface SbnInvestment {
    id: string;
    series: SbnSeries;
    owner: PersonalOwner | 'Shared';
    principalAmount: number;
    couponRatePct: number; // e.g. 6.45
    taxRatePct: number; // e.g. 10
    issueDate: string; // "2025-06-25"
    maturityDate: string; // "2028-06-10"
    payoutDayOfMonth: number; // 10
    active: boolean;
    notes?: string;
}

export interface InvestmentPortfolioSummary {
    sbnTotalPrincipal: number;
    sbnMonthlyGrossYield: number;
    sbnMonthlyNetYield: number;
    sbnTotalCollectedYield: number;
    goldTotalGrams: number;
    goldTotalCostBasis: number;
    goldCurrentValuation: number;
    goldUnrealizedPnL: number;
    goldPnLPct: number;
    totalPortfolioValue: number;
}

export interface SavingGoal {
    id: string;
    name: string;
    owner: PersonalOwner | 'Shared';
    targetAmount: number;
    priority?: number; // Optional priority ordering (1, 2, 3...)
    deadline?: string; // "YYYY-MM-DD"
    notes?: string;
}

export interface ComputedSavingGoal extends SavingGoal {
    allocatedAmount: number; // Dynamically allocated from savings pool
    progressPct: number; // 0 - 100% (Strictly capped)
    isCompleted: boolean; // true when allocatedAmount >= targetAmount
    remainingAmount: number; // targetAmount - allocatedAmount
}
