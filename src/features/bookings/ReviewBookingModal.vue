<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useGoogleSheets } from '@/composables/useGoogleSheets';
import { useBookingStore } from '@/stores/useBookingStore';
import { useBookingSync } from '@/composables/useBookingSync';
import { useStagingStore } from '@/stores/useStagingStore';
import { PROPERTY_LIST, PROPERTY_CONFIGS } from '@/config/properties';
import type { BookingChannel, StagedBooking } from '@/types/booking';
import type { PropertyId } from '@/types/property';
import { calculateNights } from '@/utils/date';
import { toast } from 'vue-toastflow';

interface Props {
    modelValue?: boolean;
    booking?: StagedBooking | null;
    stagingSpreadsheetId: string;
}

const { modelValue = false, booking = null, stagingSpreadsheetId } = defineProps<Props>();

const emit = defineEmits<{
    'update:modelValue': [val: boolean];
    approved: [bookingId: string];
    rejected: [bookingId: string];
}>();

const bookingStore = useBookingStore();
const stagingStore = useStagingStore();
const { saveBooking } = useBookingSync();
const { deleteSheetRowById, updateCalendarEventSummary } = useGoogleSheets();

const isProcessing = ref(false);

const formPropertyId = ref<PropertyId>('piyungan');
const formBookingId = ref('');
const formListing = ref<BookingChannel>('Airbnb');
const formGuestName = ref('');
const formCheckIn = ref('');
const formCheckOut = ref('');
const formPayout = ref<number | null>(null);
const formNotes = ref('');

const listingChannels: BookingChannel[] = [
    'Airbnb',
    'Booking.com',
    'Tiket.com',
    'Trip.com',
    'Whatsapp',
];

const computedNights = computed(() => {
    if (!formCheckIn.value || !formCheckOut.value) return 1;
    return calculateNights(formCheckIn.value, formCheckOut.value);
});
const formHasConflict = computed(() => {
    if (!formPropertyId.value || !formCheckIn.value || !formCheckOut.value) return false;
    return Boolean(
        bookingStore.hasDateConflict(
            formPropertyId.value,
            formCheckIn.value,
            formCheckOut.value,
            formBookingId.value
        )
    );
});

const closeModal = (): void => {
    emit('update:modelValue', false);
};
const handleApprove = async (): Promise<void> => {
    if (isProcessing.value || !booking) return;

    if (!formCheckIn.value || !formCheckOut.value || !formGuestName.value) {
        alert('Please fill out required dates and guest details.');
        return;
    }

    isProcessing.value = true;
    const targetItem = booking;
    const targetCalendarId = PROPERTY_CONFIGS[formPropertyId.value]?.calendarId;

    try {
        await toast.loading(
            async () => {
                // Commit confirmed reservation to active Property sheet & mirror to DexieDB
                await saveBooking({
                    propertyId: formPropertyId.value,
                    bookingId: formBookingId.value.trim() || targetItem.bookingId,
                    listing: formListing.value,
                    guestName: formGuestName.value.trim(),
                    checkIn: formCheckIn.value,
                    checkOut: formCheckOut.value,
                    nights: computedNights.value,
                    payout: Number(formPayout.value) || 0,
                    status: 'Booked',
                    notes: formNotes.value.trim(),
                });

                // Remove [PENDING] from Calendar Event
                if (targetItem.calendarEventId && targetCalendarId) {
                    await updateCalendarEventSummary(
                        targetCalendarId,
                        targetItem.calendarEventId,
                        `${formListing.value} - ${formGuestName.value.trim()}`,
                        { checkIn: formCheckIn.value, checkOut: formCheckOut.value },
                        `Confirmed reservation for ${formGuestName.value.trim()} via ${formListing.value}. Ref: ${formBookingId.value}`
                    ).catch((e) => console.warn('Direct Calendar PATCH skipped:', e));
                }

                // Remove row from Staging sheet
                await deleteSheetRowById(stagingSpreadsheetId, targetItem.id, {
                    sheetName: 'Sheet1',
                });

                // Remove from staging store & notification queue
                await stagingStore.removeStagedBookingLocally(targetItem.id);
                emit('approved', targetItem.bookingId);
                closeModal();
            },
            {
                loading: {
                    title: 'Approving Reservation...',
                    description: `Committing ${formGuestName.value} to Google Sheets and confirming calendar block.`,
                },
                success: {
                    title: 'Booking Approved',
                    description: `${formGuestName.value} (${formListing.value}) confirmed successfully.`,
                },
                error: (err: unknown) => ({
                    title: 'Approval Failed',
                    description: err instanceof Error ? err.message : 'Operation failed.',
                }),
            }
        );
    } catch (e) {
        console.error('Approval failed:', e);
    } finally {
        setTimeout(() => {
            isProcessing.value = false;
        }, 500);
    }
};
const handleReject = async (): Promise<void> => {
    if (!booking) return;

    const confirmed = window.confirm(
        `Reject incoming booking ${booking.bookingId} (${booking.guestName})? This will delete the staging row and remove the calendar block.`
    );
    if (!confirmed) return;

    const targetItem = booking;
    const targetCalendarId = PROPERTY_CONFIGS[targetItem.propertyId]?.calendarId;

    try {
        await toast.loading(
            async () => {
                // Delete row from Staging sheet and remove Google Calendar event
                await deleteSheetRowById(stagingSpreadsheetId, targetItem.id, {
                    sheetName: 'Sheet1',
                    calendarId: targetCalendarId,
                });

                // Remove from local staging store
                await stagingStore.removeStagedBookingLocally(targetItem.id);
                emit('rejected', targetItem.bookingId);
                closeModal();
            },
            {
                loading: {
                    title: 'Rejecting Booking...',
                    description: 'Removing from staging queue and clearing calendar block.',
                },
                success: {
                    title: 'Booking Dismissed',
                    description: `${targetItem.bookingId} rejected and removed.`,
                },
                error: (err: unknown) => ({
                    title: 'Rejection Failed',
                    description: err instanceof Error ? err.message : 'Delete failed.',
                }),
            }
        );
    } catch (e) {
        console.error('Rejection failed:', e);
    }
};

watch(
    () => booking,
    (item) => {
        if (item) {
            formPropertyId.value = item.propertyId || 'piyungan';
            formBookingId.value = item.bookingId || '';
            formListing.value = item.listing || 'Airbnb';
            formGuestName.value = item.guestName || '';
            formCheckIn.value = item.checkIn || '';
            formCheckOut.value = item.checkOut || '';
            formPayout.value = item.payout || 0;
            formNotes.value = item.notes || '';
        }
    },
    { immediate: true }
);
</script>

<template>
    <div
        v-if="modelValue && booking"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
        <div
            class="w-full max-w-2xl rounded-md border border-mist-800 bg-mist-900 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 space-y-4 p-4">
            <!-- Modal Header -->
            <div
                class="flex items-center justify-between border-b border-mist-800 -mt-4 -mr-4 -ml-4 p-4 bg-mist-950/60">
                <div>
                    <h2 class="text-base font-semibold text-mist-100">
                        <span>Review & Approve Reservation</span>
                        <span
                            v-if="formHasConflict"
                            class="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-1.5 py-0.5 rounded font-mono font-bold">
                            Conflict
                        </span>
                    </h2>
                    <p class="text-xs text-mist-400 mt-0.5">
                        Verify dates, payout, and commit directly to active property records.
                    </p>
                </div>
                <button
                    type="button"
                    class="cursor-pointer text-mist-400 hover:text-mist-200"
                    @click="closeModal">
                    <fa-icon icon="xmark" />
                </button>
            </div>
            <!-- Review & Edit Form -->
            <form
                class="max-h-[80vh] overflow-y-auto space-y-4"
                @submit.prevent="handleApprove">
                <!-- Target Property & Channel -->
                <div class="grid grid-cols-2 items-center gap-3">
                    <div class="relative">
                        <label
                            for="property"
                            class="block text-xs font-medium text-mist-400">
                            Source Entity
                        </label>
                        <div
                            class="pointer-events-none absolute inset-y-0 top-5 left-3 flex items-center text-mist-500">
                            <fa-icon
                                class="text-xs"
                                icon="house" />
                        </div>
                        <select
                            id="property"
                            v-model="formPropertyId"
                            name="property"
                            required
                            class="w-full appearance-none rounded-md border border-mist-800 bg-mist-950/50 mt-1 pl-9 pr-3 py-2 text-sm text-mist-200 focus:border-lime-500 focus:outline-none transition-colors cursor-pointer">
                            <option
                                value=""
                                disabled>
                                Select property
                            </option>
                            <option
                                v-for="p in PROPERTY_LIST"
                                :key="p.id"
                                :value="p.id">
                                {{ p.name }}
                            </option>
                        </select>
                        <div
                            class="pointer-events-none absolute inset-y-0 top-5 right-2 flex items-center text-mist-400">
                            <fa-icon
                                class="text-xs"
                                icon="angle-down" />
                        </div>
                    </div>
                    <div class="relative">
                        <label
                            for="property"
                            class="block text-xs font-medium text-mist-400">
                            Listing
                        </label>
                        <select
                            id="property"
                            v-model="formListing"
                            name="property"
                            required
                            class="w-full appearance-none rounded-md border border-mist-800 bg-mist-950/50 mt-1 px-3 py-2 text-sm text-mist-200 focus:border-lime-500 focus:outline-none transition-colors cursor-pointer">
                            <option
                                v-for="ch in listingChannels"
                                :key="ch"
                                :value="ch">
                                {{ ch }}
                            </option>
                        </select>
                        <div
                            class="pointer-events-none absolute inset-y-0 top-5 right-2 flex items-center text-mist-400">
                            <fa-icon
                                class="text-xs"
                                icon="angle-down" />
                        </div>
                    </div>
                </div>
                <!-- Guest Name & Reservation Reference -->
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-xs font-semibold text-mist-400 block">
                            Guest Name
                        </label>
                        <input
                            v-model="formGuestName"
                            type="text"
                            required
                            class="w-full appearance-none rounded-md border border-mist-800 bg-mist-950/50 mt-1 py-2 px-3 text-sm text-mist-200 focus:border-lime-500 focus:outline-none transition-colors" />
                    </div>
                    <div>
                        <label class="text-xs font-semibold text-mist-400 block">
                            Reservation Reference
                        </label>
                        <input
                            v-model="formBookingId"
                            type="text"
                            required
                            class="w-full appearance-none rounded-md border border-mist-800 bg-mist-950/50 mt-1 py-2 px-3 text-sm text-mist-200 focus:border-lime-500 focus:outline-none transition-colors" />
                    </div>
                </div>
                <!-- Check-in & Check-out -->
                <div class="grid grid-cols-2 gap-3">
                    <div class="relative">
                        <label class="block text-xs font-medium text-mist-400">Check-in Date</label>
                        <input
                            v-model="formCheckIn"
                            type="date"
                            class="w-full appearance-none rounded-md border border-mist-800 bg-mist-950/50 mt-1 py-2 px-3 text-sm text-mist-200 focus:border-lime-500 focus:outline-none transition-colors"
                            required />
                        <div
                            class="pointer-events-none absolute inset-y-0 top-5 right-2 flex items-center text-mist-500">
                            <fa-icon
                                class="text-sm"
                                icon="calendar-days" />
                        </div>
                    </div>
                    <div class="relative">
                        <label class="block text-xs font-medium text-mist-400">
                            Check-out Date ({{ computedNights }} Nights)
                        </label>
                        <input
                            v-model="formCheckOut"
                            type="date"
                            class="w-full appearance-none rounded-md border border-mist-800 bg-mist-950/50 mt-1 py-2 px-3 text-sm text-mist-200 focus:border-lime-500 focus:outline-none transition-colors"
                            required />
                        <div
                            class="pointer-events-none absolute inset-y-0 top-5 right-2 flex items-center text-mist-500">
                            <fa-icon
                                class="text-sm"
                                icon="calendar-days" />
                        </div>
                    </div>
                </div>
                <!-- Host Net Payout -->
                <div class="relative">
                    <label class="text-xs font-semibold text-mist-400 block">
                        Net Host Payout (IDR)
                    </label>
                    <div
                        class="absolute inset-y-0 top-1 left-3 flex items-center pointer-events-none text-mist-500">
                        <fa-icon
                            icon="rupiah-sign"
                            class="text-xs" />
                    </div>
                    <input
                        :value="formPayout"
                        type="number"
                        placeholder="1000000"
                        class="w-full rounded-md bg-mist-950/50 border border-mist-800 mt-1 pl-8 pr-4 py-2 text-sm text-mist-200 placeholder-mist-600 focus:border-lime-500 focus:outline-none transition-colors"
                        required />
                    <p class="text-[10px] text-mist-500 mt-1">
                        Parsed from email. Verify with voucher or OTA extranet if masked.
                    </p>
                </div>
                <!-- Notes -->
                <div>
                    <label class="text-xs font-semibold text-mist-400 block">Notes</label>
                    <input
                        v-model="formNotes"
                        type="text"
                        placeholder="e.g. Early check-in requested / Special breakfast request"
                        class="w-full appearance-none rounded-md border border-mist-800 bg-mist-950/50 mt-1 py-2 px-3 text-sm text-mist-200 focus:border-lime-500 focus:outline-none transition-colors" />
                </div>
                <!-- Overlap Conflict Alert -->
                <div
                    v-if="formHasConflict"
                    class="rounded-md border border-rose-500/30 bg-rose-950/20 p-2.5 text-xs text-rose-300">
                    <strong>Warning:</strong> Selected dates overlap with an existing confirmed
                    reservation in local records.
                </div>
                <!-- Actions -->
                <div class="flex justify-between items-center pt-3 border-t border-mist-800">
                    <button
                        type="button"
                        class="text-xs text-rose-400 hover:text-rose-300 transition cursor-pointer"
                        @click="handleReject">
                        Reject
                    </button>

                    <div class="flex items-center gap-2">
                        <button
                            type="button"
                            class="text-xs px-3 py-2 text-mist-400 hover:text-mist-200 cursor-pointer"
                            @click="closeModal">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            :disabled="isProcessing"
                            class="bg-lime-400 hover:bg-lime-300 disabled:opacity-50 text-mist-950 text-xs px-4 py-2 rounded-md font-bold transition flex items-center gap-1.5 cursor-pointer">
                            <span
                                v-if="isProcessing"
                                class="w-3 h-3 border-2 border-mist-950 border-t-transparent rounded-full animate-spin" />
                            <span>Approve</span>
                        </button>
                    </div>
                </div>
            </form>
        </div>
    </div>
</template>
