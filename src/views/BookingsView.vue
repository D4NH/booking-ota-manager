<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onActivated } from 'vue';
import { useBookingSync } from '@/composables/useBookingSync';
import { useGroupedBookings } from '@/composables/useGroupedBookings';
import { usePropertyDetails } from '@/composables/usePropertyDetails';
import { bookingStatuses } from '@/config/status';
import { useModalStore } from '@/stores/useModalStore';
import type { Booking } from '@/types/booking';
import type { PropertyId } from '@/types/property';
import { formatDate } from '@/utils/date';

import CardTitle from '@/components/CardTitle.vue';
import PageTitle from '@/components/PageTitle.vue';
import CurrentWeekView from '@/components/CurrentWeekView.vue';
import GoogleSyncButton from '@/components/GoogleSyncButton.vue';
import PropertySelector from '@/components/PropertySelector.vue';
import BookingsTable from '@/components/BookingsTable.vue';

const modalStore = useModalStore();
const { deleteBooking, clearAllLocalBookings } = useBookingSync();

const selectedProperty = ref<PropertyId | 'all'>('all');
const selectedMonth = ref<string>('all');
const searchQuery = ref<string>('');
const hiddenStatuses = ref<Booking['status'][]>([]);
const toggleFilters = ref<boolean>(false);

const { currentDay, unitBookings: propertyBookings } = usePropertyDetails(selectedProperty, {
    includeUnavailable: true,
});

const filteredBookings = computed<Booking[]>(() => {
    const query = searchQuery.value.trim().toLowerCase();
    const hidden = hiddenStatuses.value;

    return propertyBookings.value.filter((b) => {
        if (hidden.includes(b.status)) return false;
        if (query) {
            return (
                b.guestName.toLowerCase().includes(query) ||
                b.bookingId.toLowerCase().includes(query) ||
                (b.notes ? b.notes.toLowerCase().includes(query) : false)
            );
        }
        return true;
    });
});

const {
    groupedBookings,
    availableMonths,
    collapsedMonths,
    currentMonthKey,
    collapsePastMonths,
    expandAll,
} = useGroupedBookings(filteredBookings, {
    selectedMonth,
    autoCollapsePast: true,
});

const scrollToCurrentMonth = (): void =>
    void nextTick(() => {
        requestAnimationFrame(() => {
            const el = document.querySelector(`[data-month-key="${currentMonthKey.value}"]`);
            el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
const toggleStatusVisibility = (status: Booking['status']): void => {
    const idx = hiddenStatuses.value.indexOf(status);
    if (idx > -1) {
        hiddenStatuses.value.splice(idx, 1);
    } else {
        hiddenStatuses.value.push(status);
    }
};
const handleAddBooking = (): void =>
    modalStore.openBookingModal({
        propertyId: selectedProperty.value,
        checkInDate: currentDay.value,
    });
const handleEditBooking = (booking: Booking): void => modalStore.openBookingModal({ booking });
const handleDeleteBooking = async (booking: Booking): Promise<void> =>
    void (await deleteBooking(booking));
const handleClearAllLocal = async (): Promise<void> => await clearAllLocalBookings();

watch(selectedMonth, (newMonth) => {
    if (newMonth !== 'all') {
        expandAll();
    } else {
        collapsePastMonths();
    }
    scrollToCurrentMonth();
});

watch(selectedProperty, () => {
    scrollToCurrentMonth();
});

onMounted(() => {
    scrollToCurrentMonth();
});

onActivated(() => {
    scrollToCurrentMonth();
});
</script>

<template>
    <div class="h-full overflow-hidden flex flex-col space-y-4 p-4">
        <PageTitle>
            <template #title>Bookings</template>
            <template #subtitle>
                Showing {{ filteredBookings.length }} of {{ propertyBookings.length }} bookings
            </template>

            <div class="flex items-center gap-4">
                <GoogleSyncButton :property-id="selectedProperty" />
                <PropertySelector v-model="selectedProperty" />
            </div>
        </PageTitle>

        <!-- Operational 7-Day Bar -->
        <CurrentWeekView
            class="shrink-0"
            :selected-property="selectedProperty"
            :show-header="false" />

        <!-- Filter Toolbar -->
        <div class="shrink-0 space-y-4">
            <CardTitle>
                <template #title>All Bookings</template>
                <template #subtitle>Real-time availability and unit operational status</template>
            </CardTitle>

            <div
                class="flex shrink-0 items-center justify-between rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md">
                <div class="flex items-center gap-2">
                    <!-- Text Search -->
                    <div class="w-52">
                        <div class="relative w-full max-w-xs">
                            <div
                                class="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-mist-500">
                                <fa-icon
                                    icon="magnifying-glass"
                                    class="w-3.5 h-3.5" />
                            </div>
                            <input
                                v-model="searchQuery"
                                type="text"
                                placeholder="Search guest, ID, notes..."
                                class="w-full rounded-md bg-mist-950/50 border border-mist-800 py-1.5 pl-9 pr-3 text-xs text-mist-200 placeholder-mist-600 focus:border-lime-500 focus:outline-none transition-colors" />
                        </div>
                    </div>

                    <!-- Month Dropdown -->
                    <div class="relative w-44">
                        <select
                            v-model="selectedMonth"
                            class="w-full appearance-none rounded-md border border-mist-800 bg-mist-950/50 px-3 py-1.5 text-xs text-mist-200 focus:border-lime-500 focus:outline-none transition-colors cursor-pointer">
                            <option value="all">All Months</option>
                            <option
                                v-for="mKey in availableMonths"
                                :key="mKey"
                                :value="mKey">
                                {{ formatDate(mKey, { monthHeader: true }) }}
                            </option>
                        </select>
                        <div
                            class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-mist-400">
                            <fa-icon
                                class="text-[10px]"
                                icon="angle-down" />
                        </div>
                    </div>

                    <!-- Status Filters -->
                    <button
                        type="button"
                        class="cursor-pointer rounded-md border border-mist-800 bg-mist-800 px-3 py-1.5 text-xs font-semibold text-mist-200 hover:bg-mist-700 transition"
                        title="Filter by Status"
                        @click="toggleFilters = !toggleFilters">
                        <fa-icon
                            class="text-xs"
                            icon="filter" />
                    </button>
                    <div
                        v-if="toggleFilters"
                        class="flex flex-wrap items-center gap-1.5 ml-1">
                        <button
                            v-for="status in bookingStatuses"
                            :key="status"
                            type="button"
                            :class="[
                                'cursor-pointer rounded-md px-2.5 py-1 text-xs border transition',
                                hiddenStatuses.includes(status)
                                    ? 'border-rose-500/40 bg-rose-500/10 text-rose-400 line-through'
                                    : 'border-mist-800 bg-mist-800 text-mist-300 hover:border-mist-600',
                            ]"
                            @click="toggleStatusVisibility(status)">
                            {{ status }}
                        </button>
                    </div>
                </div>

                <button
                    type="button"
                    class="cursor-pointer rounded-md bg-lime-500 hover:bg-lime-400 px-4 py-2 text-xs font-semibold text-mist-950 transition"
                    @click="handleAddBooking">
                    <fa-icon
                        class="text-xs mr-1"
                        icon="plus" />
                    Add Booking
                </button>
            </div>
        </div>

        <!-- Bookings Table -->
        <div
            v-if="groupedBookings.length === 0"
            class="flex flex-1 flex-col items-center justify-center rounded-md border border-mist-800 shadow-md text-xs text-mist-400 p-8">
            <fa-icon
                icon="receipt"
                class="text-2xl text-mist-600" />
            <p class="mt-2 text-sm">No bookings match the selected criteria</p>
        </div>
        <BookingsTable
            v-else
            v-model:collapsed-months="collapsedMonths"
            :groups="groupedBookings"
            :current-month-key="currentMonthKey"
            :current-date-key="currentDay"
            show-property-column
            @edit="handleEditBooking"
            @delete="handleDeleteBooking" />

        <!-- Local Database Reset Action -->
        <div class="flex shrink-0 justify-end">
            <button
                type="button"
                class="cursor-pointer rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition"
                @click="handleClearAllLocal">
                Clear Local DB
            </button>
        </div>
    </div>
</template>
