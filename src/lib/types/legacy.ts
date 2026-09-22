/**
 * The pages were written against Supabase rows, which had `id` and an ISO
 * `created_at`. Convex docs carry `_id` and a numeric `_creationTime`. Rather
 * than touch every page, each store maps its docs through `withLegacy` so
 * both spellings are available. `id` keeps the branded `Id<...>` type, so
 * passing it back into a mutation still typechecks.
 */
export type WithLegacy<T extends { _id: string; _creationTime: number }> = T & {
	id: T['_id']
	created_at: string
}

export const withLegacy = <T extends { _id: string; _creationTime: number }>(
	doc: T,
): WithLegacy<T> => ({
	...doc,
	id: doc._id,
	created_at: new Date(doc._creationTime).toISOString(),
})

/** Human-readable message from a thrown Convex error (or anything else) */
export const errorMessage = (error: unknown, fallback: string): string => {
	if (error && typeof error === 'object' && 'data' in error) {
		const data = (error as { data?: unknown }).data
		if (data && typeof data === 'object' && 'message' in data) {
			return String((data as { message: unknown }).message)
		}
		if (typeof data === 'string') return data
	}
	return error instanceof Error ? error.message : fallback
}
