import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { db } from '@/db';
import type { Property, PropertyId } from '@/types/property';

import { toast } from 'vue-toastflow';

const toastConfig = {
    loading: {
        title: 'Saving property...',
        description: 'Please wait.',
    },
    success: {
        title: 'Success!',
        description: 'Property saved successfully.',
    },
    error: {
        title: 'Error',
        description: 'Failed to save the property.',
    },
};

export const usePropertyStore = defineStore('property', () => {
    const preferredOrder: PropertyId[] = ['piyungan', 'wonosari', 'bantul', 'nusadua'];

    const properties = ref<Property[]>([]);

    const sortedProperties = computed(() => {
        return [...properties.value].sort((a, b) => {
            const indexA = preferredOrder.indexOf(a.id);
            const indexB = preferredOrder.indexOf(b.id);
            const rankA = indexA === -1 ? 999 : indexA;
            const rankB = indexB === -1 ? 999 : indexB;
            return rankA - rankB;
        });
    });

    async function loadProperties(): Promise<void> {
        properties.value = await db.properties.toArray();
    }
    async function addProperty(property: Property): Promise<void> {
        const plainRecord = JSON.parse(JSON.stringify(property));

        await db.properties.add(plainRecord);
        await loadProperties();
    }
    async function saveProperty(propertyData: Property): Promise<void> {
        await toast.loading(async () => {
            const cleanProperty = JSON.parse(JSON.stringify(propertyData));

            await db.properties.put(cleanProperty);
            await loadProperties();
        }, toastConfig);
    }
    async function deleteProperty(id: PropertyId): Promise<void> {
        await db.properties.delete(id);
        await loadProperties();
    }
    async function clearAllProperties(): Promise<void> {
        await db.properties.clear();
        await loadProperties();
    }

    return {
        properties,
        sortedProperties,
        loadProperties,
        addProperty,
        saveProperty,
        deleteProperty,
        clearAllProperties,
    };
});
