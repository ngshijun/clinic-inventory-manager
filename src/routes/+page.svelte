<script lang="ts">
	import { goto } from '$app/navigation'
	import FormField from '$lib/components/app/FormField.svelte'
	import { Button } from '$lib/components/ui/button/index.js'
	import { authStore } from '$lib/stores/auth.svelte'
	import { HOME_FOR_ROLE } from '$lib/routes/access'

	let password = $state<string | number | undefined>('')
	let error = $state('')
	let loading = $state(false)

	async function handleLogin(event: SubmitEvent) {
		event.preventDefault()
		error = ''
		loading = true

		if (authStore.login(String(password ?? ''))) {
			if (authStore.user) await goto(HOME_FOR_ROLE[authStore.user.role])
		} else {
			error = 'Invalid password. Please try again.'
		}

		loading = false
	}
</script>

<div class="min-h-screen bg-gray-50">
	<div class="flex min-h-screen items-center justify-center px-2 py-3 sm:px-0 sm:py-6">
		<div class="w-full max-w-md rounded-lg border-4 border-dashed border-gray-200 p-3 sm:p-6">
			<div class="px-3 py-4 sm:px-6 sm:py-5">
				<form onsubmit={handleLogin} class="space-y-4">
					<FormField
						bind:value={password}
						type="password"
						label="Password"
						placeholder="Enter password"
						required
						{error}
					/>

					<Button type="submit" class="w-full shadow" disabled={loading}>Sign in</Button>
				</form>
			</div>
		</div>
	</div>
</div>
