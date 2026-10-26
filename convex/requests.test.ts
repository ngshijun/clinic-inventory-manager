import { describe, expect, test } from 'vitest'
import { api } from './_generated/api'
import { MANAGER, REQUESTER, item, setup } from './test.helpers'

describe('stock requests', () => {
	test('approving takes the stock out and marks the request approved', async () => {
		const t = setup()
		const item_id = await item(t)
		await t.mutation(api.stock.stockIn, { auth: MANAGER, item_id, quantity: 10 })
		const id = await t.mutation(api.requests.add, { auth: REQUESTER, item_id, quantity: 3 })

		await t.mutation(api.requests.approve, { auth: MANAGER, id })

		const [request, stock] = await t.run(
			async (ctx) => [await ctx.db.get(id), await ctx.db.get(item_id)] as const,
		)
		expect(request?.status).toBe('Approved')
		expect(stock?.quantity).toBe(7)
	})

	test('a request is approved or rejected once', async () => {
		const t = setup()
		const item_id = await item(t)
		const id = await t.mutation(api.requests.add, { auth: REQUESTER, item_id, quantity: 1 })

		await t.mutation(api.requests.reject, { auth: MANAGER, id, remark: 'Not needed' })

		await expect(t.mutation(api.requests.approve, { auth: MANAGER, id })).rejects.toThrow(
			/not pending/,
		)
	})

	test('the requester password cannot approve', async () => {
		const t = setup()
		const item_id = await item(t)
		const id = await t.mutation(api.requests.add, { auth: REQUESTER, item_id, quantity: 1 })

		await expect(t.mutation(api.requests.approve, { auth: REQUESTER, id })).rejects.toThrow(
			/requires the manager role/,
		)
	})

	test('the requester can change a request only while it is pending', async () => {
		const t = setup()
		const item_id = await item(t)
		await t.mutation(api.stock.stockIn, { auth: MANAGER, item_id, quantity: 10 })
		const id = await t.mutation(api.requests.add, { auth: REQUESTER, item_id, quantity: 1 })

		await t.mutation(api.requests.update, { auth: REQUESTER, id, quantity: 2 })
		await t.mutation(api.requests.approve, { auth: MANAGER, id })

		await expect(
			t.mutation(api.requests.update, { auth: REQUESTER, id, quantity: 5 }),
		).rejects.toThrow(/Only pending requests/)
		await expect(t.mutation(api.requests.remove, { auth: REQUESTER, id })).rejects.toThrow(
			/Only pending requests/,
		)
	})

	test('a wrong password is refused', async () => {
		const t = setup()
		const item_id = await item(t)

		await expect(
			t.mutation(api.requests.add, { auth: 'guess', item_id, quantity: 1 }),
		).rejects.toThrow(/Invalid password/)
	})
})
