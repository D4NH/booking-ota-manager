<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useGoogleSheets } from '@/composables/useGoogleSheets';
import { useBookingSync } from '@/composables/useBookingSync';
import { useBookingStore } from '@/stores/useBookingStore';
import { useStagingStore } from '@/stores/useStagingStore';
import { PROPERTY_LIST, PROPERTY_CONFIGS } from '@/config/properties';
import type { BookingChannel, StagedBooking } from '@/types/booking';
import type { PropertyId } from '@/types/property';
import { calculateNights } from '@/utils/date';
import { formatIDR } from '@/utils/money';
import { toast } from 'vue-toastflow';

interface Props {
    modelValue?: boolean;
    stagingSpreadsheetId: string;
}

const { modelValue = false, stagingSpreadsheetId } = defineProps<Props>();

const emit = defineEmits<{ 'update:modelValue': [val: boolean] }>();

const bookingStore = useBookingStore();
const stagingStore = useStagingStore();
const { saveBooking } = useBookingSync();
const { fetchSheetRows, deleteSheetRowById, updateCalendarEventSummary, deleteCalendarEvent } =
    useGoogleSheets();

const stagedBookings = ref<StagedBooking[]>([]);
const isLoading = ref<boolean>(false);
const isProcessing = ref<boolean>(false);

// Edit & Review Drawer / Sub-modal State
const editingItem = ref<StagedBooking | null>(null);

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

const loadStagingQueue = async (): Promise<void> => {
    if (!stagingSpreadsheetId) return;
    isLoading.value = true;
    try {
        const rows = await fetchSheetRows(stagingSpreadsheetId, 'Sheet1!A2:L');
        stagedBookings.value = rows
            .filter((r) => r[0] && String(r[9] || '').trim() === 'Pending Approval')
            .map((r): StagedBooking => {
                const checkIn = String(r[5] || '').trim();
                const checkOut = String(r[6] || '').trim();
                const propId = String(r[1] || 'piyungan').trim() as PropertyId;

                // Clean & Un-mangle 16-digit Booking ID (e.g. Trip.com scientific notation)
                let cleanBookingId = String(r[2] || '')
                    .trim()
                    .replace(/^'+/, '');
                if (cleanBookingId.includes('E+') || cleanBookingId.includes('e+')) {
                    try {
                        cleanBookingId = BigInt(Math.round(Number(cleanBookingId))).toString();
                    } catch {
                        cleanBookingId = Number(cleanBookingId).toLocaleString('fullwide', {
                            useGrouping: false,
                        });
                    }
                }

                const conflict = bookingStore.hasDateConflict(
                    propId,
                    checkIn,
                    checkOut,
                    cleanBookingId
                );

                return {
                    id: String(r[0]).trim(),
                    propertyId: propId,
                    bookingId: cleanBookingId,
                    listing: String(r[3] || 'Other').trim() as BookingChannel,
                    guestName: String(r[4] || 'Guest').trim(),
                    checkIn,
                    checkOut,
                    nights: Number(r[7]) || calculateNights(checkIn, checkOut),
                    payout: Number(r[8]) || 0,
                    status: 'Pending Approval',
                    notes: String(r[10] || '').trim(),
                    calendarEventId: String(r[11] || '').trim() || undefined,
                    hasConflict: Boolean(conflict),
                };
            });
    } catch (err) {
        console.error('Failed to load staging queue:', err);
    } finally {
        isLoading.value = false;
    }
};

const openEditModal = (item: StagedBooking): void => {
    editingItem.value = item;
    formPropertyId.value = item.propertyId;
    formBookingId.value = item.bookingId;
    formListing.value = item.listing;
    formGuestName.value = item.guestName;
    formCheckIn.value = item.checkIn;
    formCheckOut.value = item.checkOut;
    formPayout.value = item.payout;
    formNotes.value = item.notes || '';
};

const closeEditModal = (): void => {
    editingItem.value = null;
};

const handleApproveFromEdit = async (): Promise<void> => {
    if (isProcessing.value || !editingItem.value) return;

    if (!formCheckIn.value || !formCheckOut.value || !formGuestName.value) {
        alert('Please fill out required dates and guest details.');
        return;
    }

    isProcessing.value = true;
    const targetItem = editingItem.value;
    const targetCalendarId = PROPERTY_CONFIGS[formPropertyId.value]?.calendarId;

    try {
        await toast.loading(
            async () => {
                // 1. Remote-first: Commit booking to active Property sheet & mirror to DexieDB
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

                // 2. Direct Calendar REST call: Strip [PENDING] on property calendar
                if (targetItem.calendarEventId && targetCalendarId) {
                    await updateCalendarEventSummary(
                        targetCalendarId,
                        targetItem.calendarEventId,
                        `${formListing.value} - ${formGuestName.value.trim()}`,
                        { checkIn: formCheckIn.value, checkOut: formCheckOut.value },
                        `Confirmed reservation for ${formGuestName.value.trim()} via ${formListing.value}. Ref: ${formBookingId.value}`
                    ).catch((e) => console.warn('Direct Calendar PATCH skipped:', e));
                }

                // 3. Purge row from Staging sheet using unified delete options object
                await deleteSheetRowById(stagingSpreadsheetId, targetItem.id, {
                    sheetName: 'Sheet1',
                });

                await stagingStore.removeStagedBookingLocally(targetItem.id);

                // 4. Update UI queue
                stagedBookings.value = stagedBookings.value.filter((i) => i.id !== targetItem.id);
                closeEditModal();
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

const handleReject = async (staged: StagedBooking | null): Promise<void> => {
    if (!staged) return;

    const confirmed = window.confirm(
        `Reject incoming booking ${staged.bookingId} (${staged.guestName})? This will delete the staging row and remove the calendar block.`
    );
    if (!confirmed) return;

    const targetCalendarId = PROPERTY_CONFIGS[staged.propertyId]?.calendarId;

    try {
        await toast.loading(
            async () => {
                // Delete event from Google Calendar if event ID exists
                if (staged.calendarEventId && targetCalendarId) {
                    await deleteCalendarEvent(targetCalendarId, staged.calendarEventId).catch((e) =>
                        console.warn('Calendar DELETE skipped:', e)
                    );
                }

                // Delete staging row from Google Sheets with explicit sheetName
                await deleteSheetRowById(stagingSpreadsheetId, staged.id, {
                    sheetName: 'Sheet1',
                    calendarId: targetCalendarId,
                });

                await stagingStore.removeStagedBookingLocally(staged.id);

                stagedBookings.value = stagedBookings.value.filter((i) => i.id !== staged.id);

                if (editingItem.value?.id === staged.id) {
                    closeEditModal();
                }
            },
            {
                loading: {
                    title: 'Rejecting Booking...',
                    description: 'Removing from staging queue and clearing calendar block.',
                },
                success: {
                    title: 'Booking Dismissed',
                    description: `${staged.bookingId} rejected and removed.`,
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
    () => modelValue,
    (isOpen) => {
        if (isOpen && stagingSpreadsheetId) {
            loadStagingQueue();
        } else {
            closeEditModal();
        }
    },
    { immediate: true }
);
</script>

<template>
    <div
        v-if="modelValue"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
        @click.self="emit('update:modelValue', false)">
        <div
            class="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-2xl border border-mist-800 bg-mist-900 p-6 shadow-2xl relative">
            <!-- Modal Header -->
            <div class="flex items-center justify-between border-b border-mist-800 pb-4">
                <div>
                    <div class="flex items-center gap-2">
                        <h3 class="text-base font-bold text-mist-100">Incoming Bookings Staging</h3>
                        <span
                            class="rounded bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-xs font-mono font-bold text-amber-300">
                            {{ stagedBookings.length }} Pending
                        </span>
                    </div>
                    <p class="text-xs text-mist-400 mt-0.5">
                        Parsed from OTA emails. Click Review & Edit to adjust payout, verify
                        details, and approve.
                    </p>
                </div>
                <button
                    type="button"
                    class="text-mist-400 hover:text-mist-100 cursor-pointer text-base"
                    @click="emit('update:modelValue', false)">
                    ✕
                </button>
            </div>

            <!-- Staging Queue List -->
            <div class="flex-1 overflow-y-auto space-y-3 py-4 pr-1">
                <div
                    v-for="item in stagedBookings"
                    :key="item.id"
                    class="rounded-xl border p-4 transition-colors"
                    :class="
                        item.hasConflict
                            ? 'border-rose-500/40 bg-rose-950/15'
                            : 'border-mist-800 bg-mist-850/60'
                    ">
                    <div
                        class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <div class="flex items-center gap-2 mb-1 flex-wrap">
                                <span
                                    class="rounded bg-mist-800 border border-mist-700 px-2 py-0.5 text-[10px] font-mono font-bold text-mist-300">
                                    {{ item.listing }}
                                </span>
                                <span class="font-bold text-sm text-mist-100">{{
                                    item.guestName
                                }}</span>
                                <span class="text-xs font-mono text-mist-400"
                                    >({{ item.bookingId }})</span
                                >

                                <!-- Date Overlap Guard -->
                                <span
                                    v-if="item.hasConflict"
                                    class="rounded bg-rose-500/20 border border-rose-500/40 px-2 py-0.5 text-[10px] font-bold text-rose-300 animate-pulse">
                                    ⚠ DATE OVERLAP DETECTED
                                </span>
                            </div>

                            <div
                                class="flex flex-wrap items-center gap-4 text-xs font-mono text-mist-400 mt-2">
                                <span
                                    >Check-in:
                                    <strong class="text-mist-200">{{ item.checkIn }}</strong></span
                                >
                                <span
                                    >Check-out:
                                    <strong class="text-mist-200">{{ item.checkOut }}</strong></span
                                >
                                <span
                                    >Nights:
                                    <strong class="text-mist-200">{{ item.nights }}</strong></span
                                >
                                <span
                                    >Payout:
                                    <strong class="text-lime-400 font-bold">{{
                                        formatIDR(item.payout)
                                    }}</strong></span
                                >
                            </div>

                            <p
                                v-if="item.notes"
                                class="text-[11px] text-mist-500 mt-1.5 font-sans">
                                {{ item.notes }}
                            </p>
                        </div>

                        <!-- Actions -->
                        <div class="flex items-center gap-2 shrink-0">
                            <button
                                type="button"
                                class="rounded-md border border-mist-700 bg-mist-800 px-3 py-1.5 text-xs text-mist-300 hover:bg-mist-700 transition cursor-pointer"
                                @click="handleReject(item)">
                                Reject
                            </button>
                            <button
                                type="button"
                                class="rounded-md bg-lime-400 hover:bg-lime-300 text-mist-950 px-3.5 py-1.5 text-xs font-bold transition shadow-sm cursor-pointer flex items-center gap-1.5"
                                @click="openEditModal(item)">
                                <span>Review & Edit</span>
                                <span class="text-[10px] font-mono">&rarr;</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div
                    v-if="stagedBookings.length === 0 && !isLoading"
                    class="py-12 text-center text-xs text-mist-500">
                    No incoming bookings awaiting approval.
                </div>
            </div>

            <!-- Edit & Approve Drawer / Overlay Modal -->
            <div
                v-if="editingItem"
                class="absolute inset-0 z-20 flex items-center justify-center bg-black/80 p-4 rounded-2xl backdrop-blur-xs animate-in fade-in zoom-in-95 duration-150">
                <div
                    class="flex flex-col w-full max-w-xl max-h-[80vh] rounded-xl border border-mist-750 bg-mist-900 shadow-2xl p-5 overflow-hidden">
                    <div
                        class="flex items-center justify-between pb-3 border-b border-mist-800 mb-4">
                        <div>
                            <h4 class="text-sm font-bold text-mist-100 flex items-center gap-2">
                                <span>Review & Approve Reservation</span>
                                <span
                                    v-if="formHasConflict"
                                    class="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-1.5 py-0.5 rounded font-mono font-bold">
                                    Conflict
                                </span>
                            </h4>
                            <p class="text-xs text-mist-400">
                                Verify details, update payout if needed, and commit to official
                                ledger.
                            </p>
                        </div>
                        <button
                            type="button"
                            class="text-mist-400 hover:text-mist-200 cursor-pointer text-base"
                            @click="closeEditModal">
                            ✕
                        </button>
                    </div>

                    <form
                        class="space-y-3.5 overflow-y-auto flex-1 pr-1"
                        @submit.prevent="handleApproveFromEdit">
                        <!-- Property & Listing Channel -->
                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <label class="text-xs font-semibold text-mist-400 block mb-1"
                                    >Target Property</label
                                >
                                <select
                                    v-model="formPropertyId"
                                    class="w-full text-xs border border-mist-700 bg-mist-850 text-mist-100 rounded-md p-2.5 focus:border-lime-400 focus:outline-none">
                                    <option
                                        v-for="p in PROPERTY_LIST"
                                        :key="p.id"
                                        :value="p.id">
                                        {{ p.name }} ({{ p.id }})
                                    </option>
                                </select>
                            </div>

                            <div>
                                <label class="text-xs font-semibold text-mist-400 block mb-1"
                                    >Booking Channel</label
                                >
                                <select
                                    v-model="formListing"
                                    class="w-full text-xs border border-mist-700 bg-mist-850 text-mist-100 rounded-md p-2.5 focus:border-lime-400 focus:outline-none">
                                    <option
                                        v-for="ch in listingChannels"
                                        :key="ch"
                                        :value="ch">
                                        {{ ch }}
                                    </option>
                                </select>
                            </div>
                        </div>

                        <!-- Guest Name & Booking ID -->
                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <label class="text-xs font-semibold text-mist-400 block mb-1"
                                    >Guest Name</label
                                >
                                <input
                                    v-model="formGuestName"
                                    type="text"
                                    required
                                    class="w-full text-xs border border-mist-700 bg-mist-850 text-mist-100 rounded-md p-2.5 focus:border-lime-400 focus:outline-none" />
                            </div>

                            <div>
                                <label class="text-xs font-semibold text-mist-400 block mb-1"
                                    >Reservation Reference</label
                                >
                                <input
                                    v-model="formBookingId"
                                    type="text"
                                    required
                                    class="w-full text-xs border border-mist-700 bg-mist-850 text-mist-100 rounded-md p-2.5 font-mono focus:border-lime-400 focus:outline-none" />
                            </div>
                        </div>

                        <!-- Check-in & Check-out Dates -->
                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <label class="text-xs font-semibold text-mist-400 block mb-1"
                                    >Check-in Date</label
                                >
                                <input
                                    v-model="formCheckIn"
                                    type="date"
                                    required
                                    class="w-full text-xs border border-mist-700 bg-mist-850 text-mist-100 rounded-md p-2.5 font-mono focus:border-lime-400 focus:outline-none" />
                            </div>

                            <div>
                                <label class="text-xs font-semibold text-mist-400 block mb-1">
                                    Check-out Date ({{ computedNights }} Nights)
                                </label>
                                <input
                                    v-model="formCheckOut"
                                    type="date"
                                    required
                                    class="w-full text-xs border border-mist-700 bg-mist-850 text-mist-100 rounded-md p-2.5 font-mono focus:border-lime-400 focus:outline-none" />
                            </div>
                        </div>

                        <!-- Net Payout Amount -->
                        <div>
                            <div class="flex items-center justify-between mb-1">
                                <label class="text-xs font-semibold text-mist-400"
                                    >Net Host Payout (IDR)</label
                                >
                                <span class="text-[11px] text-lime-400 font-mono font-semibold">
                                    {{ formatIDR(Number(formPayout) || 0) }}
                                </span>
                            </div>
                            <input
                                v-model.number="formPayout"
                                type="number"
                                min="0"
                                placeholder="0"
                                class="w-full text-xs border border-mist-700 bg-mist-850 text-mist-100 rounded-md p-2.5 font-mono focus:border-lime-400 focus:outline-none" />
                            <p class="text-[10px] text-mist-500 mt-1">
                                Check confirmation voucher or OTA Extranet statement if payout was
                                masked during email ingestion.
                            </p>
                        </div>

                        <!-- Notes -->
                        <div>
                            <label class="text-xs font-semibold text-mist-400 block mb-1"
                                >Notes / Special Requests</label
                            >
                            <input
                                v-model="formNotes"
                                type="text"
                                placeholder="e.g. Early check-in requested / Extra bed"
                                class="w-full text-xs border border-mist-700 bg-mist-850 text-mist-100 rounded-md p-2.5 focus:border-lime-400 focus:outline-none" />
                        </div>

                        <!-- Overlap Warning -->
                        <div
                            v-if="formHasConflict"
                            class="rounded-md border border-rose-500/30 bg-rose-950/20 p-2.5 text-xs text-rose-300">
                            <strong>Warning:</strong> Selected dates overlap with an existing
                            confirmed reservation in local records.
                        </div>

                        <!-- Form Action Buttons -->
                        <div
                            class="flex justify-between items-center pt-3 border-t border-mist-800">
                            <button
                                v-if="editingItem"
                                type="button"
                                class="text-xs text-rose-400 hover:text-rose-300 transition cursor-pointer"
                                @click="handleReject(editingItem)">
                                Dismiss & Reject
                            </button>

                            <div class="flex items-center gap-2">
                                <button
                                    type="button"
                                    class="text-xs px-3 py-2 text-mist-400 hover:text-mist-200 cursor-pointer"
                                    @click="closeEditModal">
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    :disabled="isProcessing"
                                    class="bg-lime-400 hover:bg-lime-300 disabled:opacity-50 text-mist-950 text-xs px-4 py-2 rounded-md font-bold transition flex items-center gap-1.5 cursor-pointer">
                                    <span
                                        v-if="isProcessing"
                                        class="w-3 h-3 border-2 border-mist-950 border-t-transparent rounded-full animate-spin" />
                                    <span>Approve & Commit</span>
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
</template>
