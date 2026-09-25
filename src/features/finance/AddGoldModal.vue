<script setup lang="ts">
import { ref } from 'vue';
import { toast } from 'vue-toastflow';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { getCurrentDate } from '@/utils/date';
import type { PersonalOwner, GoldType } from '@/types/finance';

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

const isOpen = defineModel<boolean>({ default: false });

const financeStore = useFinanceStore();

const goldOwner = ref<PersonalOwner | 'Shared'>('Danh Nguyen');
const goldType = ref<GoldType>('Antam');
const goldGrams = ref<number | null>(null);
const goldTotalCost = ref<number | null>(null);
const goldDate = ref(getCurrentDate());
const goldCert = ref('');
const isSubmitting = ref(false);

function resetForm() {
    goldOwner.value = 'Danh Nguyen';
    goldType.value = 'Antam';
    goldGrams.value = null;
    goldTotalCost.value = null;
    goldDate.value = getCurrentDate();
    goldCert.value = '';
}
function closeModal(): void {
    isOpen.value = false;
    resetForm();
}
async function handleSaveGold(): Promise<void> {
    if (!goldGrams.value || !goldTotalCost.value) return;

    isSubmitting.value = true;
    try {
        await toast.loading(
            async () => {
                await financeStore.addGoldPurchase({
                    owner: goldOwner.value,
                    type: goldType.value,
                    weightGrams: Number(goldGrams.value),
                    buyPriceTotal: Number(goldTotalCost.value),
                    purchaseDate: goldDate.value,
                    certificateNumber: goldCert.value.trim(),
                });
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
                        err instanceof Error ? err.message : 'Failed to write to Google Sheets.',
                }),
            }
        );

        closeModal();
    } catch (err: unknown) {
        console.error('Failed to add gold holding:', err);
    } finally {
        isSubmitting.value = false;
    }
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
                    class="w-full max-w-xl rounded-md border border-mist-800 bg-mist-900 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-5 space-y-4 text-mist-100">
                    <!-- Header -->
                    <div
                        class="flex items-center justify-between border-b border-mist-800 -mt-5 -mr-5 -ml-5 p-4 bg-mist-950/60">
                        <h2 class="font-semibold text-mist-100">Add Gold Holding</h2>
                        <button
                            type="button"
                            class="text-mist-400 hover:text-mist-200 text-lg leading-none cursor-pointer"
                            @click="closeModal">
                            <fa-icon
                                class="text-xs"
                                icon="xmark" />
                        </button>
                    </div>

                    <form
                        class="max-h-[80vh] overflow-y-auto space-y-4 text-xs"
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

                        <div class="flex justify-end gap-2">
                            <button
                                type="button"
                                class="text-xs px-3 py-2 text-mist-400 hover:text-mist-200"
                                @click="closeModal">
                                Cancel
                            </button>
                            <button
                                type="submit"
                                :disabled="isSubmitting"
                                class="bg-amber-300 hover:bg-amber-400 text-mist-950 text-xs px-4 py-2 rounded-md font-semibold">
                                {{ isSubmitting ? 'Saving...' : 'Save Holding' }}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </transition>
    </Teleport>
</template>
