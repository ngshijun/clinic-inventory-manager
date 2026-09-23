<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog'
	import { Button } from '$lib/components/ui/button'

	/*
	 * "Discard Changes?" for any form that holds unsaved edits. Keep Editing is
	 * the default, so Return and Escape both keep the draft; Discard is the
	 * tinted destructive action. ActionModal opens it for its own forms and
	 * inline editors open it before they collapse.
	 */
	let { open = $bindable(false), ondiscard }: { open?: boolean; ondiscard: () => void } = $props()

	function discard() {
		open = false
		ondiscard()
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content
		role="alertdialog"
		showCloseButton={false}
		interactOutsideBehavior="ignore"
		class="sm:max-w-sm"
	>
		<Dialog.Header>
			<Dialog.Title>Discard Changes?</Dialog.Title>
			<Dialog.Description>What you entered here has not been saved.</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (open = false)} autofocus>Keep Editing</Button>
			<Button variant="destructive" onclick={discard}>Discard</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
