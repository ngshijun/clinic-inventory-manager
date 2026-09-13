<script lang="ts">
	import type { Snippet } from 'svelte'
	import * as Dialog from '$lib/components/ui/dialog/index.js'
	import { Button } from '$lib/components/ui/button/index.js'

	/*
	 * Every confirmation dialog in the app goes through this component.
	 *
	 * Built on the shadcn Dialog (which brings the focus trap, scroll lock and
	 * Escape handling that the Vue version wired up by hand), but with
	 * `interactOutsideBehavior="ignore"` and no close button, because the Vue
	 * modal ignored outside clicks and had no X.
	 */
	interface Props {
		open: boolean
		title: string
		variant?: 'blue' | 'green' | 'red' | 'yellow' | 'cyan'
		loading?: boolean
		disabled?: boolean
		confirmText?: string
		cancelText?: string
		onconfirm?: () => void
		oncancel?: () => void
		onclose?: () => void
		children?: Snippet
	}

	let {
		open = $bindable(),
		title,
		variant = 'green',
		loading = false,
		disabled = false,
		confirmText = 'Confirm',
		cancelText = 'Cancel',
		onconfirm,
		oncancel,
		onclose,
		children,
	}: Props = $props()

	function handleConfirm() {
		if (!loading && !disabled) onconfirm?.()
	}

	function handleCancel() {
		if (!loading) oncancel?.()
	}
</script>

<Dialog.Root
	bind:open
	onOpenChange={(next) => {
		// The only way bits-ui closes this dialog by itself is Escape, which the
		// Vue version reported as `close`.
		if (!next && !loading) onclose?.()
	}}
>
	<Dialog.Content
		showCloseButton={false}
		interactOutsideBehavior="ignore"
		escapeKeydownBehavior={loading ? 'ignore' : 'close'}
	>
		<Dialog.Header>
			<Dialog.Title class="mb-4">{title}</Dialog.Title>
		</Dialog.Header>

		<div class="space-y-4">
			{@render children?.()}
		</div>

		<Dialog.Footer class="mt-6">
			<Button variant="gray" onclick={handleCancel} disabled={loading}>
				{cancelText}
			</Button>
			<Button {variant} onclick={handleConfirm} disabled={loading || disabled}>
				{loading ? 'Processing...' : confirmText}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
