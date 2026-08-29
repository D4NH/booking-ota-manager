import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { db } from '@/db';
import type { Property, PropertyId } from '@/types/properties';

export const usePropertyStore = defineStore('property', () => {
    const properties = ref<Property[]>([]);
    const preferredOrder = ['piyungan', 'wonosari', 'bantul'];

    // Load all properties from IndexedDB
    const loadProperties = async (): Promise<void> => {
        properties.value = await db.properties.toArray();
    };

    // Sorted properties computed (piyungan -> wonosari -> bantul -> fallback)
    const sortedProperties = computed(() => {
        return [...properties.value].sort((a, b) => {
            const indexA = preferredOrder.indexOf(a.id);
            const indexB = preferredOrder.indexOf(b.id);
            const rankA = indexA === -1 ? 999 : indexA;
            const rankB = indexB === -1 ? 999 : indexB;
            return rankA - rankB;
        });
    });

    // Add or update property
    const saveProperty = async (propertyData: Property): Promise<void> => {
        const existing = await db.properties.get(propertyData.id);
        if (existing) {
            await db.properties.put({ ...existing, ...propertyData });
        } else {
            await db.properties.add(propertyData);
        }
        await loadProperties();
    };

    // Delete single property
    const deleteProperty = async (id: PropertyId): Promise<void> => {
        await db.properties.delete(id);
        await loadProperties();
    };

    // Clear all local properties
    const clearAllProperties = async (): Promise<void> => {
        await db.properties.clear();
        await loadProperties();
    };

    return {
        properties,
        sortedProperties,
        loadProperties,
        saveProperty,
        deleteProperty,
        clearAllProperties,
    };
});
