<script setup lang="ts">
import { ref } from 'vue';
import { useFinanceSync } from '@/composables/useFinanceSync';
import type { PersonalOwner } from '@/types/finance';

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
        class="fixed inset-0 z-50 bg-mist-950/80 backdrop-blur-sm flex items-center justify-center p-4"
        @click.self="closeModal">
        <div class="bg-mist-900 border border-mist-800 rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full bg-lime-400"></span>
                    <h4 class="font-bold text-mist-100 text-sm">New Savings Target</h4>
                </div>
                <button
                    type="button"
                    class="text-mist-400 hover:text-mist-200 cursor-pointer"
                    @click="closeModal">
                    ✕
                </button>
            </div>

            <p class="text-xs text-mist-400 mb-4">
                Will be funded automatically in order of priority from your liquid savings pool.
            </p>

            <form
                class="space-y-3.5"
                @submit.prevent="handleSubmit">
                <div>
                    <label class="text-xs font-semibold text-mist-400 block mb-1">Goal Title</label>
                    <input
                        v-model="name"
                        type="text"
                        required
                        placeholder="e.g. Emergency Fund 6 Months"
                        class="w-full text-xs border border-mist-700 bg-mist-800 text-mist-100 rounded-md p-2.5 focus:border-lime-400 focus:outline-none" />
                </div>

                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-xs font-semibold text-mist-400 block mb-1"
                            >Owner / Pool</label
                        >
                        <select
                            v-model="owner"
                            class="w-full text-xs border border-mist-700 bg-mist-800 text-mist-100 rounded-md p-2.5 focus:border-lime-400 focus:outline-none">
                            <option value="Shared">Shared Household</option>
                            <option value="Danh Nguyen">Danh Nguyen</option>
                            <option value="Citra Ayu Wardani">Citra Ayu Wardani</option>
                        </select>
                    </div>

                    <div>
                        <label class="text-xs font-semibold text-mist-400 block mb-1"
                            >Funding Priority</label
                        >
                        <select
                            v-model="priority"
                            class="w-full text-xs border border-mist-700 bg-mist-800 text-mist-100 rounded-md p-2.5 focus:border-lime-400 focus:outline-none font-mono">
                            <option :value="1">1 (Highest)</option>
                            <option :value="2">2 (Medium)</option>
                            <option :value="3">3 (Low)</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label class="text-xs font-semibold text-mist-400 block mb-1"
                        >Target Amount (IDR)</label
                    >
                    <input
                        v-model="targetAmount"
                        type="number"
                        required
                        min="1"
                        placeholder="50000000"
                        class="w-full text-xs border border-mist-700 bg-mist-800 text-mist-100 rounded-md p-2.5 font-mono focus:border-lime-400 focus:outline-none" />
                </div>

                <div>
                    <label class="text-xs font-semibold text-mist-400 block mb-1"
                        >Target Deadline (Optional)</label
                    >
                    <input
                        v-model="deadline"
                        type="date"
                        class="w-full text-xs border border-mist-700 bg-mist-800 text-mist-100 rounded-md p-2.5 font-mono focus:border-lime-400 focus:outline-none" />
                </div>

                <div>
                    <label class="text-xs font-semibold text-mist-400 block mb-1"
                        >Memo / Description</label
                    >
                    <input
                        v-model="notes"
                        type="text"
                        placeholder="e.g. Baseline survival cushion"
                        class="w-full text-xs border border-mist-700 bg-mist-800 text-mist-100 rounded-md p-2.5 focus:border-lime-400 focus:outline-none" />
                </div>

                <div class="flex justify-end space-x-2 pt-3">
                    <button
                        type="button"
                        class="text-xs px-3 py-2 text-mist-400 hover:text-mist-200 cursor-pointer"
                        @click="closeModal">
                        Cancel
                    </button>
                    <button
                        type="submit"
                        :disabled="isSubmitting"
                        class="bg-lime-400 hover:bg-lime-300 disabled:opacity-50 text-mist-950 text-xs px-4 py-2 rounded-md font-bold transition cursor-pointer">
                        {{ isSubmitting ? 'Creating...' : 'Create Goal' }}
                    </button>
                </div>
            </form>
        </div>
    </div>
</template>
