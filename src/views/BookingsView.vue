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

import SelectDropdown from '@/components/ui/SelectDropdown.vue';
import TextInput from '@/components/ui/TextInput.vue';
import CardTitle from '@/components/CardTitle.vue';
import PageTitle from '@/components/PageTitle.vue';
import CurrentWeekView from '@/features/bookings/CurrentWeekView.vue';
import PropertySelector from '@/components/PropertySelector.vue';
import BookingsTable from '@/features/bookings/BookingsTable.vue';

const modalStore = useModalStore();
const { deleteBooking } = useBookingSync();

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

const monthOptions = computed(() => [
    { label: 'All Months', value: 'all' },
    ...availableMonths.value.map((month) => ({
        label: formatDate(month, { monthHeader: true }),
        value: month,
    })),
]);

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

function scrollToCurrentMonth(): void {
    nextTick(() => {
        requestAnimationFrame(() => {
            const el = document.querySelector(`[data-month-key="${currentMonthKey.value}"]`);
            el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
}
function toggleStatusVisibility(status: Booking['status']): void {
    const idx = hiddenStatuses.value.indexOf(status);
    if (idx > -1) {
        hiddenStatuses.value.splice(idx, 1);
    } else {
        hiddenStatuses.value.push(status);
    }
}
function handleAddBooking(): void {
    modalStore.openBookingModal({
        propertyId: selectedProperty.value,
        checkInDate: currentDay.value,
    });
}
function handleEditBooking(booking: Booking): void {
    modalStore.openBookingModal({ booking });
}
async function handleDeleteBooking(booking: Booking): Promise<void> {
    void (await deleteBooking(booking));
}
</script>

<template>
    <div class="h-full overflow-hidden flex flex-col space-y-4 p-4">
        <PageTitle>
            <template #title>Bookings</template>
            <template #subtitle>Real-time availability and unit operational status</template>

            <PropertySelector v-model="selectedProperty" />
        </PageTitle>

        <CurrentWeekView
            class="shrink-0"
            :selected-property="selectedProperty"
            :show-header="false" />

        <!-- Filter Toolbar -->
        <div class="shrink-0 space-y-4">
            <CardTitle>
                <template #title>All Bookings</template>
                <template #subtitle>
                    Showing {{ filteredBookings.length }} of {{ propertyBookings.length }} bookings
                </template>
            </CardTitle>

            <div
                class="flex shrink-0 items-center justify-between rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md">
                <div class="flex items-center gap-2">
                    <!-- Text Search -->
                    <TextInput
                        id="searchQuery"
                        v-model.number="searchQuery"
                        input-label=""
                        type="text"
                        placeholder="Search guest, ID, notes..."
                        required>
                        <template #icon>
                            <fa-icon
                                icon="magnifying-glass"
                                class="text-xs" />
                        </template>
                    </TextInput>
                    <!-- Month Dropdown -->
                    <SelectDropdown
                        v-model="selectedMonth"
                        input-label=""
                        class="w-44"
                        :options="monthOptions" />
                    <!-- Status Filters -->
                    <button
                        type="button"
                        class="rounded-md border border-mist-800 pl-2.5 pr-3 py-2 text-xs text-mist-300 hover:border-mist-700 transition-colors shadow-sm cursor-pointer"
                        :class="[toggleFilters ? 'bg-mist-800' : 'bg-mist-950/50']"
                        title="Filter by Status"
                        @click="toggleFilters = !toggleFilters">
                        <fa-icon
                            class="text-xs mr-1"
                            icon="filter" />
                        Filters
                    </button>
                    <div
                        v-if="toggleFilters"
                        class="flex flex-wrap items-center gap-2">
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
            :show-property-column="selectedProperty === 'all'"
            @edit="handleEditBooking"
            @delete="handleDeleteBooking" />
    </div>
</template>
