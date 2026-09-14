<template>
    <div class="shrink-0 mt-4 mb-4">
        <h2 class="text-sm font-bold uppercase tracking-wider text-mist-100">
            <slot name="title">Title</slot>
        </h2>
        <p class="mt-1 text-xs text-mist-500"><slot name="subtitle">Subtitle</slot></p>
        <slot></slot>
    </div>
</template>
