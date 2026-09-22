import { untrack } from 'svelte'
import { toast } from 'svelte-sonner'

/**
 * Shows every new store error as a toast that stays until dismissed.
 * `unless` lets a page keep an error out of the toast while it shows it
 * inline instead (for example an import failure).
 *
 * Must be called during component initialisation, as it creates an effect.
 */
export function useErrorToast(getError: () => string | null, unless?: () => boolean): void {
	$effect(() => {
		const message = getError()
		if (!message) return
		if (unless && untrack(unless)) return
		toast.error(message, { duration: Infinity })
	})
}
