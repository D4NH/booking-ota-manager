import { useFinanceStore } from '@/stores/useFinanceStore';
import type {
    PropertyFinance,
    PersonalFinance,
    SharedFinance,
    OwnerTransfer,
    ProjectedRecurringItem,
} from '@/types/finance';
import { toast } from 'vue-toastflow';

interface ToastMessages {
    loadingTitle: string;
    loadingDesc?: string;
    successTitle: string;
    successDesc: string | ((result: unknown) => string);
    errorTitle: string;
}

export function useFinanceSync() {
    const financeStore = useFinanceStore();

    /**
     * Internal DRY helper to execute async store actions with toast lifecycle.
     */
    const runWithToast = async <T>(
        action: () => Promise<T>,
        messages: ToastMessages
    ): Promise<boolean> => {
        try {
            await toast.loading(action, {
                loading: {
                    title: messages.loadingTitle,
                    description: messages.loadingDesc,
                },
                success: (result: T) => ({
                    title: messages.successTitle,
                    description:
                        typeof messages.successDesc === 'function'
                            ? messages.successDesc(result)
                            : messages.successDesc,
                }),
                error: (err: unknown) => ({
                    title: messages.errorTitle,
                    description: err instanceof Error ? err.message : 'Operation failed.',
                }),
            });
            return true;
        } catch (err: unknown) {
            console.error(`${messages.errorTitle}:`, err);
            return false;
        }
    };

    /**
     * Synchronizes finance data.
     * Pass `{ silent: true }` in onMounted to prevent popup toasts during page navigation.
     */
    const syncAllFinancialData = async (options: { silent?: boolean } = {}): Promise<boolean> => {
        if (options.silent) {
            try {
                await financeStore.fetchFinancialData();
                return true;
            } catch (err: unknown) {
                console.error('Silent finance sync failed:', err);
                return false;
            }
        }

        return runWithToast(
            async () => {
                await financeStore.fetchFinancialData();
            },
            {
                loadingTitle: 'Syncing Financial System...',
                loadingDesc: 'Pulling latest ledgers, savings, and gold valuations.',
                successTitle: 'Synchronization Complete',
                successDesc: 'All ledgers and assets are currently up to date.',
                errorTitle: 'Sync Interrupted',
            }
        );
    };

    const addPropertyTransaction = (payload: Omit<PropertyFinance, 'id'>): Promise<boolean> =>
        runWithToast(() => financeStore.addPropertyTransaction(payload), {
            loadingTitle: 'Recording Property Entry...',
            loadingDesc: 'Syncing ledger row with Google Sheets & local storage.',
            successTitle: 'Property Ledger Updated',
            successDesc: `Saved ${payload.category} transaction.`,
            errorTitle: 'Save Failed',
        });
    const editPropertyTransaction = (
        id: string,
        payload: Omit<PropertyFinance, 'id'>
    ): Promise<boolean> =>
        runWithToast(() => financeStore.updatePropertyTransaction(id, payload), {
            loadingTitle: 'Updating Property Entry...',
            loadingDesc: 'Syncing ledger changes to Google Sheets & Dexie.',
            successTitle: 'Property Ledger Updated',
            successDesc: `Saved changes to ${payload.category}.`,
            errorTitle: 'Update Failed',
        });
    const removePropertyTransaction = async (id: string, category: string): Promise<boolean> => {
        const confirmed = window.confirm(`Are you sure you want to delete this ${category} entry?`);
        if (!confirmed) return false;

        return runWithToast(() => financeStore.deletePropertyTransaction(id), {
            loadingTitle: 'Deleting Record...',
            loadingDesc: 'Removing entry from Google Sheets & Dexie.',
            successTitle: 'Record Deleted',
            successDesc: `Successfully deleted ${category} record.`,
            errorTitle: 'Delete Failed',
        });
    };

    const persistDexieBookings = (): Promise<boolean> =>
        runWithToast(() => financeStore.persistDexieBookingsToRemoteSheet(), {
            loadingTitle: 'Persisting Bookings...',
            loadingDesc: 'Pushing reservations into Property_Finances Google Sheet.',
            successTitle: 'Bookings Synchronized',
            successDesc: (count: unknown) =>
                `Pushed ${Number(count) || 0} reservation(s) to remote sheets.`,
            errorTitle: 'Persistence Failed',
        });

    const addPersonalTransaction = (payload: Omit<PersonalFinance, 'id'>): Promise<boolean> => {
        const isSavings = payload.category === 'Savings';
        const isGold = payload.category === 'Gold';

        return runWithToast(() => financeStore.addPersonalTransaction(payload), {
            loadingTitle: isSavings
                ? 'Allocating to Savings...'
                : isGold
                  ? 'Recording Gold Purchase...'
                  : 'Saving Personal Record...',
            loadingDesc: isSavings
                ? `Updating ${payload.owner}'s liquid savings reserve.`
                : `Logging ${payload.category} transaction for ${payload.owner}.`,
            successTitle: isSavings
                ? 'Savings Updated'
                : isGold
                  ? 'Gold Holding Added'
                  : 'Transaction Recorded',
            successDesc: isSavings
                ? `Allocated to ${payload.savingsInstitution || 'BCA'} account.`
                : isGold
                  ? `Allocated ${payload.goldWeightGrams ? payload.goldWeightGrams + 'g' : ''} to gold portfolio.`
                  : `Recorded ${payload.category} successfully.`,
            errorTitle: 'Transaction Failed',
        });
    };
    const editPersonalTransaction = (
        id: string,
        payload: Omit<PersonalFinance, 'id'>
    ): Promise<boolean> =>
        runWithToast(() => financeStore.updatePersonalTransaction(id, payload), {
            loadingTitle: 'Updating Record...',
            loadingDesc: `Syncing changes for ${payload.owner} to Google Sheets.`,
            successTitle: 'Record Updated',
            successDesc: `Successfully updated ${payload.category} transaction.`,
            errorTitle: 'Update Failed',
        });
    const removePersonalTransaction = async (id: string, category: string): Promise<boolean> => {
        const confirmed = window.confirm(`Are you sure you want to delete this ${category} entry?`);
        if (!confirmed) return false;

        return runWithToast(() => financeStore.deletePersonalTransaction(id), {
            loadingTitle: 'Deleting Record...',
            loadingDesc: 'Removing entry from Google Sheets & Dexie.',
            successTitle: 'Record Deleted',
            successDesc: `Successfully deleted ${category} transaction.`,
            errorTitle: 'Delete Failed',
        });
    };

    const addSharedTransaction = (payload: Omit<SharedFinance, 'id'>): Promise<boolean> =>
        runWithToast(() => financeStore.addSharedTransaction(payload), {
            loadingTitle: 'Recording Household Entry...',
            loadingDesc: 'Appending transaction to Shared Household ledger.',
            successTitle: 'Shared Ledger Updated',
            successDesc: `Logged household entry: ${payload.category}.`,
            errorTitle: 'Save Failed',
        });
    const editSharedTransaction = (
        id: string,
        payload: Omit<SharedFinance, 'id'>
    ): Promise<boolean> =>
        runWithToast(() => financeStore.updateSharedTransaction(id, payload), {
            loadingTitle: 'Updating Household Entry...',
            loadingDesc: 'Syncing changes to Shared Household ledger.',
            successTitle: 'Entry Updated',
            successDesc: `Successfully updated ${payload.category} entry.`,
            errorTitle: 'Update Failed',
        });
    const removeSharedTransaction = async (id: string, category: string): Promise<boolean> => {
        const confirmed = window.confirm(
            `Are you sure you want to delete this ${category} shared entry?`
        );
        if (!confirmed) return false;

        return runWithToast(() => financeStore.deleteSharedTransaction(id), {
            loadingTitle: 'Deleting Shared Record...',
            loadingDesc: 'Removing entry from Google Sheets & Dexie.',
            successTitle: 'Record Deleted',
            successDesc: `Successfully deleted ${category} entry.`,
            errorTitle: 'Delete Failed',
        });
    };

    const executeOwnerTransfer = (payload: Omit<OwnerTransfer, 'id'>): Promise<boolean> =>
        runWithToast(() => financeStore.recordOwnerTransfer(payload), {
            loadingTitle: 'Executing Transfer...',
            loadingDesc: 'Moving funds from property revenue into target ledger.',
            successTitle: 'Owner Transfer Completed',
            successDesc: `Successfully allocated funds to ${payload.targetAccount}.`,
            errorTitle: 'Transfer Failed',
        });
    const settleRecurringCommitment = (item: ProjectedRecurringItem): Promise<boolean> =>
        runWithToast(() => financeStore.settleRecurringItem(item), {
            loadingTitle: 'Posting Recurring Bill...',
            loadingDesc: `Logging ${item.category} to ${item.targetLedger} ledger.`,
            successTitle: 'Bill Posted',
            successDesc: `${item.category} recorded as settled for ${item.cycleMonth}.`,
            errorTitle: 'Failed to Post',
        });

    return {
        syncAllFinancialData,
        addPropertyTransaction,
        editPropertyTransaction,
        removePropertyTransaction,
        persistDexieBookings,
        addPersonalTransaction,
        editPersonalTransaction,
        removePersonalTransaction,
        addSharedTransaction,
        editSharedTransaction,
        removeSharedTransaction,
        executeOwnerTransfer,
        settleRecurringCommitment,
    };
}
