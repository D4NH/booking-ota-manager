<template>
    <div class="shrink-0 mt-4 mb-4">
        <div class="space-y-1">
            <h2 class="text-sm font-semibold uppercase tracking-wider text-mist-200">
                <slot name="title">Title</slot>
            </h2>
            <div class="text-xs text-mist-500 leading-relaxed">
                <slot name="subtitle">Subtitle</slot>
            </div>
        </div>
        <slot />
    </div>
</template>
