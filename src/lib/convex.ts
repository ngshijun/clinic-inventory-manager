// lib/convex.ts
import { PUBLIC_CONVEX_URL } from '$env/static/public'
import { ConvexClient } from 'convex/browser'

if (!PUBLIC_CONVEX_URL) {
	throw new Error('Missing PUBLIC_CONVEX_URL environment variable')
}

/**
 * One client for the whole app. The stores are module-level singletons that
 * subscribe with `convex.onUpdate(...)` and call `convex.mutation(...)`; the
 * root layout also puts this same instance into Svelte context so components
 * can use `useQuery` from convex-svelte when that is more convenient.
 */
export const convex = new ConvexClient(PUBLIC_CONVEX_URL)
