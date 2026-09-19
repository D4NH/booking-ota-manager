<script setup lang="ts">
import { ref } from 'vue';
import { storeToRefs } from 'pinia';
import { db } from '@/db';
import { usePropertyStore } from '@/stores/usePropertyStore';
import type { Property } from '@/types/property';
import { getCurrentDate } from '@/utils/date';
import { toast } from 'vue-toastflow';

interface PropertyBackupPayload {
    version: number;
    exportedAt: string;
    properties: Property[];
}

const propertyStore = usePropertyStore();
const { properties } = storeToRefs(propertyStore);

const fileInputRef = ref<HTMLInputElement | null>(null);
const isImporting = ref(false);

/**
 * Type guard validating uploaded JSON records match Property interface
 */
const isValidProperty = (obj: unknown): obj is Property => {
    if (!obj || typeof obj !== 'object') return false;
    const p = obj as Record<string, unknown>;

    return (
        typeof p.id === 'string' &&
        typeof p.name === 'string' &&
        typeof p.address === 'string' &&
        typeof p.price === 'number' &&
        typeof p.codePrefix === 'string' &&
        typeof p.color === 'string' &&
        typeof p.bedrooms === 'number' &&
        typeof p.bathrooms === 'number' &&
        typeof p.plotSize === 'number' &&
        typeof p.available === 'boolean'
    );
};
/**
 * Generates and downloads formatted JSON backup
 */
const exportProperties = (): void => {
    try {
        const backupData: PropertyBackupPayload = {
            version: 1,
            exportedAt: new Date().toISOString(),
            properties: properties.value,
        };

        const blob = new Blob([JSON.stringify(backupData, null, 2)], {
            type: 'application/json',
        });

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `property-backup-${getCurrentDate()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.success({
            title: 'Export Succeeded',
            description: `Exported ${properties.value.length} properties to JSON file.`,
        });
    } catch (err) {
        toast.error({
            title: 'Export Failed',
            description: err instanceof Error ? err.message : 'Failed to generate file.',
        });
    }
};
const triggerFileInput = (): void => {
    fileInputRef.value?.click();
};
/**
 * Validates, loads, and writes imported properties to Dexie database
 */
const handleFileChange = async (event: Event): Promise<void> => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    isImporting.value = true;

    try {
        const text = await file.text();
        const parsed: unknown = JSON.parse(text);

        // Support both raw array and versioned backup format
        const candidateList: unknown =
            typeof parsed === 'object' && parsed !== null && 'properties' in parsed
                ? (parsed as PropertyBackupPayload).properties
                : parsed;

        if (!Array.isArray(candidateList)) {
            throw new Error('Invalid file structure: Expected an array of properties.');
        }

        const validProperties: Property[] = [];
        for (let i = 0; i < candidateList.length; i++) {
            const item = candidateList[i];
            if (isValidProperty(item)) {
                validProperties.push(item);
            } else {
                throw new Error(`Record at index ${i} failed validation (missing required keys).`);
            }
        }

        if (validProperties.length === 0) {
            throw new Error('No valid property records found in file.');
        }

        await db.properties.bulkPut(validProperties);

        if (
            'loadProperties' in propertyStore &&
            typeof propertyStore.loadProperties === 'function'
        ) {
            await propertyStore.loadProperties();
        } else {
            properties.value = await db.properties.toArray();
        }

        toast.success({
            title: 'Import Succeeded',
            description: `Imported and restored ${validProperties.length} properties.`,
        });
    } catch (err) {
        toast.error({
            title: 'Import Failed',
            description: err instanceof Error ? err.message : 'Invalid JSON file.',
        });
    } finally {
        isImporting.value = false;
        target.value = '';
    }
};
</script>

<template>
    <div class="rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md space-y-3">
        <div class="flex items-center justify-between">
            <div>
                <h3 class="text-xs font-bold uppercase tracking-wider text-mist-200">
                    Property Data Backup
                </h3>
                <p class="text-xs text-mist-500 mt-1">
                    Save local unit configurations or restore from JSON backup.
                </p>
            </div>
            <span
                class="rounded bg-mist-800 px-2 py-0.5 font-mono text-[11px] font-bold text-mist-300">
                {{ properties.length }} Active Units
            </span>
        </div>

        <div class="flex items-center gap-3 pt-1">
            <input
                ref="fileInputRef"
                type="file"
                accept="application/json"
                class="hidden"
                @change="handleFileChange" />
            <button
                type="button"
                class="cursor-pointer flex items-center gap-2 rounded-md border border-mist-800 bg-mist-800 px-3 py-1.5 text-xs font-bold text-mist-200 hover:border-mist-600 hover:text-white transition"
                @click="exportProperties">
                <fa-icon
                    icon="download"
                    class="text-xs" />
                <span>Export JSON</span>
            </button>
            <button
                type="button"
                :disabled="isImporting"
                class="cursor-pointer flex items-center gap-2 rounded-md border border-mist-800 bg-mist-800 px-3 py-1.5 text-xs font-bold text-mist-200 hover:border-mist-600 hover:text-white transition disabled:opacity-50"
                @click="triggerFileInput">
                <fa-icon
                    :icon="isImporting ? 'spinner' : 'upload'"
                    :class="isImporting ? 'animate-spin text-lime-400' : 'text-xs'" />
                <span>{{ isImporting ? 'Importing...' : 'Import JSON' }}</span>
            </button>
        </div>
    </div>
</template>
