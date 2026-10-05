<script setup lang="ts">
import { onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { db } from '@/db';
import { useGoogleSheets } from '@/composables/useGoogleSheets';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useBookingStore } from '@/stores/useBookingStore';
import { useModalStore } from '@/stores/useModalStore';
import { usePropertyStore } from '@/stores/usePropertyStore';
import type { Property, PropertyId } from '@/types/property';
import { formatIDR } from '@/utils/money';
import { toast } from 'vue-toastflow';

import GoogleSyncButton from '@/components/GoogleSyncButton.vue';
import AppButton from '@/components/ui/AppButton.vue';
import PageTitle from '@/components/PageTitle.vue';
import CardTitle from '@/components/CardTitle.vue';
import PropertyDataBackup from '@/features/settings/PropertyDataBackup.vue';

const bookingStore = useBookingStore();
const financeStore = useFinanceStore();
const propertyStore = usePropertyStore();
const modalStore = useModalStore();

const { bookings } = storeToRefs(bookingStore);
const { properties, sortedProperties } = storeToRefs(propertyStore);

const { isAuthenticated, refreshAuthStatus } = useGoogleSheets();

onMounted(() => refreshAuthStatus());

function handleAddProperty(): void {
    modalStore.openPropertyModal();
}
function handleEditProperty(property: Property): void {
    modalStore.openPropertyModal({ property });
}
async function handleDeleteProperty(id: PropertyId): Promise<void> {
    const confirmed = window.confirm(
        `Are you sure you want to delete property "${id}"? This will not delete associated bookings in Google Sheets.`
    );
    if (!confirmed) return;

    try {
        await db.properties.delete(id);
        if (
            'loadProperties' in propertyStore &&
            typeof propertyStore.loadProperties === 'function'
        ) {
            await propertyStore.loadProperties();
        } else {
            properties.value = await db.properties.toArray();
        }
        toast.success({
            title: 'Property Removed',
            description: `Property "${id}" removed from local database.`,
        });
    } catch (err) {
        toast.error({
            title: 'Delete Failed',
            description: err instanceof Error ? err.message : 'Database write error.',
        });
    }
}
async function handleClearBookings(): Promise<void> {
    const confirmed = window.confirm(
        'Are you sure you want to clear all local bookings? You can re-import them anytime from Google Sheets.'
    );
    if (!confirmed) return;

    await db.bookings.clear();
    await bookingStore.loadBookings();
    toast.success({
        title: 'Bookings Cleared',
        description: 'IndexedDB bookings table has been cleared.',
    });
}
async function handleClearFinance(): Promise<void> {
    const confirmed = window.confirm(
        'Are you sure you want to clear all local finance? You can re-import them anytime from Google Sheets.'
    );
    if (!confirmed) return;

    await db.propertyFinances.clear();
    await db.personalFinances.clear();
    await db.sharedFinances.clear();
    await db.transfers.clear();
    await db.personalSavings.clear();
    await db.transfers.clear();
    await db.goldAssets.clear();
    await db.recurringTemplates.clear();
    await financeStore.loadLocalFinanceData();
    toast.success({
        title: 'Finance Cleared',
        description: 'IndexedDB finance table has been cleared.',
    });
}
async function handleWipeDatabase(): Promise<void> {
    const confirmed = window.confirm(
        'WARNING: This will erase ALL local properties and bookings. This cannot be undone unless you have a JSON backup.'
    );
    if (!confirmed) return;

    await db.transaction('rw', [db.bookings, db.properties], async () => {
        await db.bookings.clear();
        await db.properties.clear();
    });

    await bookingStore.loadBookings();
    if ('loadProperties' in propertyStore && typeof propertyStore.loadProperties === 'function') {
        await propertyStore.loadProperties();
    } else {
        properties.value = [];
    }

    toast.warning({
        title: 'Database Wiped',
        description: 'All local IndexedDB records have been erased.',
    });
}
</script>

<template>
    <div class="h-full space-y-4 overflow-y-auto p-4">
        <PageTitle>
            <template #title>Settings</template>
            <template #subtitle>
                System integrations, property configurations and database storage
            </template>
        </PageTitle>

        <div class="rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <span
                        class="h-3 w-3 shrink-0 rounded-full"
                        :class="isAuthenticated ? 'animate-pulse bg-lime-400' : 'bg-amber-400'" />
                    <div>
                        <h4 class="text-xs font-semibold text-mist-100">
                            {{
                                isAuthenticated
                                    ? 'OAuth Token Active'
                                    : 'Not Connected / Token Expired'
                            }}
                        </h4>
                        <p class="text-[11px] text-mist-500">
                            {{
                                isAuthenticated
                                    ? 'Valid Google Sheets API session stored locally.'
                                    : 'Connect to allow importing and writing to Google Sheets.'
                            }}
                        </p>
                    </div>
                </div>

                <GoogleSyncButton scope="all" />
            </div>
        </div>

        <!-- Property Management -->
        <div class="flex flex-col">
            <div class="flex items-center justify-between">
                <CardTitle>
                    <template #title>Property Roster</template>
                    <template #subtitle>
                        Configure physical rental units and baseline pricing
                    </template>
                </CardTitle>
                <AppButton
                    label="Add Property"
                    variant="primary"
                    @click="handleAddProperty">
                    <template #icon>
                        <fa-icon
                            class="text-xs"
                            icon="plus" />
                    </template>
                </AppButton>
            </div>

            <!-- Properties -->
            <div class="overflow-hidden rounded-md border border-mist-800 bg-mist-900 shadow-md">
                <div
                    v-if="sortedProperties.length === 0"
                    class="flex flex-col items-center justify-center p-8 text-xs text-mist-400">
                    <fa-icon
                        icon="house"
                        class="mb-1 text-xl text-mist-600" />
                    <p>No properties registered yet. Click "Add Property" to begin.</p>
                </div>
                <table
                    v-else
                    class="w-full table-fixed text-left text-sm text-mist-300">
                    <thead
                        class="border-b border-mist-800 bg-mist-950/50 text-xs font-semibold text-mist-400 uppercase">
                        <tr>
                            <th class="w-32 px-4 py-2.5">ID</th>
                            <th class="px-4 py-2.5">Name</th>
                            <th class="w-40 px-4 py-2.5 text-right">Base Rate</th>
                            <th class="w-48 px-4 py-2.5 text-center">Specs</th>
                            <th class="w-28 px-4 py-2.5 text-center">Status</th>
                            <th class="w-24 px-4 py-2.5 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-mist-800/60">
                        <tr
                            v-for="p in sortedProperties"
                            :key="p.id"
                            class="transition hover:bg-mist-800/30">
                            <td class="truncate px-4 py-3 font-mono text-xs text-lime-400">
                                {{ p.id }}
                            </td>
                            <td class="truncate px-4 py-3 font-medium text-mist-100">
                                <div>{{ p.name }}</div>
                                <div class="truncate text-[11px] text-mist-500">
                                    {{ p.address }}
                                </div>
                            </td>
                            <td class="px-4 py-3 text-right font-mono text-xs">
                                {{ formatIDR(p.price) }}
                            </td>
                            <td class="gap-2 px-4 py-3 text-center text-xs text-mist-400">
                                <fa-icon
                                    icon="bed"
                                    class="text-[11px] text-mist-500" />
                                {{ p.bedrooms }} &bull;
                                <fa-icon
                                    icon="shower"
                                    class="text-[11px] text-mist-500" />
                                {{ p.bathrooms }} &bull;
                                <fa-icon
                                    icon="ruler-combined"
                                    class="text-[11px] text-mist-500" />
                                {{ p.plotSize }}m²
                            </td>
                            <td class="px-4 py-3 text-center">
                                <span
                                    class="rounded px-2 py-0.5 text-[10px] font-semibold uppercase"
                                    :class="
                                        p.available
                                            ? 'border border-lime-500/20 bg-lime-500/10 text-lime-400'
                                            : 'bg-mist-800 text-mist-400'
                                    ">
                                    {{ p.available ? 'Active' : 'Draft' }}
                                </span>
                            </td>
                            <td class="px-4 py-3 text-right">
                                <div class="flex items-center justify-end gap-2">
                                    <AppButton
                                        variant="icon"
                                        @click="handleEditProperty(p)">
                                        <template #icon>
                                            <fa-icon icon="pen-to-square" />
                                        </template>
                                    </AppButton>
                                    <span class="text-mist-700">|</span>
                                    <AppButton
                                        variant="danger-icon"
                                        @click="handleDeleteProperty(p.id)">
                                        <template #icon>
                                            <fa-icon icon="trash-can" />
                                        </template>
                                    </AppButton>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- JSON Backup & Restore Component -->
            <PropertyDataBackup class="mt-4" />
        </div>

        <!-- Danger Zone / Database Maintenance -->
        <div class="flex flex-col">
            <CardTitle>
                <template #title>Database Storage & Cache</template>
                <template #subtitle>Manage client-side IndexedDB records</template>
            </CardTitle>
            <div class="space-y-4 rounded-md border border-rose-500/20 bg-mist-900 p-4 shadow-md">
                <div class="flex items-center justify-between">
                    <div>
                        <h4 class="text-xs font-semibold text-mist-200">Local Bookings Cache</h4>
                        <p class="text-[11px] text-mist-500">
                            Currently storing
                            <span class="text-white">{{ bookings.length }}</span> reservations in
                            local Dexie database.
                        </p>
                    </div>
                    <button
                        type="button"
                        class="cursor-pointer rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20"
                        @click="handleClearBookings">
                        Clear Bookings Cache
                    </button>
                </div>
                <div class="flex items-center justify-between">
                    <div>
                        <h4 class="text-xs font-semibold text-mist-200">Local Finance Cache</h4>
                        <p class="text-[11px] text-mist-500">
                            Permanently purges finances from IndexedDB storage.
                        </p>
                    </div>
                    <button
                        type="button"
                        class="cursor-pointer rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20"
                        @click="handleClearFinance">
                        Clear Finance Cache
                    </button>
                </div>

                <div class="flex items-center justify-between border-t border-mist-800/60 pt-3">
                    <div>
                        <h4 class="text-xs font-semibold text-rose-400">Hard Reset Database</h4>
                        <p class="text-[11px] text-mist-500">
                            Permanently purges both properties and bookings from IndexedDB storage.
                        </p>
                    </div>
                    <button
                        type="button"
                        class="cursor-pointer rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-500"
                        @click="handleWipeDatabase">
                        Purge All Data
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
