<script lang="ts">
	import type { Snippet } from 'svelte'
	import * as Dialog from '$lib/components/ui/dialog'
	import { Button } from '$lib/components/ui/button'
	import { Spinner } from '$lib/components/ui/spinner'
	import DiscardDialog from './DiscardDialog.svelte'

	/*
	 * Every confirmation and form dialog in the app goes through this component.
	 *
	 * The title names the task. Cancel sits on the leading side and the confirm
	 * is the plain default button, never red: the destructive style is for an
	 * action people did not deliberately choose. Clicking outside does nothing
	 * and there is no X; Escape cancels unless a request is in flight.
	 *
	 * A form dialog passes `dirty` while it holds unsaved edits: cancelling or
	 * pressing Escape then asks before the edits are thrown away. Keep Editing
	 * is the default, so Return and Escape both keep the draft.
	 */
	interface Props {
		open: boolean
		title: string
		description?: string
		loading?: boolean
		disabled?: boolean
		/** Unsaved edits that closing would lose */
		dirty?: boolean
		confirmText?: string
		cancelText?: string
		onconfirm?: () => void
		oncancel?: () => void
		/** Rendered on the leading edge of the footer, e.g. a tinted Delete button. */
		leading?: Snippet
		children?: Snippet
	}

	let {
		open = $bindable(),
		title,
		description,
		loading = false,
		disabled = false,
		dirty = false,
		confirmText = 'Confirm',
		cancelText = 'Cancel',
		onconfirm,
		oncancel,
		leading,
		children,
	}: Props = $props()

	let askDiscard = $state(false)

	function handleConfirm() {
		if (!loading && !disabled) onconfirm?.()
	}

	function handleCancel() {
		if (loading) return
		if (dirty) askDiscard = true
		else oncancel?.()
	}

	function discard() {
		oncancel?.()
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content
		showCloseButton={false}
		interactOutsideBehavior="ignore"
		onEscapeKeydown={(event) => {
			// Take over the close so a dirty form can ask first and a request in flight is not abandoned.
			event.preventDefault()
			handleCancel()
		}}
		class="sm:max-w-md"
	>
		<Dialog.Header>
			<Dialog.Title>{title}</Dialog.Title>
			{#if description}
				<Dialog.Description>{description}</Dialog.Description>
			{/if}
		</Dialog.Header>

		{#if children}
			<div class="flex flex-col gap-4">
				{@render children()}
			</div>
		{/if}

		<Dialog.Footer>
			{#if leading}
				<div class="sm:me-auto">
					{@render leading()}
				</div>
			{/if}
			<Button variant="outline" onclick={handleCancel} disabled={loading}>
				{cancelText}
			</Button>
			<Button onclick={handleConfirm} disabled={loading || disabled} autofocus>
				{#if loading}
					<Spinner data-icon="inline-start" />
				{/if}
				{confirmText}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<DiscardDialog bind:open={askDiscard} ondiscard={discard} />
