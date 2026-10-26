import { convexTest, type TestConvex } from 'convex-test'
import aggregate from '@convex-dev/aggregate/test'
import { vi } from 'vitest'
import schema from './schema'
import type { Doc, Id } from './_generated/dataModel'

export const modules = import.meta.glob('./**/*.ts')

export type T = TestConvex<typeof schema>

export const MANAGER = 'manager-password'
export const REQUESTER = 'requester-password'

export function setup(): T {
	vi.stubEnv('MANAGER_PASSWORD', MANAGER)
	vi.stubEnv('REQUESTER_PASSWORD', REQUESTER)
	const t = convexTest(schema, modules)
	aggregate.register(t, 'movementsByType')
	return t
}

/** An item with no stock and no batches. */
export async function item(
	t: T,
	fields: Partial<Omit<Doc<'inventory'>, '_id' | '_creationTime'>> = {},
): Promise<Id<'inventory'>> {
	return await t.run(
		async (ctx) =>
			await ctx.db.insert('inventory', {
				item_name: 'Paracetamol 500mg',
				quantity: 0,
				reorder_level: 10,
				unit: 'BOX',
				remark: '',
				not_track: false,
				is_pinned: false,
				updated_at: 0,
				...fields,
			}),
	)
}

/** The item's batches, earliest received first. */
export async function batches(t: T, item_id: Id<'inventory'>): Promise<Doc<'stock_batches'>[]> {
	return await t.run(
		async (ctx) =>
			await ctx.db
				.query('stock_batches')
				.withIndex('by_item', (q) => q.eq('item_id', item_id))
				.collect(),
	)
}
