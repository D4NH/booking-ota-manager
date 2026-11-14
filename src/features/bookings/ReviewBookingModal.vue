<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useGoogleSheets } from '@/composables/useGoogleSheets';
import { useBookingStore } from '@/stores/useBookingStore';
import { useBookingSync } from '@/composables/useBookingSync';
import { useStagingStore } from '@/stores/useStagingStore';
import { PROPERTY_LIST, PROPERTY_CONFIGS } from '@/config/properties';
import type { BookingChannel, StagedBooking, BookingPayload } from '@/types/booking';
import type { PropertyId } from '@/types/property';
import { calculateNights } from '@/utils/date';
import { calculateOwnerPayout } from '@/utils/finance';
import { formatIDR } from '@/utils/money';
import { sanitizeDoorCode } from '@/utils/lockbox';
import { toast } from 'vue-toastflow';
import AppButton from '@/components/ui/AppButton.vue';
import DatePicker from '@/components/ui/DatePicker.vue';
import SelectDropdown from '@/components/ui/SelectDropdown.vue';
import TextInput from '@/components/ui/TextInput.vue';

interface OptionItem {
    label: string;
    value: string;
}

interface FormState {
    propertyId: PropertyId;
    bookingId: string;
    guestName: string;
    checkIn: string;
    checkOut: string;
    nights: number;
    payout: number | '';
    listing: BookingChannel;
    notes: string;
}

interface Props {
    modelValue?: boolean;
    booking?: StagedBooking | null;
    stagingSpreadsheetId: string;
}

const LISTING_OPTIONS: OptionItem[] = [
    { label: 'Airbnb', value: 'Airbnb' },
    { label: 'Booking.com', value: 'Booking.com' },
    { label: 'Tiket.com', value: 'Tiket.com' },
    { label: 'Trip.com', value: 'Trip.com' },
    { label: 'Unavailable', value: 'Unavailable' },
    { label: 'Whatsapp', value: 'Whatsapp' },
];

const PROPERTY_OPTIONS: OptionItem[] = PROPERTY_LIST.map((property) => ({
    label: property.name,
    value: property.id,
}));

const BOOKING_COM_COMMISSION_RATE = 0.192;

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

const isProcessing = ref<boolean>(false);
const form = ref<FormState>({
    propertyId: 'piyungan',
    bookingId: '',
    guestName: '',
    checkIn: '',
    checkOut: '',
    nights: 1,
    payout: '',
    listing: 'Airbnb',
    notes: '',
});

const isBookingDotCom = computed<boolean>(() => form.value.listing === 'Booking.com');
const effectivePayout = computed<number>(() => {
    const raw = Number(form.value.payout) || 0;
    if (isBookingDotCom.value && raw > 0) {
        return Math.round(raw * (1 - BOOKING_COM_COMMISSION_RATE));
    }
    return raw;
});
const ownerPayoutDisplay = computed<number>((): number =>
    calculateOwnerPayout(effectivePayout.value)
);
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
const formHasConflict = computed<boolean>(() => {
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
                const rawPayout = Number(form.value.payout) || 0;
                let finalNotes = form.value.notes.trim();

                const isAlreadyTagged = /\[Gross:.*?BDC\]/i.test(finalNotes);

                if (isBookingDotCom.value && rawPayout > 0 && !isAlreadyTagged) {
                    const formattedGross = 'Rp ' + Math.round(rawPayout).toLocaleString('id-ID');
                    const grossTag = `[Gross: ${formattedGross} | -19.2% BDC]`;
                    finalNotes = finalNotes ? `${grossTag} ${finalNotes}` : grossTag;
                }

                finalNotes = finalNotes.replace(/(\[Gross:.*?BDC\]\s*)+/gi, '$1').trim();

                const doorCode = sanitizeDoorCode(
                    targetItem.doorCode,
                    form.value.bookingId.trim() || targetItem.bookingId,
                    form.value.checkIn
                );

                const payload: BookingPayload = {
                    propertyId: form.value.propertyId,
                    bookingId: form.value.bookingId.trim() || targetItem.bookingId,
                    listing: form.value.listing,
                    guestName: form.value.guestName.trim(),
                    checkIn: form.value.checkIn,
                    checkOut: form.value.checkOut,
                    nights: Number(form.value.nights) || 1,
                    payout: effectivePayout.value,
                    ownerPayout: ownerPayoutDisplay.value,
                    status: 'Booked',
                    notes: finalNotes || undefined,
                    calendarEventId: targetItem.calendarEventId,
                    doorCode,
                };

                await saveBooking(payload, null, { silent: true });
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
                class="fixed inset-0 z-50 flex items-center justify-center bg-mist-950/75 p-4 backdrop-blur-xs">
                <div
                    class="w-full max-w-2xl animate-in space-y-4 overflow-hidden rounded-md border border-mist-800 bg-mist-900 p-5 shadow-lg duration-150 zoom-in-95 fade-in">
                    <!-- Modal Header -->
                    <div
                        class="-mt-5 -mr-5 -ml-5 flex items-center justify-between border-b border-mist-800 bg-mist-950/60 p-4">
                        <div>
                            <div class="flex items-center gap-2">
                                <h2 class="text-base font-semibold">
                                    Review & Approve Reservation
                                </h2>
                                <span
                                    v-if="formHasConflict"
                                    class="rounded border border-rose-500/30 bg-rose-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-rose-300">
                                    Conflict Detected
                                </span>
                            </div>
                            <p class="mt-0.5 text-xs text-mist-400">
                                Verify dates, channel payout, and commit directly to active property
                                records.
                            </p>
                        </div>
                        <AppButton
                            variant="icon"
                            @click="closeModal">
                            <template #icon>
                                <fa-icon icon="xmark" />
                            </template>
                        </AppButton>
                    </div>

                    <!-- Review & Edit Form -->
                    <form
                        class="max-h-[75vh] space-y-4 overflow-y-auto text-xs"
                        @submit.prevent="handleApprove">
                        <!-- Target Property & Channel -->
                        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <SelectDropdown
                                v-model="form.propertyId"
                                input-label="Property"
                                placeholder="Select property"
                                :options="PROPERTY_OPTIONS">
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
                                :options="LISTING_OPTIONS" />
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
                                <span class="mb-1 block text-xs font-medium text-mist-400">
                                    Nights
                                </span>
                                <div
                                    class="flex h-9.5 items-center rounded-md border border-mist-800 bg-mist-950/50 px-3 font-mono text-xs text-mist-200 select-none">
                                    {{ form.nights }} night{{ form.nights > 1 ? 's' : '' }}
                                </div>
                            </div>
                        </div>

                        <!-- Channel Payout & 15% Owner Cut -->
                        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <TextInput
                                    id="reviewPayout"
                                    v-model.number="form.payout"
                                    :input-label="
                                        isBookingDotCom ? 'Gross Price from Extranet' : 'Payout'
                                    "
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

                                <p
                                    v-if="isBookingDotCom && form.payout"
                                    class="mt-1 font-mono text-[11px] font-semibold text-lime-400">
                                    Host Net (-19.2%): {{ formatIDR(effectivePayout) }}
                                </p>
                            </div>

                            <div>
                                <label class="mb-1 block text-xs font-medium text-mist-400">
                                    Owner Payout
                                </label>
                                <div
                                    class="flex h-9.5 items-center justify-between rounded-md border border-mist-800 bg-mist-950/50 px-3 font-mono text-sm font-semibold text-mist-300 select-none">
                                    <span class="text-xs">{{ formatIDR(ownerPayoutDisplay) }}</span>
                                    <span class="text-[12px] font-normal text-mist-400">
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
                            class="flex items-center justify-between border-t border-mist-800 pt-3">
                            <AppButton
                                label="Reject & Discard"
                                class="-ml-2"
                                variant="text"
                                color="rose"
                                @click="handleReject">
                                <template #icon>
                                    <fa-icon icon="trash-can" />
                                </template>
                            </AppButton>

                            <div class="flex items-center gap-2">
                                <AppButton
                                    label="Cancel"
                                    variant="text"
                                    @click="closeModal" />
                                <AppButton
                                    type="submit"
                                    :disabled="isProcessing"
                                    label="Approve Reservation">
                                    <template
                                        v-if="isProcessing"
                                        #icon>
                                        <span
                                            class="mx-1 h-3 w-3 animate-spin rounded-full border-2 border-mist-900 border-t-transparent" />
                                    </template>
                                    <span v-if="isProcessing">Processing..</span>
                                </AppButton>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </transition>
    </Teleport>
</template>
