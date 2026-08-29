<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { usePropertyStore } from '@/stores/usePropertyStore';
import type { PropertyId } from '@/types/property';

const propertyStore = usePropertyStore();
const { sortedProperties } = storeToRefs(propertyStore);

const handleDeleteProperty = async (id: PropertyId, name: string): Promise<void> => {
    if (window.confirm(`Delete property ${name}?`)) {
        await propertyStore.deleteProperty(id);
    }
};
</script>

<template>
    <div class="space-y-6">
        <div class="flex items-center justify-between">
            <div>
                <h1 class="text-xl font-bold text-mist-100">Properties</h1>
                <p class="text-xs text-mist-400">Managed Homestays & Villas</p>
            </div>
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div
                v-for="prop in sortedProperties"
                :key="prop.id"
                class="rounded-lg border border-mist-800 bg-mist-900 p-5 space-y-3">
                <div class="flex items-center justify-between">
                    <span
                        class="h-3 w-3 rounded-full"
                        :style="{ backgroundColor: prop.color || '#016730' }"></span>
                    <span class="font-mono text-xs font-bold text-mist-400">{{
                        prop.codePrefix
                    }}</span>
                </div>

                <div>
                    <h2 class="text-base font-bold text-mist-100">{{ prop.name }}</h2>
                    <p class="text-xs text-mist-400 capitalize">{{ prop.id }}</p>
                </div>

                <p class="text-xs text-mist-500 line-clamp-2">{{ prop.address }}</p>

                <div class="flex justify-end pt-2 border-t border-mist-800/60">
                    <button
                        type="button"
                        class="text-xs text-rose-400 hover:text-rose-300"
                        @click="handleDeleteProperty(prop.id, prop.name)">
                        Delete
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
