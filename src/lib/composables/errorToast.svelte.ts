import { untrack } from 'svelte'
import { toast } from 'svelte-sonner'

interface ErrorSource {
	readonly error: string | null
	readonly loadError: string | null
}

/**
 * Shows a store's errors as toasts. A failed action lasts 10 seconds, the
 * longest of any toast, as the user has to do it again. A failed load leaves
 * the user nothing to do, so it goes after 8 seconds.
 *
 * `unless` lets a page keep a failed action out of the toast while it shows
 * it inline instead (for example an import failure).
 *
 * Must be called during component initialisation, as it creates effects.
 */
export function useErrorToast(store: ErrorSource, unless?: () => boolean): void {
	$effect(() => {
		const message = store.error
		if (!message) return
		if (unless && untrack(unless)) return
		toast.error(message, { duration: 10000 })
	})
	$effect(() => {
		const message = store.loadError
		if (message) toast.error(message, { duration: 8000 })
	})
}
