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

function updateCoordinates(): void {
    if (!triggerButtonRef.value) return;
    const rect = triggerButtonRef.value.getBoundingClientRect();

    coords.value = {
        top: rect.bottom,
        left: rect.left,
        width: rect.width,
    };
}
async function toggleDropdown(): Promise<void> {
    isOpen.value = !isOpen.value;
    if (isOpen.value) {
        await nextTick();
        updateCoordinates();
    }
}
function selectOption(option: DropdownOption<T | DropdownValue>): void {
    modelValue.value = option.value as T;
    isOpen.value = false;
}
function handleClickOutside(event: MouseEvent): void {
    const target = event.target as Node;
    if (
        triggerButtonRef.value &&
        !triggerButtonRef.value.contains(target) &&
        dropdownMenuRef.value &&
        !dropdownMenuRef.value.contains(target)
    ) {
        isOpen.value = false;
    }
}
</script>

<template>
    <div class="relative">
        <label
            v-if="inputLabel.length"
            class="mb-1 block text-xs font-medium text-mist-400">
            {{ inputLabel }}
        </label>

        <div
            v-if="slots.icon"
            class="pointer-events-none absolute inset-y-0 top-5 left-0 flex items-center pl-3.5 text-mist-500 transition-colors group-focus-within:text-lime-400">
            <slot name="icon"></slot>
        </div>

        <button
            ref="triggerButtonRef"
            type="button"
            class="flex w-full cursor-pointer items-center justify-between rounded-md border border-mist-800 bg-mist-950/50 px-3 py-1.5 text-left text-sm text-mist-500 transition-colors hover:border-mist-700 focus:border-lime-500 focus:outline-hidden"
            @click="toggleDropdown">
            <span
                class="truncate pr-2"
                :class="[
                    { 'pl-7': slots.icon },
                    { 'text-mist-200': modelValue !== undefined && modelValue !== '' },
                ]">
                {{ selectedLabel }}
            </span>
            <fa-icon
                class="ml-2 shrink-0 text-xs text-mist-400"
                icon="chevron-down" />
        </button>

        <Teleport to="body">
            <div
                v-if="isOpen"
                ref="dropdownMenuRef"
                class="teleported-dropdown-menu fixed z-999 max-h-60 overflow-hidden overflow-y-auto rounded-md border border-mist-800 bg-mist-950/90 shadow-2xl backdrop-blur-xl"
                :style="{
                    top: `${coords.top + 4}px`,
                    left: `${coords.left}px`,
                    width: `${coords.width}px`,
                }">
                <ul class="py-1">
                    <li
                        v-for="option in normalizedOptions"
                        :key="String(option.value)"
                        class="cursor-pointer px-3 py-2 text-sm transition-colors hover:bg-lime-400/10 hover:text-lime-400"
                        :class="{
                            'font-semibold text-lime-400': modelValue === option.value,
                        }"
                        @click="selectOption(option)">
                        {{ option.label }}
                    </li>
                    <li
                        v-if="normalizedOptions.length === 0"
                        class="px-3 py-2 text-center text-xs text-mist-500">
                        No options available
                    </li>
                </ul>
            </div>
        </Teleport>
    </div>
</template>
