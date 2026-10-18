<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { usePropertyStore } from '@/stores/usePropertyStore';
import type { Property, PropertyId } from '@/types/property';
import AppButton from '@/components/ui/AppButton.vue';
import TextInput from '@/components/ui/TextInput.vue';

interface PropertyFormState extends Omit<Property, 'coordinates' | 'wifi'> {
    coordinates: {
        lat: number | '';
        lng: number | '';
    };
    wifi: {
        ssid: string;
        pwd: string;
    };
}

interface Props {
    propertyToEdit?: Property | null;
}

function createFormData(source?: Partial<Property> | null): PropertyFormState {
    return {
        id: source?.id || ('' as PropertyId),
        name: source?.name || '',
        address: source?.address || '',
        coordinates: {
            lat: source?.coordinates?.lat ?? '',
            lng: source?.coordinates?.lng ?? '',
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
    };
}

const { propertyToEdit = null } = defineProps<Props>();
const emit = defineEmits<{
    close: [];
    save: [payload: Property];
}>();

const propertyStore = usePropertyStore();

const form = ref<PropertyFormState>(createFormData(propertyToEdit));

const isEditing = computed<boolean>(() => Boolean(propertyToEdit?.id));

watch(
    () => propertyToEdit,
    (newVal) => {
        form.value = createFormData(newVal);
    },
    { immediate: true }
);

async function handleDeleteProperty(): Promise<void> {
    if (!propertyToEdit?.id) return;
    if (window.confirm(`Delete property ${propertyToEdit.name}?`)) {
        await propertyStore.deleteProperty(propertyToEdit.id);
        emit('close');
    }
}

function handleSubmit(): void {
    if (!form.value.name || !form.value.codePrefix) return;

    const generatedId = (form.value.id ||
        form.value.name
            .toLowerCase()
            .split('-')[1]
            ?.replace(/[^a-z0-9]/g, '')) as PropertyId;

    const latVal = form.value.coordinates.lat;
    const lngVal = form.value.coordinates.lng;

    const hasCoordinates =
        latVal !== '' &&
        lngVal !== '' &&
        !Number.isNaN(Number(latVal)) &&
        !Number.isNaN(Number(lngVal));

    const coordinates = hasCoordinates
        ? {
              lat: Number(latVal),
              lng: Number(lngVal),
          }
        : undefined;

    const payload: Property = {
        ...form.value,
        id: generatedId,
        coordinates,
    };

    emit('save', payload);
    emit('close');
}
</script>

<template>
    <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-mist-950/75 p-4 backdrop-blur-sm">
        <div
            class="w-full max-w-2xl animate-in space-y-4 overflow-hidden rounded-md border border-mist-800 bg-mist-900 p-4 shadow-md duration-150 zoom-in-95 fade-in">
            <!-- Modal Header -->
            <div
                class="-mt-4 -mr-4 -ml-4 flex items-center justify-between border-b border-mist-800 bg-mist-950/60 p-4">
                <div>
                    <h2 class="text-base font-semibold">
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
                <AppButton
                    variant="icon"
                    @click="emit('close')">
                    <template #icon>
                        <fa-icon icon="xmark" />
                    </template>
                </AppButton>
            </div>

            <form
                class="max-h-[80vh] space-y-4 overflow-y-auto"
                @submit.prevent="handleSubmit">
                <!-- Name & Code Prefix -->
                <div class="grid grid-cols-9 items-end">
                    <div class="col-span-8 w-full">
                        <TextInput
                            id="name"
                            v-model="form.name"
                            input-label="Property Name"
                            type="text"
                            placeholder="Mai House Jogja - Area"
                            required>
                            <template #icon>
                                <fa-icon
                                    icon="house"
                                    class="text-xs" />
                            </template>
                        </TextInput>
                    </div>
                    <div class="text-center">
                        <label class="block cursor-pointer text-xs font-semibold text-mist-400">
                            Available
                        </label>
                        <input
                            v-model="form.available"
                            class="mt-1 accent-lime-500"
                            type="checkbox" />
                    </div>
                </div>

                <!-- Code Prefix & Theme Color -->
                <div class="grid grid-cols-3 gap-3">
                    <TextInput
                        id="prefix"
                        v-model.trim="form.codePrefix"
                        input-label="Prefix"
                        type="text"
                        placeholder="MHJ"
                        required>
                        <template #icon>
                            <fa-icon
                                icon="hashtag"
                                class="text-xs" />
                        </template>
                    </TextInput>
                    <div class="w-full">
                        <label
                            for="color"
                            class="mb-1 block text-xs font-medium text-mist-400">
                            Color
                        </label>
                        <div class="relative flex items-center gap-0.5">
                            <input
                                v-model="form.color"
                                type="color"
                                class="h-8.5 w-12 cursor-pointer rounded-md border border-mist-800 bg-mist-950/50 px-1 py-1" />
                            <input
                                id="color"
                                v-model="form.color"
                                name="color"
                                class="block w-full rounded-md border border-mist-800 bg-mist-950/50 px-3 py-1 font-mono text-mist-200 transition-colors focus:border-lime-500 focus:outline-none sm:text-sm sm:leading-6" />
                        </div>
                    </div>
                    <TextInput
                        id="price"
                        v-model.number.trim="form.price"
                        input-label="Base Price (IDR)"
                        type="number"
                        min="1"
                        placeholder="1.000.000"
                        required>
                        <template #icon>
                            <fa-icon
                                icon="rupiah-sign"
                                class="text-xs" />
                        </template>
                    </TextInput>
                </div>

                <TextInput
                    id="address"
                    v-model="form.address"
                    input-label="Address"
                    type="text"
                    placeholder="Street, subdistrict, city"
                    required>
                    <template #icon>
                        <fa-icon
                            icon="map-marker-alt"
                            class="text-xs" />
                    </template>
                </TextInput>

                <!-- GPS Coordinates -->
                <div class="space-y-2 rounded-md border border-mist-800 bg-mist-950/40 p-3">
                    <span
                        class="block text-[11px] font-semibold tracking-wider text-mist-400 uppercase">
                        GPS Coordinates
                    </span>
                    <div class="grid grid-cols-2 gap-3">
                        <TextInput
                            id="lat"
                            v-model.number="form.coordinates.lat"
                            input-label="Latitude"
                            type="number"
                            step="any"
                            placeholder="-7.8512" />
                        <TextInput
                            id="long"
                            v-model.number="form.coordinates.lng"
                            input-label="Longitude"
                            type="number"
                            step="any"
                            placeholder="110.395" />
                    </div>
                </div>

                <!-- Bedrooms & Bathrooms -->
                <div class="grid grid-cols-3 gap-3">
                    <TextInput
                        id="bedrooms"
                        v-model.number.trim="form.bedrooms"
                        input-label="Bedrooms"
                        type="number"
                        placeholder="1"
                        min="1"
                        required>
                        <template #icon>
                            <fa-icon
                                icon="bed"
                                class="text-xs" />
                        </template>
                    </TextInput>
                    <TextInput
                        id="bathrooms"
                        v-model.number.trim="form.bathrooms"
                        input-label="Bathrooms"
                        type="number"
                        placeholder="1"
                        min="1"
                        required>
                        <template #icon>
                            <fa-icon
                                icon="shower"
                                class="text-xs" />
                        </template>
                    </TextInput>
                    <TextInput
                        id="size"
                        v-model.number.trim="form.plotSize"
                        input-label="Plot Size m²"
                        type="number"
                        placeholder="100"
                        min="1"
                        required>
                        <template #icon>
                            <fa-icon
                                icon="ruler-combined"
                                class="text-xs" />
                        </template>
                    </TextInput>
                </div>

                <!-- Guest Wi-Fi Credentials -->
                <div class="space-y-2 rounded-md border border-mist-800 bg-mist-950/40 p-3">
                    <span
                        class="block text-[11px] font-semibold tracking-wider text-mist-400 uppercase">
                        Guest Wi-Fi Details
                    </span>
                    <div class="grid grid-cols-2 gap-3">
                        <TextInput
                            id="wifi-ssid"
                            v-model="form.wifi.ssid"
                            input-label="Network (SSID)"
                            type="text"
                            placeholder="SSID" />
                        <TextInput
                            id="wifi-pwd"
                            v-model="form.wifi.pwd"
                            input-label="Password"
                            type="text"
                            placeholder="P4SsW0rD!" />
                    </div>
                </div>

                <!-- Modal Actions -->
                <div
                    class="flex items-center gap-3"
                    :class="[isEditing ? 'justify-between' : 'justify-end']">
                    <AppButton
                        v-if="isEditing"
                        label="Delete Property"
                        variant="text"
                        color="rose"
                        class="-ml-2"
                        @click="handleDeleteProperty">
                        <template #icon>
                            <fa-icon icon="trash-can" />
                        </template>
                    </AppButton>
                    <div class="flex items-center gap-4">
                        <AppButton
                            label="Cancel"
                            variant="text"
                            @click="emit('close')" />
                        <AppButton
                            type="submit"
                            :label="isEditing ? 'Save Changes' : 'Create Property'" />
                    </div>
                </div>
            </form>
        </div>
    </div>
</template>
