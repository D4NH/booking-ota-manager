<template>
    <div class="mt-4 mb-4 shrink-0">
        <div class="space-y-1">
            <h2 class="text-sm font-semibold tracking-wider text-mist-200 uppercase">
                <slot name="title">Title</slot>
            </h2>
            <div class="text-xs leading-relaxed text-mist-500">
                <slot name="subtitle">Subtitle</slot>
            </div>
        </div>
        <slot />
    </div>
</template>
