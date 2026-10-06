<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { PROPERTY_LIST } from '@/config/properties';
import type { PropertyId } from '@/types/property';
import FinancePropertyMetrics from '@/features/finance/PropertyMetrics.vue';
import FinancePropertyTable from '@/features/finance/PropertyTable.vue';
import FinancePropertyBreakdown from '@/features/finance/PropertyBreakdown.vue';
import PropertyCashFlow from '@/features/finance/PropertyCashFlow.vue';

interface PropertyTabOption {
    id: PropertyId;
    label: string;
}

const PROPERTY_TABS: readonly PropertyTabOption[] = PROPERTY_LIST.map((p) => ({
    id: p.id,
    label: p.name.replace('Mai House Jogja - ', '').replace('Mai House Bali - ', ''),
}));

const route = useRoute();
const router = useRouter();

const selectedProperty = computed<PropertyId>(() => {
    const queryProp = String(route.query.property || '').toLowerCase();
    const match = PROPERTY_TABS.find((t) => t.id === queryProp);
    return match ? match.id : 'piyungan';
});

function handlePropertyChange(propId: PropertyId): void {
    router.replace({
        query: {
            ...route.query,
            property: propId === 'piyungan' ? undefined : propId,
        },
    });
}
</script>

<template>
    <div class="-mt-4 space-y-4">
        <div
            class="sticky -top-4 z-20 -mx-4 flex items-center justify-between bg-mist-900/25 px-4 py-2.5 backdrop-blur-lg">
            <div
                class="flex items-center overflow-x-auto rounded-md border border-mist-800 bg-mist-950/50 p-0.5 text-xs select-none">
                <button
                    v-for="tab in PROPERTY_TABS"
                    :key="tab.id"
                    type="button"
                    class="flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold transition"
                    :class="[
                        selectedProperty === tab.id
                            ? 'border border-mist-700/80 bg-mist-800 text-lime-400 shadow-sm'
                            : 'border border-transparent text-mist-400 hover:text-mist-200',
                    ]"
                    @click="handlePropertyChange(tab.id)">
                    <span>{{ tab.label }}</span>
                </button>
            </div>
        </div>

        <FinancePropertyMetrics
            :key="`metrics-${selectedProperty}`"
            class="-mt-2"
            :property-id="selectedProperty" />

        <div class="grid h-105 grid-cols-1 gap-4 lg:grid-cols-2">
            <FinancePropertyBreakdown
                :key="`breakdown-${selectedProperty}`"
                :property-id="selectedProperty" />
            <PropertyCashFlow
                :key="`cashflow-${selectedProperty}`"
                :property-id="selectedProperty" />
        </div>

        <FinancePropertyTable
            :key="`table-${selectedProperty}`"
            :property-id="selectedProperty"
            class="max-h-162" />
    </div>
</template>
