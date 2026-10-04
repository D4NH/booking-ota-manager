<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useFinanceSync } from '@/composables/useFinanceSync';
import type { SavingGoal, PersonalOwner } from '@/types/finance';

import AppButton from '@/components/ui/AppButton.vue';
import SelectDropdown from '@/components/ui/SelectDropdown.vue';
import DatePicker from '@/components/ui/DatePicker.vue';
import TextInput from '@/components/ui/TextInput.vue';

interface Props {
    itemToEdit?: SavingGoal | null;
}
const { itemToEdit = null } = defineProps<Props>();

const emit = defineEmits<{
    (e: 'closed'): void;
}>();

const isOpen = defineModel<boolean>({ default: false });

const { createSavingGoal, editSavingGoal, removeSavingGoal } = useFinanceSync();

const ownerOptions = [
    { label: 'Danh Nguyen', value: 'Danh Nguyen' },
    { label: 'Citra Ayu Wardani', value: 'Citra Ayu Wardani' },
    { label: 'Shared', value: 'Shared' },
];

const priorityOptions = [
    { label: 'Priority 1 (Highest)', value: 1 },
    { label: 'Priority 2 (High)', value: 2 },
    { label: 'Priority 3 (Medium)', value: 3 },
    { label: 'Priority 4 (Low)', value: 4 },
];

const goalName = ref('');
const goalOwner = ref<PersonalOwner | 'Shared'>('Shared');
const goalTarget = ref<number | ''>('');
const goalPriority = ref<number>(1);
const goalDeadline = ref<string>('');
const goalNotes = ref('');
const isSubmitting = ref(false);

const isEditing = computed(() => Boolean(itemToEdit));

watch(
    () => [isOpen.value, itemToEdit] as const,
    ([open, item]) => {
        if (!open) return;

        if (item) {
            goalName.value = item.name;
            goalOwner.value = item.owner;
            goalTarget.value = item.targetAmount;
            goalPriority.value = item.priority ?? 1;
            goalDeadline.value = item.deadline || '';
            goalNotes.value = item.notes || '';
        } else {
            goalName.value = '';
            goalOwner.value = 'Shared';
            goalTarget.value = '';
            goalPriority.value = 1;
            goalDeadline.value = '';
            goalNotes.value = '';
        }
    },
    { immediate: true }
);

function closeModal() {
    isOpen.value = false;
    emit('closed');
}
async function handleSaveGoal() {
    const targetNum = Number(goalTarget.value);
    if (!goalName.value.trim() || !targetNum || targetNum <= 0) return;

    isSubmitting.value = true;
    try {
        const payload = {
            name: goalName.value.trim(),
            owner: goalOwner.value,
            targetAmount: targetNum,
            priority: Number(goalPriority.value) || 1,
            deadline: goalDeadline.value || undefined,
            notes: goalNotes.value.trim() || undefined,
        };

        if (isEditing.value && itemToEdit) {
            await editSavingGoal(itemToEdit.id, payload);
        } else {
            await createSavingGoal(payload);
        }

        closeModal();
    } finally {
        isSubmitting.value = false;
    }
}
async function handleDeleteGoal(): Promise<void> {
    if (!itemToEdit) return;
    await removeSavingGoal(itemToEdit.id, itemToEdit.name);
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
                        <h2 class="text-sm font-semibold tracking-wider text-mist-100 uppercase">
                            {{ isEditing ? 'Edit Savings Goal' : 'Add Savings Goal' }}
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
                        class="max-h-[80vh] space-y-3.5 overflow-y-auto text-xs"
                        @submit.prevent="handleSaveGoal">
                        <TextInput
                            id="goalName"
                            v-model.trim="goalName"
                            input-label="Goal Name"
                            type="text"
                            placeholder="Emergency Fund, Education, Vacation"
                            required>
                            <template #icon>
                                <fa-icon
                                    icon="bullseye"
                                    class="text-xs" />
                            </template>
                        </TextInput>

                        <div class="grid grid-cols-2 gap-3">
                            <SelectDropdown
                                v-model="goalOwner"
                                input-label="Owner"
                                :options="ownerOptions">
                                <template #icon>
                                    <fa-icon
                                        class="text-xs"
                                        icon="id-card" />
                                </template>
                            </SelectDropdown>

                            <SelectDropdown
                                v-model="goalPriority"
                                input-label="Funding Priority"
                                :options="priorityOptions">
                                <template #icon>
                                    <fa-icon
                                        class="text-xs"
                                        icon="arrow-up-1-9" />
                                </template>
                            </SelectDropdown>
                        </div>

                        <div class="grid grid-cols-2 gap-3">
                            <TextInput
                                id="goalTarget"
                                v-model.number="goalTarget"
                                input-label="Target Amount"
                                type="number"
                                placeholder="10.000.000"
                                required>
                                <template #icon>
                                    <fa-icon
                                        class="text-xs"
                                        icon="rupiah-sign" />
                                </template>
                            </TextInput>

                            <DatePicker
                                v-model="goalDeadline"
                                :width="311"
                                input-label="Target Deadline (Optional)" />
                        </div>

                        <TextInput
                            id="goalNotes"
                            v-model.trim="goalNotes"
                            input-label="Notes / Milestones"
                            type="text"
                            placeholder="Held in BCA & Blu accounts" />

                        <div
                            class="flex gap-2"
                            :class="[isEditing ? 'justify-between' : 'justify-end']">
                            <AppButton
                                v-if="isEditing"
                                class="-ml-2"
                                label="Delete Goal"
                                variant="danger-text"
                                @click="handleDeleteGoal">
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
                                    color="blue"
                                    type="submit"
                                    :disabled="isSubmitting"
                                    :label="isEditing ? 'Update Goal' : 'Create Goal'">
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
