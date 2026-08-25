<script setup lang="ts">
import { useGoogleSheets } from '@/composables/useGoogleSheets';

const { accessToken, isAuthorizing, authError, initAuth } = useGoogleSheets();

const handleConnect = async (): Promise<void> => {
    try {
        await initAuth();
    } catch (err) {
        console.error('OAuth connection failed:', err);
    }
};
</script>

<template>
    <div class="flex items-center gap-3">
        <button
            :disabled="isAuthorizing"
            class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-semibold text-sm hover:bg-emerald-400 transition disabled:opacity-50"
            @click="handleConnect">
            <span
                v-if="accessToken"
                class="inline-block w-2 h-2 rounded-full bg-emerald-950"></span>
            {{
                isAuthorizing
                    ? 'Connecting...'
                    : accessToken
                      ? 'Drive Connected'
                      : 'Connect Google Drive'
            }}
        </button>

        <span
            v-if="authError"
            class="text-xs text-rose-400 font-mono">
            {{ authError }}
        </span>
    </div>
</template>
