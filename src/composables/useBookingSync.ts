import { useBookingStore } from '@/stores/useBookingStore';
import { useGoogleSheets } from '@/composables/useGoogleSheets';
import type { Booking } from '@/types/booking';
import { toast } from 'vue-toastflow';

interface ToastMessages {
    loadingTitle: string;
    loadingDesc?: string;
    successTitle: string;
    successDesc: string | ((result: unknown) => string);
    errorTitle: string;
}

export function useBookingSync() {
    const bookingStore = useBookingStore();
    const { appendSheetRow, updateSheetRowByBookingId, deleteSheetRowById } = useGoogleSheets();

    /**
     * Internal helper to execute async booking mutations with toast notifications.
     */
    async function runWithToast<T>(
        action: () => Promise<T>,
        messages: ToastMessages
    ): Promise<boolean> {
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
                    description: err instanceof Error ? err.message : 'Google Sheets sync failed.',
                }),
            });
            return true;
        } catch (err: unknown) {
            console.error(`${messages.errorTitle}:`, err);
            return false;
        }
    }
    async function saveBooking(
        payload: Omit<Booking, 'id' | 'createdAt'>,
        bookingToEdit?: Booking | null
    ): Promise<boolean> {
        const isEditing = Boolean(bookingToEdit);

        return runWithToast(
            async () => {
                if (bookingToEdit) {
                    await bookingStore.updateBookingWithRemoteSync(
                        { ...bookingToEdit, ...payload },
                        { updateSheetRowByBookingId }
                    );
                } else {
                    await bookingStore.addBookingWithRemoteSync(payload, { appendSheetRow });
                }
            },
            {
                loadingTitle: isEditing ? 'Updating booking...' : 'Saving booking...',
                loadingDesc: 'Syncing with Google Sheets and database.',
                successTitle: 'Success',
                successDesc: isEditing
                    ? 'Booking updated successfully.'
                    : 'Booking saved successfully.',
                errorTitle: 'Save failed',
            }
        );
    }
    async function updateBookingStatus(
        booking: Booking,
        newStatus: Booking['status']
    ): Promise<boolean> {
        return runWithToast(
            async () => {
                await bookingStore.updateBookingWithRemoteSync(
                    { ...booking, status: newStatus },
                    { updateSheetRowByBookingId }
                );
            },
            {
                loadingTitle: `Marking as ${newStatus}...`,
                loadingDesc: 'Syncing with Google Sheets and database.',
                successTitle: 'Status Updated',
                successDesc: `${booking.guestName} marked as ${newStatus}.`,
                errorTitle: 'Update failed',
            }
        );
    }
    function markBookingComplete(booking: Booking): Promise<boolean> {
        return updateBookingStatus(booking, 'Completed');
    }
    async function deleteBooking(booking: Booking): Promise<boolean> {
        const confirmed = window.confirm(
            `Are you sure you want to delete booking ${booking.bookingId} (${booking.guestName})? This will remove it from Google Sheets & Calendar first.`
        );

        if (!confirmed) return false;

        return runWithToast(
            async () => {
                await bookingStore.deleteBookingWithRemoteSync(booking, {
                    deleteSheetRowByBookingId: (spreadsheetId, bookingId, calendarId) =>
                        deleteSheetRowById(spreadsheetId, bookingId, { calendarId }),
                });
            },
            {
                loadingTitle: 'Deleting booking...',
                loadingDesc: `Deleting reservation ${booking.bookingId} from Google Sheets & Calendar...`,
                successTitle: 'Success',
                successDesc: `Booking ${booking.bookingId} deleted from Google Sheets & local database.`,
                errorTitle: 'Delete failed',
            }
        );
    }
    async function clearAllLocalBookings(): Promise<boolean> {
        const confirmed = window.confirm(
            'Are you sure you want to delete ALL local bookings? This cannot be undone.'
        );

        if (!confirmed) return false;

        return runWithToast(() => bookingStore.clearAllLocalBookings(), {
            loadingTitle: 'Clearing local data...',
            loadingDesc: 'Removing all local-only bookings.',
            successTitle: 'Cleared',
            successDesc: 'All local bookings have been deleted successfully.',
            errorTitle: 'Clear failed',
        });
    }

    return {
        saveBooking,
        updateBookingStatus,
        markBookingComplete,
        deleteBooking,
        clearAllLocalBookings,
    };
}
