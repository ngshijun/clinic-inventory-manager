<script lang="ts">
	import { goto } from '$app/navigation'
	import { authStore } from '$lib/stores/auth.svelte'
	import { HOME_FOR_ROLE } from '$lib/routes/access'
	import { Button } from '$lib/components/ui/button'
	import { Spinner } from '$lib/components/ui/spinner'
	import * as Alert from '$lib/components/ui/alert'
	import * as Field from '$lib/components/ui/field'
	import * as InputGroup from '$lib/components/ui/input-group'
	import BoxesIcon from '@lucide/svelte/icons/boxes'
	import LockIcon from '@lucide/svelte/icons/lock'
	import EyeIcon from '@lucide/svelte/icons/eye'
	import EyeOffIcon from '@lucide/svelte/icons/eye-off'
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert'

	let password = $state('')
	let revealed = $state(false)
	let error = $state<string | null>(null)
	let loading = $state(false)

	const canSubmit = $derived(password.length > 0 && !loading)

	async function handleLogin(event: SubmitEvent) {
		event.preventDefault()
		if (!canSubmit) return
		error = null
		loading = true

		try {
			if (await authStore.login(password)) {
				if (authStore.user) await goto(HOME_FOR_ROLE[authStore.user.role])
			} else {
				error = 'That password does not match. Check with the clinic manager.'
			}
		} catch {
			error = 'Could not reach the server. Check the connection and try again.'
		} finally {
			loading = false
		}
	}
</script>

<svelte:head>
	<title>Sign in · Clinic Inventory</title>
</svelte:head>

<div class="bg-background flex min-h-svh items-center justify-center p-4 sm:p-6">
	<div
		class="bg-card border-border grid w-full max-w-5xl overflow-hidden rounded-2xl border shadow-[0_20px_50px_-30px_rgba(15,92,110,0.45)] lg:min-h-[620px] lg:grid-cols-2"
	>
		<div class="flex flex-col gap-6 p-6 sm:p-10">
			<div class="flex items-center gap-2.5 font-extrabold">
				<span
					class="bg-brand text-brand-foreground flex size-7 shrink-0 items-center justify-center rounded-lg"
				>
					<BoxesIcon class="size-4" />
				</span>
				Clinic Inventory
			</div>

			<div class="flex flex-1 items-center justify-center py-8 lg:py-0">
				<form onsubmit={handleLogin} class="flex w-full max-w-sm flex-col gap-5" novalidate>
					<div class="flex flex-col gap-1.5 text-center">
						<h1 class="text-2xl font-extrabold tracking-tight">Sign in</h1>
						<p class="text-muted-foreground text-sm text-balance">
							Enter the clinic password. The manager password opens inventory and payroll; the
							requester password opens stock requests.
						</p>
					</div>

					{#if error}
						<Alert.Root variant="destructive" class="border-destructive/40">
							<CircleAlertIcon />
							<Alert.Title>Could not sign in</Alert.Title>
							<Alert.Description>{error}</Alert.Description>
						</Alert.Root>
					{/if}

					<Field.Group>
						<Field.Field data-invalid={error !== null ? true : undefined}>
							<Field.Label for="password">Password</Field.Label>
							<InputGroup.Root>
								<InputGroup.Addon>
									<LockIcon />
								</InputGroup.Addon>
								<!-- The password is the only field on the page, so it takes focus on load -->
								<InputGroup.Input
									id="password"
									type={revealed ? 'text' : 'password'}
									bind:value={password}
									placeholder="Clinic password"
									autocomplete="current-password"
									autofocus
									aria-invalid={error !== null ? true : undefined}
								/>
								<InputGroup.Addon align="inline-end">
									<InputGroup.Button
										size="icon-xs"
										aria-label={revealed ? 'Hide password' : 'Show password'}
										aria-pressed={revealed}
										onclick={() => (revealed = !revealed)}
									>
										{#if revealed}
											<EyeOffIcon />
										{:else}
											<EyeIcon />
										{/if}
									</InputGroup.Button>
								</InputGroup.Addon>
							</InputGroup.Root>
						</Field.Field>
					</Field.Group>

					<Button type="submit" class="h-10 w-full" disabled={!canSubmit}>
						{#if loading}
							<Spinner data-icon="inline-start" />
							Signing In…
						{:else}
							Sign In
						{/if}
					</Button>

					<p class="text-muted-foreground text-center text-xs">
						Forgotten the password? Ask the clinic manager.
					</p>
				</form>
			</div>

			<p class="text-muted-foreground/70 text-xs">Poliklinik Ng PLT</p>
		</div>

		<div
			aria-hidden="true"
			class="bg-brand text-brand-foreground relative hidden flex-col justify-end gap-3.5 overflow-hidden p-10 lg:flex"
		>
			<!-- A stylised shelf of stock, in the brand colour: no image to load. -->
			<div class="absolute inset-x-10 top-10 grid grid-cols-4 gap-2.5 opacity-55">
				{#each { length: 12 } as _, i (i)}
					<i
						class="block rounded-[10px] border border-white/18 bg-white/14 {(i + 1) % 3 === 0
							? 'h-[58px]'
							: 'h-[42px]'} {(i + 1) % 5 === 0 ? 'bg-white/28' : ''}"
					></i>
				{/each}
			</div>
			<h2 class="text-[22px] font-extrabold tracking-tight">
				Stock, orders and payroll in one place
			</h2>
			<p class="max-w-[40ch] text-sm text-white/80">
				Live counts from every batch, first-expiry-first stock out, approvals for the ward, and a
				frozen record for every payroll month.
			</p>
		</div>
	</div>
</div>
