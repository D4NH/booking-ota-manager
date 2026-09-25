<script setup lang="ts" generic="T extends DropdownValue = DropdownValue">
import { ref, computed, onMounted, onUnmounted, nextTick, useSlots } from 'vue';

export type DropdownValue = string | number | boolean | null;

export interface DropdownOption<V = DropdownValue> {
    label: string;
    value: V;
}

export type DropdownItem<V = DropdownValue> = DropdownOption<V> | string | number;

interface Props {
    inputLabel?: string;
    options?: DropdownItem<T>[];
    placeholder?: string;
}

const { inputLabel = '', options = [], placeholder = '--' } = defineProps<Props>();

// ✅ Allows numbers (like priority), strings, or unions
const modelValue = defineModel<T | DropdownValue | undefined>();

const slots = useSlots();

const isOpen = ref<boolean>(false);
const triggerButtonRef = ref<HTMLButtonElement | null>(null);
const dropdownMenuRef = ref<HTMLDivElement | null>(null);
const coords = ref({ top: 0, left: 0, width: 0 });

/**
 * Normalizes options: supports [{ label, value }], ['A', 'B'], and [1, 2, 3]
 */
const normalizedOptions = computed<DropdownOption<T | DropdownValue>[]>(() => {
    return options.map((item) => {
        if (typeof item === 'string' || typeof item === 'number') {
            return { label: String(item), value: item as T };
        }
        return item as DropdownOption<T | DropdownValue>;
    });
});

const selectedLabel = computed<string>(() => {
    const match = normalizedOptions.value.find((o) => o.value === modelValue.value);
    if (match) return match.label;
    if (modelValue.value !== undefined && modelValue.value !== null && modelValue.value !== '') {
        return String(modelValue.value);
    }
    return placeholder;
});

const updateCoordinates = (): void => {
    if (!triggerButtonRef.value) return;
    const rect = triggerButtonRef.value.getBoundingClientRect();

    coords.value = {
        top: rect.bottom,
        left: rect.left,
        width: rect.width,
    };
};

const toggleDropdown = async (): Promise<void> => {
    isOpen.value = !isOpen.value;
    if (isOpen.value) {
        await nextTick();
        updateCoordinates();
    }
};

const selectOption = (option: DropdownOption<T | DropdownValue>): void => {
    modelValue.value = option.value as T;
    isOpen.value = false;
};

const handleClickOutside = (event: MouseEvent): void => {
    const target = event.target as Node;
    if (
        triggerButtonRef.value &&
        !triggerButtonRef.value.contains(target) &&
        dropdownMenuRef.value &&
        !dropdownMenuRef.value.contains(target)
    ) {
        isOpen.value = false;
    }
};

onMounted(() => {
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', updateCoordinates);
    window.addEventListener('scroll', updateCoordinates, { capture: true });
});

onUnmounted(() => {
    document.removeEventListener('mousedown', handleClickOutside);
    window.removeEventListener('resize', updateCoordinates);
    window.removeEventListener('scroll', updateCoordinates, { capture: true });
});
</script>

<template>
    <div class="relative">
        <label
            v-if="inputLabel.length"
            class="block font-medium text-xs text-mist-400 mb-1">
            {{ inputLabel }}
        </label>

        <div
            v-if="slots.icon"
            class="absolute inset-y-0 left-0 top-5 flex items-center pl-3.5 pointer-events-none text-mist-500 group-focus-within:text-lime-400 transition-colors">
            <slot name="icon"></slot>
        </div>

        <button
            ref="triggerButtonRef"
            type="button"
            class="w-full flex items-center justify-between px-3 py-1.5 bg-mist-950/50 border border-mist-800 rounded-md text-sm text-mist-500 focus:border-lime-500 focus:outline-hidden transition-colors text-left cursor-pointer hover:border-mist-700"
            @click="toggleDropdown">
            <span
                class="pr-2 truncate"
                :class="[
                    { 'pl-7': slots.icon },
                    { 'text-mist-200': modelValue !== undefined && modelValue !== '' },
                ]">
                {{ selectedLabel }}
            </span>
            <fa-icon
                class="text-xs text-mist-400 shrink-0 ml-2"
                icon="chevron-down" />
        </button>

        <Teleport to="body">
            <div
                v-if="isOpen"
                ref="dropdownMenuRef"
                class="teleported-dropdown-menu fixed bg-mist-950/90 backdrop-blur-xl border border-mist-800 rounded-md shadow-2xl z-999 overflow-hidden max-h-60 overflow-y-auto"
                :style="{
                    top: `${coords.top + 4}px`,
                    left: `${coords.left}px`,
                    width: `${coords.width}px`,
                }">
                <ul class="py-1">
                    <li
                        v-for="option in normalizedOptions"
                        :key="String(option.value)"
                        class="px-3 py-2 text-sm hover:bg-lime-400/10 hover:text-lime-400 cursor-pointer transition-colors"
                        :class="{
                            'font-semibold text-lime-400 ': modelValue === option.value,
                        }"
                        @click="selectOption(option)">
                        {{ option.label }}
                    </li>
                    <li
                        v-if="normalizedOptions.length === 0"
                        class="px-3 py-2 text-xs text-mist-500 text-center">
                        No options available
                    </li>
                </ul>
            </div>
        </Teleport>
    </div>
</template>
