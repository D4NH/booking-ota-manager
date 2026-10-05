<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { toast } from 'vue-toastflow';
import { useFinanceSync } from '@/composables/useFinanceSync';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { getCurrentDate } from '@/utils/date';
import type { PersonalOwner, GoldType, GoldAsset } from '@/types/finance';

import AppButton from '@/components/ui/AppButton.vue';
import DatePicker from '@/components/ui/DatePicker.vue';
import SelectDropdown from '@/components/ui/SelectDropdown.vue';
import TextInput from '@/components/ui/TextInput.vue';

const ownerOptions = [
    { label: 'Citra Ayu Wardani', value: 'Citra Ayu Wardani' },
    { label: 'Danh Nguyen', value: 'Danh Nguyen' },
    { label: 'Shared', value: 'Shared' },
];
const goldOptions = [
    { label: 'Antam', value: 'Antam' },
    { label: 'Galeri 24', value: 'Galeri 24' },
    { label: 'Semar', value: 'Semar' },
    { label: 'UBS', value: 'UBS' },
];

interface Props {
    itemToEdit?: GoldAsset | null;
}
const { itemToEdit = null } = defineProps<Props>();
const emit = defineEmits<{
    closed: [];
}>();
const isOpen = defineModel<boolean>({ default: false });

const financeStore = useFinanceStore();
const { editGoldAsset, removeGoldAsset } = useFinanceSync();

const goldOwner = ref<PersonalOwner | 'Shared'>('Danh Nguyen');
const goldType = ref<GoldType>('Antam');
const goldGrams = ref<number | null>(null);
const goldTotalCost = ref<number | null>(null);
const goldDate = ref(getCurrentDate());
const goldCert = ref('');
const isSubmitting = ref(false);

const isEditing = computed(() => Boolean(itemToEdit));

watch(
    () => [isOpen.value, itemToEdit] as const,
    ([open, item]) => {
        if (!open) return;

        if (item) {
            goldOwner.value = item.owner;
            goldType.value = item.type;
            goldGrams.value = item.weightGrams;
            goldTotalCost.value = item.buyPriceTotal;
            goldDate.value = item.purchaseDate;
            goldCert.value = item.certificateNumber || '';
        } else {
            goldOwner.value = 'Danh Nguyen';
            goldType.value = 'Antam';
            goldGrams.value = null;
            goldTotalCost.value = null;
            goldDate.value = getCurrentDate();
            goldCert.value = '';
        }
    },
    { immediate: true }
);

function closeModal(): void {
    isOpen.value = false;
    emit('closed');
}
const handleSaveGold = async (): Promise<void> => {
    if (!goldGrams.value || !goldTotalCost.value) return;

    isSubmitting.value = true;
    try {
        const payload = {
            owner: goldOwner.value,
            type: goldType.value,
            weightGrams: Number(goldGrams.value),
            buyPriceTotal: Number(goldTotalCost.value),
            purchaseDate: goldDate.value,
            certificateNumber: goldCert.value.trim(),
        };

        if (isEditing.value && itemToEdit) {
            await editGoldAsset(itemToEdit.id, payload);
        } else {
            await toast.loading(
                async () => {
                    await financeStore.addGoldPurchase(payload);
                },
                {
                    loading: {
                        title: 'Saving Gold Asset...',
                        description: 'Adding holding to precious metals ledger & local cache.',
                    },
                    success: {
                        title: 'Gold Holding Added',
                        description: `Logged ${goldGrams.value}g of ${goldType.value} for ${goldOwner.value}.`,
                    },
                    error: (err: unknown) => ({
                        title: 'Save Failed',
                        description:
                            err instanceof Error
                                ? err.message
                                : 'Failed to write to Google Sheets.',
                    }),
                }
            );
        }

        closeModal();
    } catch (err: unknown) {
        console.error('Failed to save gold holding:', err);
    } finally {
        isSubmitting.value = false;
    }
};
async function handleDeleteGold(): Promise<void> {
    if (!itemToEdit) return;
    await removeGoldAsset(itemToEdit.id, itemToEdit.type, itemToEdit.weightGrams);
    emit('closed');
}
</script>

<template>
    <Teleport to="body">
        <transition
            enter-active-class="transition ease-out duration-150"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition ease-in duration-100"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0">
            <div
                v-if="isOpen"
                class="fixed inset-0 z-50 flex items-center justify-center bg-mist-950/75 p-4 backdrop-blur-xs">
                <div
                    class="w-full max-w-xl animate-in space-y-4 overflow-hidden rounded-md border border-mist-800 bg-mist-900 p-5 text-mist-100 shadow-2xl duration-150 zoom-in-95 fade-in">
                    <!-- Header -->
                    <div
                        class="-mt-5 -mr-5 -ml-5 flex items-center justify-between border-b border-mist-800 bg-mist-950/60 p-4">
                        <h2 class="font-semibold text-mist-100">
                            {{ isEditing ? 'Edit Gold Holding' : 'Add Gold Holding' }}
                        </h2>
                        <AppButton
                            variant="icon"
                            @click="closeModal">
                            <template #icon>
                                <fa-icon icon="xmark" />
                            </template>
                        </AppButton>
                    </div>

                    <form
                        class="max-h-[80vh] space-y-4 overflow-y-auto text-xs"
                        @submit.prevent="handleSaveGold">
                        <SelectDropdown
                            v-model="goldOwner"
                            input-label="Owner"
                            :options="ownerOptions">
                            <template #icon>
                                <fa-icon
                                    icon="id-card"
                                    class="text-xs" />
                            </template>
                        </SelectDropdown>

                        <div class="grid grid-cols-2 gap-3">
                            <SelectDropdown
                                v-model="goldType"
                                input-label="Brand"
                                :options="goldOptions" />

                            <TextInput
                                id="goldGrams"
                                v-model.number="goldGrams"
                                input-label="Weight (Grams)"
                                type="number"
                                placeholder="10"
                                required>
                                <template #icon>
                                    <fa-icon
                                        icon="weight-hanging"
                                        class="text-xs" />
                                </template>
                            </TextInput>
                        </div>

                        <div class="grid grid-cols-2 gap-3">
                            <DatePicker
                                v-model="goldDate"
                                input-label="Purchase Date"
                                :select-today-by-default="true" />

                            <TextInput
                                id="goldTotalCost"
                                v-model.number="goldTotalCost"
                                input-label="Total Purchase Cost"
                                type="number"
                                placeholder="15000000"
                                required>
                                <template #icon>
                                    <fa-icon
                                        icon="rupiah-sign"
                                        class="text-xs" />
                                </template>
                            </TextInput>
                        </div>

                        <TextInput
                            id="goldCert"
                            v-model.trim="goldCert"
                            input-label="Certificate / Serial Number (Optional)"
                            type="text"
                            placeholder="CERT-12345">
                            <template #icon>
                                <fa-icon
                                    icon="hashtag"
                                    class="text-xs" />
                            </template>
                        </TextInput>
                        <div
                            class="flex gap-2"
                            :class="[isEditing ? 'justify-between' : 'justify-end']">
                            <AppButton
                                v-if="isEditing"
                                class="-ml-2"
                                label="Delete Gold"
                                variant="text"
                                color="rose"
                                @click="handleDeleteGold">
                                <template #icon>
                                    <fa-icon icon="trash-can" />
                                </template>
                            </AppButton>

                            <div class="flex items-center gap-3">
                                <AppButton
                                    label="Cancel"
                                    variant="text"
                                    @click="closeModal" />
                                <AppButton
                                    color="amber"
                                    type="submit"
                                    :disabled="isSubmitting"
                                    :label="isEditing ? 'Edit Gold' : 'Add Gold'">
                                    <template
                                        v-if="isSubmitting"
                                        #icon>
                                        <span
                                            class="mx-1 h-3 w-3 animate-spin rounded-full border-2 border-mist-900 border-t-transparent"></span>
                                    </template>
                                    <span v-if="isSubmitting">Saving..</span>
                                </AppButton>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </transition>
    </Teleport>
</template>
