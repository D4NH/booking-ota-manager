import { useFinanceStore } from '@/stores/useFinanceStore';
import type {
    PropertyFinance,
    PersonalFinance,
    SharedFinance,
    OwnerTransfer,
    ProjectedRecurringItem,
} from '@/types/finance';
import { toast } from 'vue-toastflow';

export function useFinanceSync() {
    const financeStore = useFinanceStore();

    const syncAllFinancialData = async (): Promise<boolean> => {
        try {
            await toast.loading(
                async () => {
                    await financeStore.fetchFinancialData();
                },
                {
                    loading: {
                        title: 'Syncing Financial System...',
                        description: 'Pulling latest ledgers, savings, and gold valuations.',
                    },
                    success: {
                        title: 'Synchronization Complete',
                        description: 'All ledgers and assets are currently up to date.',
                    },
                    error: (err: unknown) => ({
                        title: 'Sync Interrupted',
                        description:
                            err instanceof Error ? err.message : 'Google Sheets request failed.',
                    }),
                }
            );
            return true;
        } catch (err: unknown) {
            console.error('Sync failed:', err);
            return false;
        }
    };

    const addPersonalTransaction = async (
        payload: Omit<PersonalFinance, 'id'>
    ): Promise<boolean> => {
        const isSavings = payload.category === 'Savings';
        const isGold = payload.category === 'Gold';

        try {
            await toast.loading(
                async () => {
                    await financeStore.addPersonalTransaction(payload);
                },
                {
                    loading: {
                        title: isSavings
                            ? 'Allocating to Savings...'
                            : isGold
                              ? 'Recording Gold Purchase...'
                              : 'Saving Personal Record...',
                        description: isSavings
                            ? `Syncing ${payload.owner}'s transaction & updating savings balance.`
                            : isGold
                              ? `Syncing ${payload.owner}'s transaction & computing gold gram reserves.`
                              : `Logging ${payload.category} transaction for ${payload.owner}.`,
                    },
                    success: {
                        title: isSavings
                            ? 'Savings Updated'
                            : isGold
                              ? 'Gold Holding Added'
                              : 'Transaction Recorded',
                        description: isSavings
                            ? `Allocated to ${payload.savingsInstitution || 'BCA'} account.`
                            : isGold
                              ? `Allocated ${payload.goldWeightGrams ? payload.goldWeightGrams + 'g' : ''} to gold portfolio.`
                              : `Recorded ${payload.category} successfully.`,
                    },
                    error: (err: unknown) => ({
                        title: 'Transaction Failed',
                        description:
                            err instanceof Error
                                ? err.message
                                : 'Failed to write record to Google Sheets.',
                    }),
                }
            );
            return true;
        } catch (err: unknown) {
            console.error('Personal transaction failed:', err);
            return false;
        }
    };

    const addPropertyTransaction = async (
        payload: Omit<PropertyFinance, 'id'>
    ): Promise<boolean> => {
        try {
            await toast.loading(
                async () => {
                    await financeStore.addPropertyTransaction(payload);
                },
                {
                    loading: {
                        title: 'Recording Property Entry...',
                        description: 'Syncing ledger row with Google Sheets & local storage.',
                    },
                    success: {
                        title: 'Property Ledger Updated',
                        description: `Saved ${payload.category} transaction.`,
                    },
                    error: (err: unknown) => ({
                        title: 'Save Failed',
                        description:
                            err instanceof Error
                                ? err.message
                                : 'Failed to write to Google Sheets.',
                    }),
                }
            );
            return true;
        } catch (err: unknown) {
            console.error('Property entry failed:', err);
            return false;
        }
    };

    const addSharedTransaction = async (payload: Omit<SharedFinance, 'id'>): Promise<boolean> => {
        try {
            await toast.loading(
                async () => {
                    await financeStore.addSharedTransaction(payload);
                },
                {
                    loading: {
                        title: 'Recording Household Entry...',
                        description: 'Appending transaction to Shared Household ledger.',
                    },
                    success: {
                        title: 'Shared Ledger Updated',
                        description: `Logged household entry: ${payload.category}.`,
                    },
                    error: (err: unknown) => ({
                        title: 'Save Failed',
                        description:
                            err instanceof Error
                                ? err.message
                                : 'Failed to write to Google Sheets.',
                    }),
                }
            );
            return true;
        } catch (err: unknown) {
            console.error('Shared entry failed:', err);
            return false;
        }
    };

    const executeOwnerTransfer = async (payload: Omit<OwnerTransfer, 'id'>): Promise<boolean> => {
        try {
            await toast.loading(
                async () => {
                    await financeStore.recordOwnerTransfer(payload);
                },
                {
                    loading: {
                        title: 'Executing Transfer...',
                        description: 'Moving funds from property revenue into target ledger.',
                    },
                    success: {
                        title: 'Owner Transfer Completed',
                        description: `Successfully allocated funds to ${payload.targetAccount}.`,
                    },
                    error: (err: unknown) => ({
                        title: 'Transfer Failed',
                        description:
                            err instanceof Error ? err.message : 'Failed executing owner transfer.',
                    }),
                }
            );
            return true;
        } catch (err: unknown) {
            console.error('Transfer failed:', err);
            return false;
        }
    };

    const persistDexieBookings = async (): Promise<boolean> => {
        try {
            await toast.loading(
                async () => {
                    return await financeStore.persistDexieBookingsToRemoteSheet();
                },
                {
                    loading: {
                        title: 'Persisting Bookings...',
                        description: 'Pushing reservations into Property_Finances Google Sheet.',
                    },
                    success: (count: unknown) => ({
                        title: 'Bookings Synchronized',
                        description: `Pushed ${Number(count) || 0} reservation(s) to remote sheets.`,
                    }),
                    error: (err: unknown) => ({
                        title: 'Persistence Failed',
                        description:
                            err instanceof Error
                                ? err.message
                                : 'Could not write bookings to Sheets.',
                    }),
                }
            );
            return true;
        } catch (err: unknown) {
            console.error('Booking persistence failed:', err);
            return false;
        }
    };

    const editPersonalTransaction = async (
        id: string,
        payload: Omit<PersonalFinance, 'id'>
    ): Promise<boolean> => {
        try {
            await toast.loading(
                async () => {
                    await financeStore.updatePersonalTransaction(id, payload);
                },
                {
                    loading: {
                        title: 'Updating Record...',
                        description: `Syncing changes for ${payload.owner} to Google Sheets.`,
                    },
                    success: {
                        title: 'Record Updated',
                        description: `Successfully updated ${payload.category} transaction.`,
                    },
                    error: (err: unknown) => ({
                        title: 'Update Failed',
                        description:
                            err instanceof Error ? err.message : 'Google Sheets update failed.',
                    }),
                }
            );
            return true;
        } catch (err: unknown) {
            console.error('Update personal transaction failed:', err);
            return false;
        }
    };

    const editSharedTransaction = async (
        id: string,
        payload: Omit<SharedFinance, 'id'>
    ): Promise<boolean> => {
        try {
            await toast.loading(
                async () => {
                    await financeStore.updateSharedTransaction(id, payload);
                },
                {
                    loading: {
                        title: 'Updating Household Entry...',
                        description: 'Syncing changes to Shared Household ledger.',
                    },
                    success: {
                        title: 'Entry Updated',
                        description: `Successfully updated ${payload.category} entry.`,
                    },
                    error: (err: unknown) => ({
                        title: 'Update Failed',
                        description:
                            err instanceof Error ? err.message : 'Google Sheets update failed.',
                    }),
                }
            );
            return true;
        } catch (err: unknown) {
            console.error('Update shared transaction failed:', err);
            return false;
        }
    };

    const settleRecurringCommitment = async (item: ProjectedRecurringItem): Promise<boolean> => {
        try {
            await toast.loading(
                async () => {
                    await financeStore.settleRecurringItem(item);
                },
                {
                    loading: {
                        title: 'Posting Recurring Bill...',
                        description: `Logging ${item.category} to ${item.targetLedger} ledger.`,
                    },
                    success: {
                        title: 'Bill Posted',
                        description: `${item.category} recorded as settled for ${item.cycleMonth}.`,
                    },
                    error: (err: unknown) => ({
                        title: 'Failed to Post',
                        description:
                            err instanceof Error ? err.message : 'Google Sheets append failed.',
                    }),
                }
            );
            return true;
        } catch (err: unknown) {
            console.error('Settlement aborted:', err);
            return false;
        }
    };

    return {
        syncAllFinancialData,
        addPropertyTransaction,
        addPersonalTransaction,
        addSharedTransaction,
        executeOwnerTransfer,
        persistDexieBookings,
        editPersonalTransaction,
        editSharedTransaction,
        settleRecurringCommitment,
    };
}
