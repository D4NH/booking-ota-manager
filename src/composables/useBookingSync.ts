import { ref } from 'vue';
import { useBookingStore } from '@/stores/useBookingStore';
import { useGoogleSheets } from '@/composables/useGoogleSheets';
import type { Booking } from '@/types/booking';

export function useBookingSync() {
    const bookingStore = useBookingStore();
    const { appendSheetRow, updateSheetRowByBookingId, deleteSheetRowByBookingId } =
        useGoogleSheets();

    const syncStatus = ref<string>('');
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const setStatus = (message: string, durationMs = 5000): void => {
        if (timeoutId) clearTimeout(timeoutId);

        syncStatus.value = message;

        timeoutId = setTimeout(() => {
            syncStatus.value = '';
        }, durationMs);
    };

    const saveBooking = async (
        payload: Omit<Booking, 'id' | 'createdAt'>,
        bookingToEdit?: Booking | null
    ): Promise<boolean> => {
        try {
            if (bookingToEdit) {
                setStatus('Syncing edit to Google Sheets...');

                await bookingStore.updateBookingWithRemoteSync(
                    { ...bookingToEdit, ...payload },
                    { updateSheetRowByBookingId }
                );

                setStatus('Booking updated in Google Sheets & local database.');
            } else {
                setStatus('Syncing new booking to Google Sheets...');

                await bookingStore.addBookingWithRemoteSync(payload, { appendSheetRow });

                setStatus('Booking saved to Google Sheets & local database.');
            }
            return true;
        } catch (err: unknown) {
            console.error('Save aborted due to sync failure:', err);

            const msg = err instanceof Error ? err.message : 'Google Sheets sync failed.';

            setStatus(`Save failed: ${msg}`);
            return false;
        }
    };

    const deleteBooking = async (booking: Booking): Promise<boolean> => {
        const confirmed = window.confirm(
            `Are you sure you want to delete booking ${booking.bookingId} (${booking.guestName})? This will remove it from Google Sheets first.`
        );

        if (!confirmed) return false;

        try {
            setStatus(`Deleting reservation ${booking.bookingId} from Google Sheets...`);

            await bookingStore.deleteBookingWithRemoteSync(booking, { deleteSheetRowByBookingId });

            setStatus(`Booking ${booking.bookingId} deleted from Google Sheets & local database.`);
            return true;
        } catch (err: unknown) {
            console.error('Delete aborted due to sync failure:', err);

            const msg = err instanceof Error ? err.message : 'Google Sheets sync failed.';

            setStatus(`Delete failed: ${msg}`);
            return false;
        }
    };

    return {
        syncStatus,
        saveBooking,
        deleteBooking,
    };
}
