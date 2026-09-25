<script setup lang="ts" generic="T">
import { ref, onMounted, onUnmounted, nextTick } from 'vue';

interface DropdownOption<ValueType = T> {
    label: string;
    value: ValueType;
}

interface Props {
    inputLabel?: string;
    options?: DropdownOption<T>[];
    placeholder?: string;
}

const { inputLabel = 'Date Picker', options = [], placeholder = '--' } = defineProps<Props>();

const modelValue = defineModel<T | undefined>();

const isOpen = ref<boolean>(false);
const dropdownRef = ref<HTMLDivElement | null>(null);
const triggerButtonRef = ref<HTMLButtonElement | null>(null);
const coords = ref({ top: 0, left: 0, width: 0 });

const updateCoordinates = (): void => {
    if (!triggerButtonRef.value) return;
    const rect = triggerButtonRef.value.getBoundingClientRect();

    coords.value = {
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
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
const selectOption = (option: DropdownOption<T>): void => {
    modelValue.value = option.value;
    isOpen.value = false;
};
const handleClickOutside = (event: MouseEvent): void => {
    if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
        const target = event.target as HTMLElement;
        if (!target.closest('.teleported-dropdown-menu')) {
            isOpen.value = false;
        }
    }
};

onMounted(() => {
    document.addEventListener('click', handleClickOutside);
    window.addEventListener('resize', updateCoordinates);
    window.addEventListener('scroll', updateCoordinates, { capture: true });
});

onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
    window.removeEventListener('resize', updateCoordinates);
    window.removeEventListener('scroll', updateCoordinates, { capture: true });
});
</script>

<template>
    <div
        ref="dropdownRef"
        class="relative w-full">
        <span class="block font-medium text-xs text-mist-400 mb-1">
            {{ inputLabel }}
        </span>
        <button
            ref="triggerButtonRef"
            type="button"
            class="w-full flex items-center justify-between px-3 py-2 bg-mist-950/50 border border-mist-800 rounded-md text-sm text-mist-500 focus:border-lime-500 focus:outline-none transition-colors text-left"
            @click="toggleDropdown">
            <span :class="{ 'text-mist-300': modelValue }">
                {{ options.find((o) => o.value === modelValue)?.label || placeholder }}
            </span>
            <fa-icon
                class="text-xs text-mist-400"
                icon="chevron-down" />
        </button>

        <Teleport to="body">
            <div
                v-if="isOpen"
                class="teleported-dropdown-menu fixed bg-mist-950/50 backdrop-blur-xl border border-mist-800 rounded-md shadow-xl z-50 overflow-hidden max-h-60 overflow-y-auto"
                :style="{
                    top: `${coords.top + 4}px`,
                    left: `${coords.left}px`,
                    width: `${coords.width}px`,
                }">
                <ul class="py-1">
                    <li
                        v-for="option in options"
                        :key="String(option.value)"
                        class="px-3 py-2 text-sm hover:bg-lime-400/10 hover:text-lime-400 cursor-pointer"
                        :class="{
                            'font-semibold text-lime-400': modelValue === option.value,
                        }"
                        @click="selectOption(option)">
                        {{ option.label }}
                    </li>
                </ul>
            </div>
        </Teleport>
    </div>
</template>
