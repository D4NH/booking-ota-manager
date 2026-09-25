<script setup lang="ts">
import { ref } from 'vue';
import { useFinanceSync } from '@/composables/useFinanceSync';
import type { PersonalOwner } from '@/types/finance';

import SelectDropdown from '@/components/ui/SelectDropdown.vue';
import DatePicker from '@/components/ui/DatePicker.vue';
import TextInput from '@/components/ui/TextInput.vue';

const ownerOptions = [
    { label: 'Citra Ayu Wardani', value: 'Citra Ayu Wardani' },
    { label: 'Danh Nguyen', value: 'Danh Nguyen' },
    { label: 'Shared', value: 'Shared' },
];
const priorityOptions = [
    { label: 'High', value: 1 },
    { label: 'Medium', value: 2 },
    { label: 'Low', value: 3 },
];

interface Props {
    modelValue?: boolean;
}

const { modelValue = false } = defineProps<Props>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();

const { createSavingGoal } = useFinanceSync();

const name = ref('');
const owner = ref<PersonalOwner | 'Shared'>('Shared');
const targetAmount = ref<number | null>(null);
const priority = ref<number>(1);
const deadline = ref('');
const notes = ref('');
const isSubmitting = ref(false);

function closeModal(): void {
    emit('update:modelValue', false);
}
async function handleSubmit(): Promise<void> {
    if (isSubmitting.value || !name.value || !targetAmount.value) return;

    isSubmitting.value = true;
    try {
        const success = await createSavingGoal({
            name: name.value.trim(),
            owner: owner.value,
            targetAmount: Number(targetAmount.value),
            priority: Number(priority.value) || 1,
            deadline: deadline.value || undefined,
            notes: notes.value.trim() || undefined,
        });

        if (success) {
            name.value = '';
            targetAmount.value = null;
            priority.value = 1;
            deadline.value = '';
            notes.value = '';
            closeModal();
        }
    } finally {
        setTimeout(() => {
            isSubmitting.value = false;
        }, 1000);
    }
}
</script>

<template>
    <div
        v-if="modelValue"
        class="fixed inset-0 z-50 flex items-center justify-center bg-mist-950/75 p-4 backdrop-blur-sm">
        <div
            class="w-full max-w-2xl rounded-md border border-mist-800 bg-mist-900 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 space-y-4 p-4">
            <!-- Modal Header -->
            <div
                class="flex items-center justify-between border-b border-mist-800 -mt-4 -mr-4 -ml-4 p-4 bg-mist-950/60">
                <div>
                    <h2 class="text-base font-semibold text-mist-100">New Savings Goal</h2>
                </div>
                <button
                    type="button"
                    class="text-mist-400 hover:text-mist-200 cursor-pointer"
                    @click="closeModal">
                    <fa-icon
                        icon="xmark"
                        class="text-sm" />
                </button>
            </div>

            <p class="text-xs text-mist-400 mb-4">
                Will be funded automatically in order of priority from your liquid savings pool.
            </p>

            <form
                class="max-h-[80vh] overflow-y-auto space-y-4"
                @submit.prevent="handleSubmit">
                <TextInput
                    id="goalTitle"
                    v-model="name"
                    input-label="Goal Title"
                    type="text"
                    placeholder="Relocating funds"
                    required>
                    <template #icon>
                        <fa-icon
                            icon="box-archive"
                            class="text-xs" />
                    </template>
                </TextInput>

                <div class="grid grid-cols-2 gap-3">
                    <SelectDropdown
                        v-model="owner"
                        input-label="Owner"
                        :options="ownerOptions">
                        <template #icon>
                            <fa-icon
                                icon="id-card"
                                class="text-xs" />
                        </template>
                    </SelectDropdown>

                    <SelectDropdown
                        v-model="priority"
                        input-label="Funding Priority"
                        :options="priorityOptions">
                        <template #icon>
                            <fa-icon
                                icon="arrow-up-1-9"
                                class="text-xs" />
                        </template>
                    </SelectDropdown>
                </div>

                <div class="grid grid-cols-2 gap-3">
                    <TextInput
                        id="payout"
                        v-model.number="targetAmount"
                        input-label="Target Amount"
                        type="number"
                        min="1"
                        placeholder="100.000"
                        required>
                        <template #icon>
                            <fa-icon
                                icon="rupiah-sign"
                                class="text-xs" />
                        </template>
                    </TextInput>

                    <DatePicker
                        v-model="deadline"
                        input-label="Target Deadline (Optional)"
                        :width="311" />
                </div>

                <TextInput
                    id="amount"
                    v-model="notes"
                    input-label="Description"
                    type="text"
                    placeholder="...">
                </TextInput>

                <div class="flex justify-end space-x-2">
                    <button
                        type="button"
                        class="text-xs px-3 py-2 font-medium text-mist-400 hover:text-mist-200 cursor-pointer"
                        @click="closeModal">
                        Cancel
                    </button>
                    <button
                        type="submit"
                        :disabled="isSubmitting"
                        class="bg-blue-400 hover:bg-blue-300 disabled:opacity-50 text-mist-950 text-xs px-4 py-2 rounded-md font-semibold transition cursor-pointer">
                        {{ isSubmitting ? 'Creating...' : 'Create Goal' }}
                    </button>
                </div>
            </form>
        </div>
    </div>
</template>
