<template>
    <header class="w-full mt-6 mb-12 pb-6 border-b border-mist-800">
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
                <RouterLink
                    to="/"
                    class="flex h-8 w-8 items-center justify-center rounded-lg bg-lime-500 font-bold text-mist-950 logo">
                    B
                </RouterLink>
                <h1 class="text-xl font-bold">Booking OTA Manager</h1>
            </div>

            <div class="flex items-center space-x-8">
                <RouterLink
                    class="text-white hover:text-lime-500 text-sm"
                    to="/bookings">
                    Bookings
                </RouterLink>
                <RouterLink
                    class="text-white hover:text-lime-500 text-sm"
                    to="/calendar">
                    Calendar
                </RouterLink>
                <RouterLink
                    class="text-white hover:text-lime-500 text-sm"
                    to="/properties">
                    Properties
                </RouterLink>
                <RouterLink
                    class="text-white hover:text-lime-500 text-sm"
                    to="/finance">
                    Finance
                </RouterLink>
            </div>
        </div>
    </header>
</template>

<style lang="scss" scoped>
.router-link-active:not(.logo) {
    color: var(--color-primary);

    &:hover {
        color: var(--color-primary-hover);
    }
}
</style>
