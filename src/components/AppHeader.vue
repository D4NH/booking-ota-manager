<template>
    <header class="w-full mt-6 mb-12 pb-6">
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
                <RouterLink
                    to="/"
                    class="flex h-8 w-8 items-center justify-center rounded-lg bg-lime-500 font-bold text-mist-950 logo">
                    M
                </RouterLink>
                <h1 class="text-xl font-bold tracking-tight">Dashboard</h1>
            </div>

            <div class="flex items-center space-x-8">
                <RouterLink
                    class="text-white hover:text-lime-500 text-sm"
                    to="/calendar">
                    Calendar
                </RouterLink>
                <RouterLink
                    class="text-white hover:text-lime-500 text-sm"
                    to="/bookings">
                    Bookings
                </RouterLink>
                <RouterLink
                    class="text-white hover:text-lime-500 text-sm"
                    to="/finance">
                    Finance
                </RouterLink>
                <RouterLink
                    class="text-white hover:text-lime-500 text-sm"
                    to="/settings">
                    Settings
                </RouterLink>
            </div>
        </div>
    </header>
</template>

<style lang="scss" scoped>
header {
    border-bottom: 1px solid var(--color-border);
    color: var(--color-text-muted);
    font-size: 0.813rem;
}

.router-link-active:not(.logo) {
    color: var(--color-primary);

    &:hover {
        color: var(--color-primary-hover);
    }
}
</style>
