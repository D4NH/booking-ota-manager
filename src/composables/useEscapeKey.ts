import { watch, toValue, onScopeDispose, type MaybeRefOrGetter } from 'vue';

export interface UseEscapeKeyOptions {
    enabled?: MaybeRefOrGetter<boolean>;
    disabled?: MaybeRefOrGetter<boolean>;
}

interface EscapeStackEntry {
    id: symbol;
    handler: () => void;
    disabled?: MaybeRefOrGetter<boolean>;
}

const escapeStack: EscapeStackEntry[] = [];
let isListenerAttached = false;

function handleGlobalKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || event.defaultPrevented || escapeStack.length === 0) {
        return;
    }

    const topEntry = escapeStack[escapeStack.length - 1];
    if (!topEntry || toValue(topEntry.disabled)) {
        return;
    }

    event.preventDefault();
    topEntry.handler();
}
function attachListener(): void {
    if (isListenerAttached || typeof window === 'undefined') return;
    window.addEventListener('keydown', handleGlobalKeydown);
    isListenerAttached = true;
}
function detachListenerIfEmpty(): void {
    if (!isListenerAttached || escapeStack.length > 0 || typeof window === 'undefined') return;
    window.removeEventListener('keydown', handleGlobalKeydown);
    isListenerAttached = false;
}

export function useEscapeKey(onEscape: () => void, options: UseEscapeKeyOptions = {}): void {
    const entryId = Symbol('escape-handler');

    function register(): void {
        if (escapeStack.some((item) => item.id === entryId)) return;
        escapeStack.push({
            id: entryId,
            handler: onEscape,
            disabled: options.disabled,
        });
        attachListener();
    }
    function unregister(): void {
        const idx = escapeStack.findIndex((item) => item.id === entryId);
        if (idx !== -1) {
            escapeStack.splice(idx, 1);
        }
        detachListenerIfEmpty();
    }

    watch(
        () => toValue(options.enabled ?? true),
        (isEnabled) => {
            if (isEnabled) {
                register();
            } else {
                unregister();
            }
        },
        { immediate: true }
    );

    onScopeDispose(() => {
        unregister();
    });
}
