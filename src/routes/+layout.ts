import { redirect } from '@sveltejs/kit'
import { authStore } from '$lib/stores/auth.svelte'
import { resolveRedirect } from '$lib/routes/access'

// The app is a Supabase-backed SPA: nothing is rendered or fetched on the server.
export const ssr = false
export const prerender = false

// `initAuth` reads localStorage, so it can only run once the client is up. The
// load function is the first client-side hook that runs, and it runs before the
// guard below needs the answer.
let initialized = false

export const load = ({ url }: { url: URL }) => {
  if (!initialized) {
    initialized = true
    authStore.initAuth()
  }

  const to = resolveRedirect(url.pathname, authStore.isAuthenticated, authStore.user)
  if (to && to !== url.pathname) redirect(307, to)
}
