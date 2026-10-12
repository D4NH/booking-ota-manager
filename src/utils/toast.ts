import { toast } from 'vue-toastflow';

export interface ToastMessages {
    loadingTitle: string;
    loadingDesc?: string;
    successTitle: string;
    successDesc: string | ((result: unknown) => string);
    errorTitle: string;
}

export async function runWithToast<T>(
    action: () => Promise<T>,
    messages: ToastMessages
): Promise<boolean> {
    try {
        await toast.loading(action, {
            loading: {
                title: messages.loadingTitle,
                description: messages.loadingDesc,
            },
            success: (result: T) => ({
                title: messages.successTitle,
                description:
                    typeof messages.successDesc === 'function'
                        ? messages.successDesc(result)
                        : messages.successDesc,
            }),
            error: (err: unknown) => ({
                title: messages.errorTitle,
                description: err instanceof Error ? err.message : 'Operation failed.',
            }),
        });
        return true;
    } catch (err: unknown) {
        console.error(`${messages.errorTitle}:`, err);
        return false;
    }
}
