import { useBookingStore } from '@/stores/useBookingStore';
import { useGoogleSheets } from '@/composables/useGoogleSheets';
import type { Booking } from '@/types/booking';

import { toast } from 'vue-toastflow';

export function useBookingSync() {
    const bookingStore = useBookingStore();
    const { appendSheetRow, updateSheetRowByBookingId, deleteSheetRowByBookingId } =
        useGoogleSheets();

    const saveBooking = async (
        payload: Omit<Booking, 'id' | 'createdAt'>,
        bookingToEdit?: Booking | null
    ): Promise<boolean> => {
        try {
            await toast.loading(
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
                    loading: {
                        title: bookingToEdit ? 'Updating booking...' : 'Saving booking...',
                        description: 'Syncing with Google Sheets and database.',
                    },
                    success: {
                        title: 'Success',
                        description: bookingToEdit
                            ? 'Booking updated successfully.'
                            : 'Booking saved successfully.',
                    },
                    error: (err) => ({
                        title: 'Save failed',
                        description:
                            err instanceof Error ? err.message : 'Google Sheets sync failed.',
                    }),
                }
            );

            return true;
        } catch (err: unknown) {
            console.error('Save aborted due to sync failure:', err);
            return false;
        }
    };

    const updateBookingStatus = async (
        booking: Booking,
        newStatus: Booking['status']
    ): Promise<boolean> => {
        try {
            await toast.loading(
                async () => {
                    // Merge new status into existing booking and trigger remote sync
                    await bookingStore.updateBookingWithRemoteSync(
                        { ...booking, status: newStatus },
                        { updateSheetRowByBookingId }
                    );
                },
                {
                    loading: {
                        title: `Marking as ${newStatus}...`,
                        description: 'Syncing with Google Sheets and database.',
                    },
                    success: {
                        title: 'Status Updated',
                        description: `${booking.guestName} marked as ${newStatus}.`,
                    },
                    error: (err) => ({
                        title: 'Update failed',
                        description:
                            err instanceof Error ? err.message : 'Google Sheets sync failed.',
                    }),
                }
            );

            return true;
        } catch (err: unknown) {
            console.error('Status update failed due to sync error:', err);
            return false;
        }
    };

    const markBookingComplete = async (booking: Booking): Promise<boolean> => {
        return updateBookingStatus(booking, 'Completed');
    };

    const deleteBooking = async (booking: Booking): Promise<boolean> => {
        const confirmed = window.confirm(
            `Are you sure you want to delete booking ${booking.bookingId} (${booking.guestName})? This will remove it from Google Sheets first.`
        );

        if (!confirmed) return false;

        try {
            await toast.loading(
                async () => {
                    await bookingStore.deleteBookingWithRemoteSync(booking, {
                        deleteSheetRowByBookingId,
                    });
                },
                {
                    loading: {
                        title: 'Deleting booking...',
                        description: `Deleting reservation ${booking.bookingId} from Google Sheets...`,
                    },
                    success: {
                        title: 'Success',
                        description: `Booking ${booking.bookingId} deleted from Google Sheets & local database.`,
                    },
                    error: (err) => ({
                        title: 'Save failed',
                        description:
                            err instanceof Error ? err.message : 'Google Sheets sync failed.',
                    }),
                }
            );

            return true;
        } catch (err: unknown) {
            console.error('Delete aborted due to sync failure:', err);
            return false;
        }
    };

    const clearAllLocalBookings = async (): Promise<void> => {
        const confirmed = window.confirm(
            'Are you sure you want to delete ALL local bookings? This cannot be undone.'
        );

        if (!confirmed) return;

        try {
            await toast.loading(
                async () => {
                    await bookingStore.clearAllLocalBookings();
                },
                {
                    loading: {
                        title: 'Clearing local data...',
                        description: 'Removing all local-only bookings.',
                    },
                    success: {
                        title: 'Cleared',
                        description: 'All local bookings have been deleted successfully.',
                    },
                    error: (err) => ({
                        title: 'Request failed',
                        description:
                            err instanceof Error ? err.message : 'Something went horrible wrong.',
                    }),
                }
            );
        } catch (err: unknown) {
            console.error('Delete aborted due to sync failure:', err);
        }
    };

    return {
        saveBooking,
        updateBookingStatus,
        markBookingComplete,
        deleteBooking,
        clearAllLocalBookings,
    };
}
