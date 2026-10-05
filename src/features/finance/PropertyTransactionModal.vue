<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useFinanceSync } from '@/composables/useFinanceSync';
import { getCurrentDate } from '@/utils/date';
import type { PropertyFinance, PropertyFinanceType, PropertyCategory } from '@/types/finance';

import AppButton from '@/components/ui/AppButton.vue';
import DatePicker from '@/components/ui/DatePicker.vue';
import SelectDropdown from '@/components/ui/SelectDropdown.vue';
import TextInput from '@/components/ui/TextInput.vue';

const transactionOptions = [
    { label: 'Expense', value: 'expense' },
    { label: 'Income', value: 'income' },
];

const categoryOptions = [
    // Operations & Guest Amenities
    'Cleaning',
    'Guest Amenities & Toiletries',
    'Food & Beverages',
    'Linens & Soft Goods',

    // Utilities & Recurring Costs
    'Utilities',
    'Connectivity & Media',
    'Garbage Disposal',

    // Maintenance & Upkeep
    'Property Maintenance',

    // Administrative & Platform
    'Payout',

    // Capital & Legal
    'Furniture',
    'Taxes, Permits & Insurance',
    'Supplies',
    'Other',
];

interface Props {
    itemToEdit?: PropertyFinance | null;
    defaultPropertyId?: string;
}

const { itemToEdit = null, defaultPropertyId = 'piyungan' } = defineProps<Props>();
const emit = defineEmits<{
    closed: [];
}>();
const isOpen = defineModel<boolean>({ default: false });

const { addPropertyTransaction, editPropertyTransaction, removePropertyTransaction } =
    useFinanceSync();

const formPropertyId = ref(defaultPropertyId);
const formType = ref<PropertyFinanceType>('expense');
const formCategory = ref<PropertyCategory>('Supplies');
const formAmount = ref<number | null>(null);
const formDate = ref(getCurrentDate());
const formNotes = ref('');
const isSubmitting = ref(false);

const isEditing = computed(() => Boolean(itemToEdit));

watch(
    () => [isOpen.value, itemToEdit] as const,
    ([open, item]) => {
        if (!open) return;

        if (item) {
            formPropertyId.value = item.propertyId;
            formType.value = item.type;
            formCategory.value = item.category;
            formAmount.value = item.amount;
            formDate.value = item.date;
            formNotes.value = item.notes || '';
        } else {
            formPropertyId.value = defaultPropertyId;
            formType.value = 'expense';
            formCategory.value = 'Supplies';
            formAmount.value = null;
            formDate.value = getCurrentDate();
            formNotes.value = '';
        }
    },
    { immediate: true }
);

function closeModal(): void {
    isOpen.value = false;
    emit('closed');
}
async function submitTransaction(): Promise<void> {
    if (isSubmitting.value || !formAmount.value || !formDate.value) return;

    isSubmitting.value = true;
    try {
        let success = false;

        if (isEditing.value && itemToEdit) {
            success = await editPropertyTransaction(itemToEdit.id, {
                propertyId: formPropertyId.value,
                type: formType.value,
                category: formCategory.value,
                amount: Number(formAmount.value),
                date: formDate.value,
                notes: formNotes.value.trim(),
            });
        } else {
            success = await addPropertyTransaction({
                propertyId: formPropertyId.value,
                type: formType.value,
                category: formCategory.value,
                amount: Number(formAmount.value),
                date: formDate.value,
                notes: formNotes.value.trim(),
            });
        }

        if (success) {
            closeModal();
        }
    } finally {
        isSubmitting.value = false;
    }
}
async function handleDeleteEntry(): Promise<void> {
    const item = itemToEdit;
    if (!item) return;

    await removePropertyTransaction(item.id, item.category);
    closeModal();
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
                    <!-- Modal Header -->
                    <div
                        class="-mt-5 -mr-5 -ml-5 flex items-center justify-between border-b border-mist-800 bg-mist-950/60 p-4">
                        <h2 class="font-semibold text-mist-100">
                            {{ isEditing ? 'Edit Property Record' : 'Add Property Record' }}
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
                        @submit.prevent="submitTransaction">
                        <div class="grid grid-cols-2 gap-3">
                            <SelectDropdown
                                v-model="formType"
                                input-label="Transaction Type"
                                :options="transactionOptions" />

                            <SelectDropdown
                                v-model="formCategory"
                                input-label="Category"
                                :options="categoryOptions" />
                        </div>

                        <div class="grid grid-cols-2 gap-3">
                            <DatePicker
                                v-model="formDate"
                                input-label="Date"
                                :width="261"
                                :select-today-by-default="true" />

                            <TextInput
                                id="propertyAmount"
                                v-model.number="formAmount"
                                input-label="Amount"
                                type="number"
                                placeholder="150000"
                                required>
                                <template #icon>
                                    <fa-icon
                                        icon="rupiah-sign"
                                        class="text-xs" />
                                </template>
                            </TextInput>
                        </div>

                        <TextInput
                            id="propertyNotes"
                            v-model.trim="formNotes"
                            input-label="Notes / Description"
                            type="text"
                            placeholder="Extra deep cleaning after stay" />

                        <div
                            class="flex gap-3"
                            :class="isEditing ? 'justify-between' : 'justify-end'">
                            <AppButton
                                v-if="isEditing"
                                class="-ml-2"
                                label="Delete booking"
                                variant="text"
                                color="rose"
                                @click="handleDeleteEntry">
                                <template #icon>
                                    <fa-icon icon="trash-can" />
                                </template>
                            </AppButton>

                            <div class="flex justify-end gap-2">
                                <AppButton
                                    label="Cancel"
                                    variant="text"
                                    @click="closeModal" />
                                <AppButton
                                    type="submit"
                                    :disabled="isSubmitting"
                                    :label="isEditing ? 'Update Record' : 'Add Record'">
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
