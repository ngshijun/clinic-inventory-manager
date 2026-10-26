import { describe, expect, test } from 'vitest'
import { api } from './_generated/api'
import { MANAGER, REQUESTER, batches, item, setup } from './test.helpers'

describe('stockIn', () => {
	test('stock of one expiry date joins its batch; another date opens a second', async () => {
		const t = setup()
		const item_id = await item(t)

		await t.mutation(api.stock.stockIn, {
			auth: MANAGER,
			item_id,
			quantity: 5,
			expiry_date: '2027-03-01',
		})
		await t.mutation(api.stock.stockIn, {
			auth: MANAGER,
			item_id,
			quantity: 3,
			expiry_date: '2027-03-01',
		})
		const after = await t.mutation(api.stock.stockIn, {
			auth: MANAGER,
			item_id,
			quantity: 2,
			expiry_date: '2027-06-01',
		})

		expect(after.quantity).toBe(10)
		expect((await batches(t, item_id)).map((b) => [b.expiry_date, b.quantity])).toEqual([
			['2027-03-01', 8],
			['2027-06-01', 2],
		])
	})

	test('an order counts what came in and closes once the whole quantity has', async () => {
		const t = setup()
		const item_id = await item(t, {
			order_status: { kind: 'ordered', ordered_on: '2026-10-01', quantity: 10, received: 0 },
		})

		const partly = await t.mutation(api.stock.stockIn, { auth: MANAGER, item_id, quantity: 4 })
		expect(partly.order_status).toMatchObject({ kind: 'ordered', received: 4 })

		const whole = await t.mutation(api.stock.stockIn, { auth: MANAGER, item_id, quantity: 6 })
		expect(whole.order_status).toBeUndefined()
	})

	test('a snoozed item is back in play once stock comes in', async () => {
		const t = setup()
		const item_id = await item(t, {
			order_status: { kind: 'snoozed', until: '2026-12-01', reason: 'Supplier out' },
		})

		const after = await t.mutation(api.stock.stockIn, { auth: MANAGER, item_id, quantity: 1 })
		expect(after.order_status).toBeUndefined()
	})

	test('the requester password cannot stock in', async () => {
		const t = setup()
		const item_id = await item(t)

		await expect(
			t.mutation(api.stock.stockIn, { auth: REQUESTER, item_id, quantity: 1 }),
		).rejects.toThrow(/requires the manager role/)
	})

	test('a quantity of zero is refused', async () => {
		const t = setup()
		const item_id = await item(t)

		await expect(
			t.mutation(api.stock.stockIn, { auth: MANAGER, item_id, quantity: 0 }),
		).rejects.toThrow(/positive number/)
	})
})

describe('stockOut', () => {
	test('takes the earliest expiry first, then stock with no expiry date', async () => {
		const t = setup()
		const item_id = await item(t)
		await t.mutation(api.stock.stockIn, { auth: MANAGER, item_id, quantity: 5 })
		await t.mutation(api.stock.stockIn, {
			auth: MANAGER,
			item_id,
			quantity: 4,
			expiry_date: '2027-06-01',
		})
		await t.mutation(api.stock.stockIn, {
			auth: MANAGER,
			item_id,
			quantity: 3,
			expiry_date: '2027-03-01',
		})

		const after = await t.mutation(api.stock.stockOut, { auth: MANAGER, item_id, quantity: 8 })

		expect(after.quantity).toBe(4)
		expect((await batches(t, item_id)).map((b) => [b.expiry_date, b.quantity])).toEqual([
			[undefined, 4],
			['2027-06-01', 0],
			['2027-03-01', 0],
		])
		const movements = await t.run(
			async (ctx) =>
				await ctx.db
					.query('stock_movements')
					.withIndex('by_type', (q) => q.eq('movement_type', 'stock_out'))
					.collect(),
		)
		expect(movements.map((m) => [m.expiry_date, m.quantity])).toEqual([
			['2027-03-01', 3],
			['2027-06-01', 4],
			[undefined, 1],
		])
	})

	test('asking for more than is on hand empties the item', async () => {
		const t = setup()
		const item_id = await item(t)
		await t.mutation(api.stock.stockIn, { auth: MANAGER, item_id, quantity: 2 })

		const after = await t.mutation(api.stock.stockOut, { auth: MANAGER, item_id, quantity: 5 })
		expect(after.quantity).toBe(0)
	})
})
