<script setup lang="ts">
const currentYear = new Date().getFullYear();
</script>

<template>
    <footer class="w-full mt-12 mb-6 pt-6 border-t border-mist-800">
        <div class="grid grid-cols-1">
            <p class="text-center text-xs">
                © {{ currentYear }} - Danh Nguyen | Frontend Developer
            </p>
        </div>
    </footer>
</template>
