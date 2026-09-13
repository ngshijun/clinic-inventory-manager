<script lang="ts">
	import type { Snippet } from 'svelte'
	import * as Alert from '$lib/components/ui/alert/index.js'
	import { Button } from '$lib/components/ui/button/index.js'
	import CloseIcon from '$lib/components/icons/CloseIcon.svelte'
	import ExclamationCircleIcon from '$lib/components/icons/ExclamationCircleIcon.svelte'

	interface Props {
		title?: string
		message: string
		variant?: 'error' | 'warning'
		dismissible?: boolean
		ondismiss?: () => void
		children?: Snippet
	}

	let {
		title = 'Error',
		message,
		variant = 'error',
		dismissible = false,
		ondismiss,
		children,
	}: Props = $props()
</script>

<Alert.Root {variant} class="has-[>svg]:grid-cols-[auto_1fr_auto]">
	<ExclamationCircleIcon />
	<div class="min-w-0">
		<Alert.Title>{title}</Alert.Title>
		<Alert.Description>{message}</Alert.Description>
		{#if children}
			<div class="mt-2">{@render children()}</div>
		{/if}
	</div>
	{#if dismissible}
		<Button
			variant="ghost"
			size="icon-sm"
			onclick={ondismiss}
			class={variant === 'error'
				? 'text-red-400 hover:bg-red-100 hover:text-red-500 focus-visible:ring-red-600'
				: 'text-yellow-400 hover:bg-yellow-100 hover:text-yellow-500 focus-visible:ring-yellow-600'}
		>
			<span class="sr-only">Dismiss</span>
			<CloseIcon class="h-5 w-5" />
		</Button>
	{/if}
</Alert.Root>
