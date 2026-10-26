<script lang="ts">
	import { mode } from 'mode-watcher'
	import { Toaster as Sonner, type ToasterProps as SonnerProps } from 'svelte-sonner'
	import Loader2Icon from '@lucide/svelte/icons/loader-2'
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check'
	import OctagonXIcon from '@lucide/svelte/icons/octagon-x'
	import InfoIcon from '@lucide/svelte/icons/info'
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert'

	let { ...restProps }: SonnerProps = $props()
</script>

<!-- An open dialog or sheet sets pointer-events: none on the body and closes on a press outside it.
     Toasts still take presses then (Reload, Undo, close), and a press on one leaves the dialog open. -->
<Sonner
	theme={mode.current}
	class="toaster group"
	style="pointer-events: auto; --normal-bg: var(--color-popover); --normal-text: var(--color-popover-foreground); --normal-border: var(--color-border);"
	onpointerdown={(event) => event.stopPropagation()}
	toastOptions={{
		classes: {
			toast: 'cn-toast',
		},
	}}
	{...restProps}
>
	{#snippet loadingIcon()}
		<Loader2Icon class="size-4 animate-spin" />
	{/snippet}
	{#snippet successIcon()}
		<CircleCheckIcon class="size-4" />
	{/snippet}
	{#snippet errorIcon()}
		<OctagonXIcon class="size-4" />
	{/snippet}
	{#snippet infoIcon()}
		<InfoIcon class="size-4" />
	{/snippet}
	{#snippet warningIcon()}
		<TriangleAlertIcon class="size-4" />
	{/snippet}
</Sonner>
