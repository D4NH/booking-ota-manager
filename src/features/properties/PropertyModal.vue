<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { usePropertyStore } from '@/stores/usePropertyStore';
import type { Property, PropertyId } from '@/types/property';

interface PropertyFormState extends Omit<Property, 'coordinates' | 'wifi'> {
    coordinates: {
        lat: number;
        lng: number;
    };
    wifi: {
        ssid: string;
        pwd: string;
    };
}

const { propertyToEdit = null } = defineProps<{
    propertyToEdit?: Property | null;
}>();

const emit = defineEmits<{
    close: [];
    save: [payload: Property];
}>();

const propertyStore = usePropertyStore();

const createFormData = (source?: Partial<Property> | null): PropertyFormState => ({
    id: source?.id || ('' as PropertyId),
    name: source?.name || '',
    address: source?.address || '',
    coordinates: {
        lat: source?.coordinates?.lat ?? 0,
        lng: source?.coordinates?.lng ?? 0,
    },
    color: source?.color || '#a3e635',
    price: source?.price ?? 0,
    codePrefix: source?.codePrefix || '',
    bedrooms: source?.bedrooms ?? 0,
    bathrooms: source?.bathrooms ?? 0,
    plotSize: source?.plotSize ?? 0,
    wifi: {
        ssid: source?.wifi?.ssid || '',
        pwd: source?.wifi?.pwd || '',
    },
    available: source?.available || false,
});

const form = ref<PropertyFormState>(createFormData());

const isEditing = computed(() => Boolean(propertyToEdit?.id));

const sanitizePrice = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const cleanedString = target.value.replace(/\D/g, '');
    form.value.price = cleanedString ? parseInt(cleanedString, 10) : 0;
    target.value = cleanedString;
};
const handleDeleteProperty = async (): Promise<void> => {
    if (!propertyToEdit) return;
    if (window.confirm(`Delete property ${propertyToEdit}?`)) {
        await propertyStore.deleteProperty(propertyToEdit?.id);
        emit('close');
    }
};
const handleSubmit = () => {
    if (!form.value.name || !form.value.codePrefix) return;

    const generatedId = (form.value.id ||
        form.value.name
            .toLowerCase()
            .split('-')[1]
            ?.replace(/[^a-z0-9]/g, '')) as PropertyId;

    const payload: Property = {
        ...form.value,
        id: generatedId,
    };

    emit('save', payload);
    emit('close');
};

watch(
    () => propertyToEdit,
    (newVal) => {
        form.value = createFormData(newVal);
    },
    { immediate: true }
);
</script>

<template>
    <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-mist-950/75 p-4 backdrop-blur-sm">
        <div
            class="w-full max-w-2xl rounded-md border border-mist-800 bg-mist-900 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 space-y-4 p-4">
            <!-- Modal Header -->
            <div
                class="flex items-center justify-between border-b border-mist-800 -mt-4 -mr-4 -ml-4 p-4 bg-mist-950/60">
                <div>
                    <h2 class="text-base font-semibold text-mist-100">
                        {{ isEditing ? 'Edit Property' : 'Add New Property' }}
                    </h2>
                    <p
                        v-if="isEditing"
                        class="text-xs text-mist-400">
                        ID: {{ form.id }}
                    </p>
                    <p
                        v-else
                        class="text-xs text-mist-400">
                        Manage listing details, pricing, and access
                    </p>
                </div>
                <button
                    type="button"
                    class="cursor-pointer text-mist-400 hover:text-mist-200"
                    @click="emit('close')">
                    <fa-icon
                        icon="xmark"
                        class="text-sm" />
                </button>
            </div>

            <form
                class="max-h-[80vh] overflow-y-auto space-y-4"
                @submit.prevent="handleSubmit">
                <!-- Name & Code Prefix -->
                <div class="grid grid-cols-9 items-end">
                    <div class="w-full col-span-8">
                        <label
                            for="property"
                            class="block font-medium text-xs text-mist-400 mb-1">
                            Property
                        </label>
                        <div class="relative rounded-md shadow-sm">
                            <div
                                class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-mist-500">
                                <fa-icon
                                    class="text-xs"
                                    icon="house" />
                            </div>
                            <input
                                v-model.trim="form.name"
                                type="text"
                                placeholder="Mai House Jogja - Piyungan"
                                required
                                class="block w-full py-1 pl-9 pr-3 rounded-md border border-mist-800 bg-mist-950/50 focus:border-lime-500 focus:outline-none transition-colors text-mist-200 sm:text-sm sm:leading-6" />
                        </div>
                    </div>
                    <div class="text-center">
                        <label class="cursor-pointer block text-xs font-semibold text-mist-400">
                            Available
                        </label>
                        <input
                            v-model="form.available"
                            class="mt-1 accent-lime-500"
                            type="checkbox"
                            checked />
                    </div>
                </div>

                <!-- Code Prefix & Theme Color -->
                <div class="grid grid-cols-3 gap-3">
                    <div class="w-full">
                        <label
                            for="prefix"
                            class="block font-medium text-xs text-mist-400 mb-1">
                            Prefix
                        </label>
                        <div class="relative rounded-md shadow-sm">
                            <input
                                id="prefix"
                                v-model.trim="form.codePrefix"
                                type="text"
                                name="prefix"
                                class="block w-full py-1 px-3 rounded-md border border-mist-800 bg-mist-950/50 focus:border-lime-500 focus:outline-none transition-colors font-mono text-mist-200 sm:text-sm sm:leading-6"
                                placeholder="MHJ" />
                        </div>
                    </div>
                    <div class="w-full">
                        <label
                            for="color"
                            class="block font-medium text-xs text-mist-400 mb-1">
                            Color
                        </label>
                        <div class="relative flex items-center gap-0.5">
                            <input
                                v-model="form.color"
                                type="color"
                                class="h-8.5 w-12 py-1 px-1 cursor-pointer rounded-md border border-mist-800 bg-mist-950/50" />
                            <input
                                id="color"
                                v-model="form.color"
                                name="color"
                                class="block w-full py-1 px-3 rounded-md border border-mist-800 bg-mist-950/50 focus:border-lime-500 focus:outline-none transition-colors font-mono text-mist-200 sm:text-sm sm:leading-6" />
                        </div>
                    </div>
                    <div class="w-full">
                        <label
                            for="price"
                            class="block font-medium text-xs text-mist-400 mb-1">
                            Base Price (IDR)
                        </label>
                        <div class="relative rounded-md shadow-sm">
                            <div
                                class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-mist-500">
                                <fa-icon
                                    class="text-xs"
                                    icon="rupiah-sign" />
                            </div>
                            <input
                                id="price"
                                :value="form.price"
                                type="number"
                                name="price"
                                class="block w-full py-1 pl-9 pr-3 rounded-md border border-mist-800 bg-mist-950/50 focus:border-lime-500 focus:outline-none transition-colors font-mono text-mist-200 sm:text-sm sm:leading-6"
                                placeholder="1000000"
                                @input="sanitizePrice" />
                        </div>
                    </div>
                </div>

                <!-- Address -->
                <div class="w-full">
                    <label
                        for="address"
                        class="block font-medium text-xs text-mist-400 mb-1">
                        Address
                    </label>
                    <div class="relative rounded-md shadow-sm">
                        <input
                            id="address"
                            v-model="form.address"
                            type="text"
                            name="address"
                            class="block w-full py-1 px-3 rounded-md border border-mist-800 bg-mist-950/50 focus:border-lime-500 focus:outline-none transition-colors text-mist-200 sm:text-sm sm:leading-6"
                            placeholder="Street, subdistrict, city" />
                    </div>
                </div>

                <!-- GPS Coordinates -->
                <div class="rounded-md border border-mist-800 bg-mist-950/40 p-3 space-y-2">
                    <span
                        class="text-[11px] font-semibold uppercase tracking-wider text-mist-400 block">
                        GPS Coordinates
                    </span>
                    <div class="grid grid-cols-2 gap-3">
                        <div class="w-full">
                            <label
                                for="lat"
                                class="block text-xs text-mist-400 mb-1">
                                Latitude
                            </label>
                            <div class="relative rounded-md shadow-sm">
                                <input
                                    id="lat"
                                    v-model.number="form.coordinates.lat"
                                    type="number"
                                    name="lat"
                                    class="block w-full py-1 px-3 rounded-md border border-mist-800 bg-mist-950/50 focus:border-lime-500 focus:outline-none transition-colors font-mono text-mist-200 sm:text-sm sm:leading-6"
                                    placeholder="Relocating funds" />
                            </div>
                        </div>
                        <div class="w-full">
                            <label
                                for="lng"
                                class="block text-xs text-mist-400 mb-1">
                                Longitude
                            </label>
                            <div class="relative rounded-md shadow-sm">
                                <input
                                    id="lng"
                                    v-model.number="form.coordinates.lng"
                                    type="number"
                                    name="lng"
                                    class="block w-full py-1 px-3 rounded-md border border-mist-800 bg-mist-950/50 focus:border-lime-500 focus:outline-none transition-colors font-mono text-mist-200 sm:text-sm sm:leading-6"
                                    placeholder="Relocating funds" />
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Bedrooms & Bathrooms -->
                <div class="grid grid-cols-3 gap-3">
                    <div class="w-full">
                        <label
                            for="bedroom"
                            class="block font-medium text-xs text-mist-400 mb-1">
                            Bedrooms
                        </label>
                        <div class="relative rounded-md shadow-sm">
                            <div
                                class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-mist-500">
                                <fa-icon
                                    class="text-xs"
                                    icon="bed" />
                            </div>
                            <input
                                id="bedroom"
                                v-model.number="form.bedrooms"
                                type="text"
                                name="bedroom"
                                min="0"
                                class="block w-full py-1 pl-9 pr-3 rounded-md border border-mist-800 bg-mist-950/50 focus:border-lime-500 focus:outline-none transition-colors font-mono text-mist-200 sm:text-sm sm:leading-6"
                                placeholder="3" />
                        </div>
                    </div>

                    <div class="w-full">
                        <label
                            for="shower"
                            class="block font-medium text-xs text-mist-400 mb-1">
                            Bathrooms
                        </label>
                        <div class="relative rounded-md shadow-sm">
                            <div
                                class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-mist-500">
                                <fa-icon
                                    class="text-xs"
                                    icon="shower" />
                            </div>
                            <input
                                id="shower"
                                v-model.number="form.bathrooms"
                                type="text"
                                min="0"
                                name="shower"
                                class="block w-full py-1 pl-9 pr-3 rounded-md border border-mist-800 bg-mist-950/50 focus:border-lime-500 focus:outline-none transition-colors font-mono text-mist-200 sm:text-sm sm:leading-6"
                                placeholder="2" />
                        </div>
                    </div>

                    <div class="w-full">
                        <label
                            for="size"
                            class="block font-medium text-xs text-mist-400 mb-1">
                            Plot Size m²
                        </label>
                        <div class="relative rounded-md shadow-sm">
                            <div
                                class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-mist-500">
                                <fa-icon
                                    class="text-xs"
                                    icon="ruler-combined" />
                            </div>
                            <input
                                id="shower"
                                v-model.number="form.plotSize"
                                type="text"
                                min="0"
                                name="shower"
                                class="block w-full py-1 pl-9 pr-3 rounded-md border border-mist-800 bg-mist-950/50 focus:border-lime-500 focus:outline-none transition-colors font-mono text-mist-200 sm:text-sm sm:leading-6"
                                placeholder="120" />
                        </div>
                    </div>
                </div>

                <!-- Guest Wi-Fi Credentials -->
                <div class="rounded-md border border-mist-800 bg-mist-950/40 p-3 space-y-2">
                    <span
                        class="text-[11px] font-semibold uppercase tracking-wider text-mist-400 block">
                        Guest Wi-Fi Details
                    </span>
                    <div class="grid grid-cols-2 gap-3">
                        <div class="w-full">
                            <label
                                for="ssid"
                                class="block text-xs text-mist-400 mb-1">
                                Network (SSID)
                            </label>
                            <div class="relative rounded-md shadow-sm">
                                <input
                                    id="ssid"
                                    v-model.trim="form.wifi.ssid"
                                    type="text"
                                    name="ssid"
                                    class="block w-full py-1 px-3 rounded-md border border-mist-800 bg-mist-950/50 focus:border-lime-500 focus:outline-none transition-colors text-mist-200 sm:text-sm sm:leading-6"
                                    placeholder="SSID" />
                            </div>
                        </div>

                        <div class="w-full">
                            <label
                                for="pwd"
                                class="block text-xs text-mist-400 mb-1">
                                Password
                            </label>
                            <div class="relative rounded-md shadow-sm">
                                <input
                                    id="pwd"
                                    v-model.trim="form.wifi.pwd"
                                    type="text"
                                    name="pwd"
                                    class="block w-full py-1 px-3 rounded-md border border-mist-800 bg-mist-950/50 focus:border-lime-500 focus:outline-none transition-colors font-mono text-mist-200 sm:text-sm sm:leading-6"
                                    placeholder="P4ssW0rd!" />
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Modal Actions -->
                <div
                    class="flex items-center gap-3"
                    :class="[isEditing ? 'justify-between' : 'justify-end']">
                    <button
                        v-if="isEditing"
                        type="button"
                        class="cursor-pointer py-2 text-xs font-semibold text-rose-400 hover:text-rose-300"
                        @click="handleDeleteProperty">
                        <fa-icon icon="trash-can" /> Delete Property
                    </button>
                    <div class="flex items-center gap-4">
                        <button
                            type="button"
                            class="cursor-pointer px-4 py-2 text-xs font-semibold text-mist-400 hover:text-mist-200"
                            @click="emit('close')">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            class="cursor-pointer rounded-md bg-lime-500 px-4 py-2 text-xs font-semibold text-mist-950 transition hover:bg-lime-400 disabled:cursor-not-allowed disabled:opacity-50">
                            {{ isEditing ? 'Save Changes' : 'Create Property' }}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    </div>
</template>
