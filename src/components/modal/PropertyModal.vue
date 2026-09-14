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

const props = defineProps<{
    propertyToEdit?: Property | null;
    currentProperty?: PropertyId | 'all';
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
    bedrooms: source?.bedrooms ?? 1,
    bathrooms: source?.bathrooms ?? 1,
    plotSize: source?.plotSize ?? 0,
    wifi: {
        ssid: source?.wifi?.ssid || '',
        pwd: source?.wifi?.pwd || '',
    },
    available: source?.available || false,
});

const form = ref<PropertyFormState>(createFormData());

const isEditing = computed(() => Boolean(props.propertyToEdit?.id));

const handleDeleteProperty = async (): Promise<void> => {
    if (!props.propertyToEdit) return;
    if (window.confirm(`Delete property ${props.propertyToEdit}?`)) {
        await propertyStore.deleteProperty(props.propertyToEdit?.id);
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
    () => props.propertyToEdit,
    (newVal) => {
        form.value = createFormData(newVal);
    },
    { immediate: true }
);
</script>

<template>
    <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
        <div
            class="w-full max-w-lg rounded-md border border-mist-800 bg-mist-900 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <!-- Modal Header -->
            <div
                class="flex items-center justify-between border-b border-mist-800 px-6 py-4 bg-mist-950/60">
                <div>
                    <h2 class="text-base font-bold text-mist-100">
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
                    class="rounded-md p-1.5 text-mist-400 hover:bg-mist-800 hover:text-mist-100 transition"
                    @click="emit('close')">
                    <fa-icon
                        icon="xmark"
                        class="text-sm" />
                </button>
            </div>

            <!-- Form Body -->
            <form
                class="p-4 space-y-4 max-h-[80vh] overflow-y-auto"
                @submit.prevent="handleSubmit">
                <!-- Name & Code Prefix -->
                <div class="grid grid-cols-5">
                    <div class="col-span-4">
                        <label class="block text-xs font-semibold text-mist-400 mb-1 ml-1">
                            Property Name
                        </label>
                        <input
                            v-model.trim="form.name"
                            type="text"
                            placeholder="Mai House Jogja - Piyungan"
                            required
                            class="w-full rounded-md border border-mist-800 bg-mist-950 px-3 py-2 text-sm text-mist-100 focus:border-lime-500 focus:outline-none" />
                    </div>
                    <div class="flex flex-col justify-end">
                        <label class="cursor-pointer text-center">
                            <span class="block text-xs font-semibold text-mist-400 mb-1">
                                Available
                            </span>
                            <input
                                v-model="form.available"
                                class="accent-lime-500"
                                type="checkbox"
                                checked />
                        </label>
                    </div>
                </div>

                <!-- Code Prefix & Theme Color -->
                <div class="grid grid-cols-3 gap-3">
                    <div>
                        <label class="block text-xs font-semibold text-mist-400 mb-1 ml-1">
                            Prefix
                        </label>
                        <input
                            v-model.trim="form.codePrefix"
                            type="text"
                            placeholder="MHJ"
                            required
                            class="w-full rounded-md border border-mist-800 bg-mist-950 px-3 py-2 text-sm text-mist-100 uppercase focus:border-lime-500 focus:outline-none" />
                    </div>

                    <div>
                        <label class="block text-xs font-semibold text-mist-400 mb-1 ml-1">
                            Color
                        </label>
                        <div class="flex items-center">
                            <input
                                v-model="form.color"
                                type="color"
                                class="h-9 w-12 cursor-pointer rounded-md border border-mist-800 bg-mist-950 p-1" />
                            <input
                                v-model="form.color"
                                type="text"
                                class="w-full rounded-md border border-mist-800 bg-mist-950 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lime-400" />
                        </div>
                    </div>

                    <div>
                        <label class="block text-xs font-semibold text-mist-400 mb-1 ml-1">
                            Base Price (IDR)
                        </label>
                        <input
                            v-model.number="form.price"
                            type="number"
                            min="0"
                            placeholder="849000"
                            required
                            class="w-full rounded-md border border-mist-800 bg-mist-950 px-3 py-2 text-sm font-mono text-mist-100 focus:border-lime-500 focus:outline-none" />
                    </div>
                </div>

                <!-- Address -->
                <div>
                    <label class="block text-xs font-semibold text-mist-400 mb-1 ml-1">
                        Address
                    </label>
                    <input
                        v-model.trim="form.address"
                        type="text"
                        placeholder="Street, subdistrict, city..."
                        required
                        class="w-full rounded-md border border-mist-800 bg-mist-950 px-3 py-2 text-sm text-mist-100 focus:border-lime-500 focus:outline-none" />
                </div>

                <!-- GPS Coordinates -->
                <div class="rounded-md border border-mist-800 bg-mist-950/40 p-3 space-y-2">
                    <span
                        class="text-[11px] font-bold uppercase tracking-wider text-mist-400 block">
                        GPS Coordinates
                    </span>
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="text-[10px] text-mist-500 block mb-0.5 ml-1"
                                >Latitude</label
                            >
                            <input
                                v-model.number="form.coordinates.lat"
                                type="number"
                                step="any"
                                placeholder="-7.8385"
                                class="w-full rounded bg-mist-950 border border-mist-800 px-2.5 py-1.5 font-mono text-xs text-lime-400 focus:border-lime-500 focus:outline-none" />
                        </div>
                        <div>
                            <label class="text-[10px] text-mist-500 block mb-0.5 ml-1">
                                Longitude
                            </label>
                            <input
                                v-model.number="form.coordinates.lng"
                                type="number"
                                step="any"
                                placeholder="110.4632"
                                class="w-full rounded bg-mist-950 border border-mist-800 px-2.5 py-1.5 font-mono text-xs text-lime-400 focus:border-lime-500 focus:outline-none" />
                        </div>
                    </div>
                </div>

                <!-- Bedrooms & Bathrooms -->
                <div class="grid grid-cols-3 gap-3">
                    <div>
                        <label class="block text-xs font-semibold text-mist-400 mb-1 ml-1">
                            Bedrooms
                        </label>
                        <input
                            v-model.number="form.bedrooms"
                            type="number"
                            min="0"
                            class="w-full rounded-md border border-mist-800 bg-mist-950 px-3 py-2 text-sm font-mono text-mist-100 focus:border-lime-500 focus:outline-none" />
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-mist-400 mb-1 ml-1">
                            Bathrooms
                        </label>
                        <input
                            v-model.number="form.bathrooms"
                            type="number"
                            min="0"
                            class="w-full rounded-md border border-mist-800 bg-mist-950 px-3 py-2 text-sm font-mono text-mist-100 focus:border-lime-500 focus:outline-none" />
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-mist-400 mb-1 ml-1">
                            Plot Size m²
                        </label>
                        <input
                            v-model.number="form.plotSize"
                            type="number"
                            min="0"
                            placeholder="120"
                            class="w-full rounded-md border border-mist-800 bg-mist-950 px-3 py-2 text-sm font-mono text-mist-100 focus:border-lime-500 focus:outline-none" />
                    </div>
                </div>

                <!-- Guest Wi-Fi Credentials -->
                <div class="rounded-md border border-mist-800 bg-mist-950/40 p-3 space-y-2">
                    <span
                        class="text-[11px] font-bold uppercase tracking-wider text-mist-400 block">
                        Guest Wi-Fi Details
                    </span>
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="text-[10px] text-mist-500 block mb-0.5 ml-1">
                                Network (SSID)
                            </label>
                            <input
                                v-model.trim="form.wifi.ssid"
                                type="text"
                                placeholder="network-ssid"
                                class="w-full rounded bg-mist-950 border border-mist-800 px-2.5 py-1.5 text-xs text-mist-100 focus:border-lime-500 focus:outline-none" />
                        </div>
                        <div>
                            <label class="text-[10px] text-mist-500 block mb-0.5 ml-1">
                                Password
                            </label>
                            <input
                                v-model.trim="form.wifi.pwd"
                                type="text"
                                placeholder="wifi-passwd"
                                class="w-full rounded bg-mist-950 border border-mist-800 px-2.5 py-1.5 text-xs text-mist-100 focus:border-lime-500 focus:outline-none" />
                        </div>
                    </div>
                </div>

                <!-- Modal Actions -->
                <div
                    class="flex items-center gap-3 pt-4 border-t border-mist-800"
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
                            class="rounded-md border border-mist-800 px-4 py-2 text-xs font-semibold text-mist-300 hover:bg-mist-800 transition"
                            @click="emit('close')">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            class="rounded-md bg-lime-500 px-5 py-2 text-xs font-bold text-mist-950 hover:bg-lime-400 transition shadow-md">
                            {{ isEditing ? 'Save Changes' : 'Create Property' }}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    </div>
</template>
