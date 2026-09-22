import { ConvexError, v } from 'convex/values'
import { paginationOptsValidator } from 'convex/server'
import type { NamedTableInfo, OrderedQuery } from 'convex/server'
import { filter } from 'convex-helpers/server/filter'
import { internalMutation, mutation, query } from './_generated/server'
import { internal } from './_generated/api'
import type { DataModel, Doc, Id } from './_generated/dataModel'
import { requireRole } from './lib/auth'
import { movementsByType } from './lib/aggregates'
import { movementType, stockMovementDoc } from './schema'

const MAX_PAGE_SIZE = 500
const BACKFILL_BATCH = 500

type MovementsQuery = OrderedQuery<NamedTableInfo<DataModel, 'stock_movements'>>

function assertFiniteOrUndefined(value: number | undefined, name: string): void {
	if (value !== undefined && !Number.isFinite(value)) {
		throw new ConvexError({ code: 'INVALID_ARGUMENT', message: `${name} must be a finite number` })
	}
}

const movementPageRow = v.object({
	...stockMovementDoc.fields,
	unit: v.string(),
})

export const page = query({
	args: {
		auth: v.string(),
		paginationOpts: paginationOptsValidator,
		sort_direction: v.union(v.literal('asc'), v.literal('desc')),
		movement_type: v.optional(movementType),
		item_id: v.optional(v.id('inventory')),
		start_ms: v.optional(v.number()),
		end_ms: v.optional(v.number()),
		search: v.optional(v.string()),
		remark: v.optional(v.string()),
		quantity_min: v.optional(v.number()),
		quantity_max: v.optional(v.number()),
	},
	returns: v.object({
		page: v.array(movementPageRow),
		isDone: v.boolean(),
		continueCursor: v.string(),
	}),
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager'])
		assertFiniteOrUndefined(args.start_ms, 'start_ms')
		assertFiniteOrUndefined(args.end_ms, 'end_ms')
		assertFiniteOrUndefined(args.quantity_min, 'quantity_min')
		assertFiniteOrUndefined(args.quantity_max, 'quantity_max')

		const search = args.search?.trim() ?? ''
		const remark = args.remark?.trim().toLowerCase() ?? ''
		const { movement_type, item_id, start_ms, end_ms, quantity_min, quantity_max } = args

		// Pick the narrowest index. Every index implicitly ends with _creationTime,
		// so the date range rides on the index too; only the search branch has to
		// check dates row by row. Remark "contains" and the quantity range can't be
		// expressed by any index and are applied with convex-helpers `filter`.
		const lower = start_ms ?? Number.NEGATIVE_INFINITY
		const upper = end_ms ?? Number.POSITIVE_INFINITY
		let base: MovementsQuery
		let typeCovered = false
		let itemCovered = false
		let datesCovered = true
		if (search.length > 0) {
			// Search results are relevance-ordered; sort_direction is not applied.
			base = ctx.db.query('stock_movements').withSearchIndex('search_item_name', (q) => {
				const s = q.search('item_name', search)
				return movement_type ? s.eq('movement_type', movement_type) : s
			})
			typeCovered = movement_type !== undefined
			datesCovered = false
		} else if (item_id !== undefined) {
			base = ctx.db
				.query('stock_movements')
				.withIndex('by_item', (q) =>
					q.eq('item_id', item_id).gte('_creationTime', lower).lte('_creationTime', upper),
				)
				.order(args.sort_direction)
			itemCovered = true
		} else if (movement_type !== undefined) {
			base = ctx.db
				.query('stock_movements')
				.withIndex('by_type', (q) =>
					q
						.eq('movement_type', movement_type)
						.gte('_creationTime', lower)
						.lte('_creationTime', upper),
				)
				.order(args.sort_direction)
			typeCovered = true
		} else {
			base = ctx.db
				.query('stock_movements')
				.withIndex('by_creation_time', (q) =>
					q.gte('_creationTime', lower).lte('_creationTime', upper),
				)
				.order(args.sort_direction)
		}

		const filtered = filter(base, (m: Doc<'stock_movements'>) => {
			if (!typeCovered && movement_type !== undefined && m.movement_type !== movement_type) {
				return false
			}
			if (!itemCovered && item_id !== undefined && m.item_id !== item_id) return false
			if (!datesCovered && start_ms !== undefined && m._creationTime < start_ms) return false
			if (!datesCovered && end_ms !== undefined && m._creationTime > end_ms) return false
			if (quantity_min !== undefined && m.quantity < quantity_min) return false
			if (quantity_max !== undefined && m.quantity > quantity_max) return false
			if (remark.length > 0 && !m.remark.toLowerCase().includes(remark)) return false
			return true
		})

		const numItems = Math.min(
			MAX_PAGE_SIZE,
			Math.max(
				1,
				Math.floor(
					Number.isFinite(args.paginationOpts.numItems) ? args.paginationOpts.numItems : 1,
				),
			),
		)
		const result = await filtered.paginate({ ...args.paginationOpts, numItems })

		// Join the current unit; '' when the item has since been deleted.
		const units = new Map<Id<'inventory'>, string>()
		const pageRows = []
		for (const movement of result.page) {
			let unit = units.get(movement.item_id)
			if (unit === undefined) {
				const item = await ctx.db.get(movement.item_id)
				unit = item?.unit ?? ''
				units.set(movement.item_id, unit)
			}
			pageRows.push({ ...movement, unit })
		}

		return { page: pageRows, isDone: result.isDone, continueCursor: result.continueCursor }
	},
})

export const count = query({
	args: {
		auth: v.string(),
		movement_type: v.optional(movementType),
		start_ms: v.optional(v.number()),
		end_ms: v.optional(v.number()),
	},
	returns: v.number(),
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager'])
		assertFiniteOrUndefined(args.start_ms, 'start_ms')
		assertFiniteOrUndefined(args.end_ms, 'end_ms')

		const bounds =
			args.start_ms === undefined && args.end_ms === undefined
				? undefined
				: {
						lower:
							args.start_ms === undefined ? undefined : { key: args.start_ms, inclusive: true },
						upper: args.end_ms === undefined ? undefined : { key: args.end_ms, inclusive: true },
					}

		if (args.movement_type !== undefined) {
			return await movementsByType.count(ctx, { namespace: args.movement_type, bounds })
		}
		const [stockIn, stockOut] = await Promise.all([
			movementsByType.count(ctx, { namespace: 'stock_in', bounds }),
			movementsByType.count(ctx, { namespace: 'stock_out', bounds }),
		])
		return stockIn + stockOut
	},
})

export const updateRemark = mutation({
	args: { auth: v.string(), id: v.id('stock_movements'), remark: v.string() },
	returns: v.null(),
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager'])
		const movement = await ctx.db.get(args.id)
		if (!movement) throw new ConvexError({ code: 'NOT_FOUND', message: 'Movement not found' })
		await ctx.db.patch(movement._id, { remark: args.remark, updated_at: Date.now() })
		return null
	},
})

const NAMESPACES = ['stock_in', 'stock_out'] as const
const CLEAR_BATCH = 200

/**
 * Clears and rebuilds the movementsByType aggregate from the table, a few
 * hundred entries per mutation, rescheduling itself until done. The clear
 * phase pages through the aggregate's own entries rather than calling
 * `clear`, which touches every node at once and exceeds the per-mutation
 * limits once the aggregate is large. Run with
 * `npx convex run movements:backfillAggregate '{}'`.
 */
export const backfillAggregate = internalMutation({
	args: {
		phase: v.optional(v.union(v.literal('clear'), v.literal('insert'))),
		namespace: v.optional(movementType),
		cursor: v.optional(v.string()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const phase = args.phase ?? 'clear'

		if (phase === 'clear') {
			const namespace = args.namespace ?? NAMESPACES[0]
			const page = await movementsByType.paginate(ctx, { namespace, pageSize: CLEAR_BATCH })
			for (const item of page.page) {
				// Only the fields the aggregate's key and namespace functions read
				await movementsByType.deleteIfExists(ctx, {
					_id: item.id,
					_creationTime: item.key,
					movement_type: namespace,
				} as Doc<'stock_movements'>)
			}
			const stillClearing = page.page.length > 0
			const nextNamespace = NAMESPACES[NAMESPACES.indexOf(namespace) + 1]
			const next = stillClearing
				? { phase: 'clear' as const, namespace }
				: nextNamespace
					? { phase: 'clear' as const, namespace: nextNamespace }
					: { phase: 'insert' as const }
			await ctx.scheduler.runAfter(0, internal.movements.backfillAggregate, next)
			return null
		}

		const result = await ctx.db
			.query('stock_movements')
			.paginate({ cursor: args.cursor ?? null, numItems: BACKFILL_BATCH })
		for (const movement of result.page) {
			await movementsByType.insertIfDoesNotExist(ctx, movement)
		}
		if (!result.isDone) {
			await ctx.scheduler.runAfter(0, internal.movements.backfillAggregate, {
				phase: 'insert',
				cursor: result.continueCursor,
			})
		}
		return null
	},
})
