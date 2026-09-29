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
import { calculateOwnerPayout } from '@/utils/financeCalculators';
import { formatIDR } from '@/utils/money';
import { toast } from 'vue-toastflow';

import DatePicker from '@/components/ui/DatePicker.vue';
import SelectDropdown from '@/components/ui/SelectDropdown.vue';
import TextInput from '@/components/ui/TextInput.vue';

const listingOptions = [
    { label: 'Airbnb', value: 'Airbnb' },
    { label: 'Booking.com', value: 'Booking.com' },
    { label: 'Tiket.com', value: 'Tiket.com' },
    { label: 'Trip.com', value: 'Trip.com' },
    { label: 'Unavailable', value: 'Unavailable' },
    { label: 'Whatsapp', value: 'Whatsapp' },
];

const propertyOptions = PROPERTY_LIST.map((property) => ({
    label: property.name,
    value: property.id,
}));

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
const { deleteSheetRowById } = useGoogleSheets();

const isProcessing = ref(false);

const form = ref({
    propertyId: 'piyungan' as PropertyId,
    bookingId: '',
    guestName: '',
    checkIn: '',
    checkOut: '',
    nights: 1,
    payout: '' as number | '',
    listing: 'Airbnb' as BookingChannel,
    notes: '',
});

const ownerPayoutDisplay = computed<number>((): number => calculateOwnerPayout(form.value.payout));
const stayDates = computed<[string, string]>({
    get: (): [string, string] => [form.value.checkIn, form.value.checkOut],
    set: ([start, end]: [string, string]) => {
        form.value.checkIn = start || '';
        form.value.checkOut = end || '';
        if (start && end) {
            form.value.nights = calculateNights(start, end);
        }
    },
});
const formHasConflict = computed(() => {
    if (!form.value.propertyId || !form.value.checkIn || !form.value.checkOut) return false;
    return Boolean(
        bookingStore.hasDateConflict(
            form.value.propertyId,
            form.value.checkIn,
            form.value.checkOut,
            form.value.bookingId
        )
    );
});

watch(
    () => booking,
    (item) => {
        if (item) {
            form.value = {
                propertyId: item.propertyId || 'piyungan',
                bookingId: item.bookingId || '',
                listing: item.listing || 'Airbnb',
                guestName: item.guestName || '',
                checkIn: item.checkIn || '',
                checkOut: item.checkOut || '',
                nights:
                    item.nights ||
                    (item.checkIn && item.checkOut
                        ? calculateNights(item.checkIn, item.checkOut)
                        : 1),
                payout: item.payout || '',
                notes: item.notes || '',
            };
        }
    },
    { immediate: true }
);

function closeModal(): void {
    emit('update:modelValue', false);
}
async function handleApprove(): Promise<void> {
    if (isProcessing.value || !booking) return;

    if (!form.value.checkIn || !form.value.checkOut || !form.value.guestName) {
        alert('Please fill out required dates and guest details.');
        return;
    }

    isProcessing.value = true;
    const targetItem = booking;

    try {
        await toast.loading(
            async () => {
                await saveBooking(
                    {
                        propertyId: form.value.propertyId,
                        bookingId: form.value.bookingId.trim() || targetItem.bookingId,
                        listing: form.value.listing,
                        guestName: form.value.guestName.trim(),
                        checkIn: form.value.checkIn,
                        checkOut: form.value.checkOut,
                        nights: Number(form.value.nights) || 1,
                        payout: Number(form.value.payout) || 0,
                        ownerPayout: ownerPayoutDisplay.value,
                        status: 'Booked',
                        notes: form.value.notes.trim(),
                        calendarEventId: targetItem.calendarEventId,
                    },
                    null,
                    { silent: true }
                );
                await deleteSheetRowById(stagingSpreadsheetId, targetItem.id, {
                    sheetName: 'Sheet1',
                });
                await stagingStore.archiveBookingEmail(targetItem.bookingId, 'Reservation');
                await stagingStore.removeStagedBookingLocally(targetItem.id);
                emit('approved', targetItem.bookingId);
                closeModal();
            },
            {
                loading: {
                    title: 'Approving Reservation...',
                    description: `Committing ${form.value.guestName} to Google Sheets and confirming calendar block.`,
                },
                success: {
                    title: 'Booking Approved',
                    description: `${form.value.guestName} (${form.value.listing}) confirmed successfully.`,
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
}
async function handleReject(): Promise<void> {
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
                    calendarEventId: targetItem.calendarEventId,
                });

                // Move email thread in Gmail to "Reservation" & archive from Inbox
                await stagingStore.archiveBookingEmail(targetItem.bookingId, 'Reservation');

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
}
</script>

<template>
    <Teleport to="body">
        <transition
            enter-active-class="transition ease-out duration-150"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition ease-in duration-100"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0">
            <div
                v-if="modelValue && booking"
                class="fixed inset-0 z-50 flex items-center justify-center bg-mist-950/75 p-4 backdrop-blur-xs font-sans">
                <div
                    class="w-full max-w-2xl rounded-md border border-mist-800 bg-mist-900 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 space-y-4 p-5 text-mist-100">
                    <!-- Modal Header -->
                    <div
                        class="flex items-center justify-between border-b border-mist-800 -mt-5 -mr-5 -ml-5 p-4 bg-mist-950/60">
                        <div>
                            <div class="flex items-center gap-2">
                                <h2 class="text-base font-semibold text-mist-100">
                                    Review & Approve Reservation
                                </h2>
                                <span
                                    v-if="formHasConflict"
                                    class="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-1.5 py-0.5 rounded font-mono font-bold">
                                    Conflict Detected
                                </span>
                            </div>
                            <p class="text-xs text-mist-400 mt-0.5">
                                Verify dates, channel payout, and commit directly to active property
                                records.
                            </p>
                        </div>
                        <button
                            type="button"
                            class="cursor-pointer text-mist-400 hover:text-mist-200 text-lg leading-none"
                            @click="closeModal">
                            <fa-icon icon="xmark" />
                        </button>
                    </div>

                    <!-- Review & Edit Form -->
                    <form
                        class="max-h-[75vh] overflow-y-auto space-y-4 text-xs"
                        @submit.prevent="handleApprove">
                        <!-- Target Property & Channel -->
                        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <SelectDropdown
                                v-model="form.propertyId"
                                input-label="Property"
                                placeholder="Select property"
                                :options="propertyOptions">
                                <template #icon>
                                    <fa-icon
                                        icon="house"
                                        class="text-xs" />
                                </template>
                            </SelectDropdown>

                            <SelectDropdown
                                v-model="form.listing"
                                input-label="Channel"
                                placeholder="Select channel"
                                :options="listingOptions" />
                        </div>

                        <!-- Booking ID & Guest Name -->
                        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <TextInput
                                id="reviewBookingId"
                                v-model.trim="form.bookingId"
                                input-label="Booking ID / Ref"
                                type="text"
                                placeholder="MHJ-000000"
                                required>
                                <template #icon>
                                    <fa-icon
                                        icon="hashtag"
                                        class="text-xs" />
                                </template>
                            </TextInput>

                            <TextInput
                                id="reviewGuestName"
                                v-model="form.guestName"
                                input-label="Guest Name"
                                type="text"
                                placeholder="Full Name"
                                required>
                                <template #icon>
                                    <fa-icon
                                        icon="id-card"
                                        class="text-xs" />
                                </template>
                            </TextInput>
                        </div>

                        <!-- Stay Dates & Nights -->
                        <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <div class="sm:col-span-2">
                                <DatePicker
                                    v-model="stayDates"
                                    mode="range"
                                    input-label="Stay Dates (Check In → Check Out)"
                                    placeholder="Select check-in & check-out dates" />
                            </div>

                            <div>
                                <span class="block font-medium text-xs text-mist-400 mb-1">
                                    Nights
                                </span>
                                <div
                                    class="flex items-center h-9.5 px-3 bg-mist-950/50 border border-mist-800 rounded-md font-mono text-xs text-mist-200 select-none">
                                    {{ form.nights }} night{{ form.nights > 1 ? 's' : '' }}
                                </div>
                            </div>
                        </div>

                        <!-- Channel Payout & 15% Owner Cut -->
                        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <TextInput
                                id="reviewPayout"
                                v-model.number="form.payout"
                                input-label="Payout"
                                type="number"
                                min="0"
                                placeholder="1.000.000"
                                required>
                                <template #icon>
                                    <fa-icon
                                        icon="rupiah-sign"
                                        class="text-xs" />
                                </template>
                            </TextInput>

                            <div>
                                <label class="block font-medium text-xs text-mist-400 mb-1">
                                    Owner Payout (15%)
                                </label>
                                <div
                                    class="flex items-center justify-between h-9.5 px-3 bg-mist-950/50 border border-mist-800 rounded-md font-mono text-sm text-mist-300 font-semibold select-none">
                                    <span>{{ formatIDR(ownerPayoutDisplay) }}</span>
                                    <span class="text-[10px] text-mist-500 font-normal">
                                        15% share
                                    </span>
                                </div>
                            </div>
                        </div>

                        <!-- Notes -->
                        <TextInput
                            id="reviewNotes"
                            v-model.trim="form.notes"
                            input-label="Notes"
                            type="text"
                            placeholder="Special requests, arrival notes..." />

                        <!-- Overlap Conflict Alert -->
                        <div
                            v-if="formHasConflict"
                            class="rounded-md border border-rose-500/30 bg-rose-950/20 p-2.5 text-xs text-rose-300">
                            <strong>Warning:</strong> Selected dates overlap with an existing
                            confirmed reservation in local records.
                        </div>

                        <!-- Actions -->
                        <div
                            class="flex justify-between items-center pt-3 border-t border-mist-800">
                            <button
                                type="button"
                                class="text-xs font-semibold text-rose-400 hover:text-rose-300 transition cursor-pointer"
                                @click="handleReject">
                                Reject & Discard
                            </button>

                            <div class="flex items-center gap-2">
                                <button
                                    type="button"
                                    class="text-xs px-3 py-2 font-semibold text-mist-400 hover:text-mist-200 cursor-pointer"
                                    @click="closeModal">
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    :disabled="isProcessing"
                                    class="bg-lime-400 hover:bg-lime-300 disabled:opacity-50 text-mist-950 text-xs px-4 py-2 rounded-md font-semibold transition flex items-center gap-1.5 cursor-pointer">
                                    <span
                                        v-if="isProcessing"
                                        class="w-3 h-3 border-2 border-mist-950 border-t-transparent rounded-full animate-spin" />
                                    <span>Approve Reservation</span>
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </transition>
    </Teleport>
</template>
