<script setup lang="ts">
const getCurrentYear = () => new Date().getFullYear();
</script>

<template>
    <footer class="w-full mt-12 mb-6 pt-6">
        <div class="grid grid-cols-1">
            <p class="text-center">© {{ getCurrentYear() }} - Danh Nguyen | Frontend Developer</p>
        </div>
    </footer>
</template>

<style lang="scss" scoped>
footer {
    border-top: 1px solid var(--color-border);
    color: var(--color-text-muted);
    font-size: 0.813rem;
}
</style>
