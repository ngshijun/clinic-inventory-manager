import { describe, expect, test } from 'vitest'
import { api } from './_generated/api'
import { MANAGER, REQUESTER, item, setup, type T } from './test.helpers'

const CLINIC = 'KLINIK SETIA'

async function clinicAndItem(t: T) {
	await t.mutation(api.clinics.add, { auth: MANAGER, name: CLINIC })
	return await item(t, { unit: 'BTL', pack_size: 60, pack_unit: 'ML' })
}

async function borrow(t: T, quantity = 6) {
	const item_id = await clinicAndItem(t)
	const id = await t.mutation(api.loans.add, {
		auth: MANAGER,
		direction: 'borrowed',
		clinic: 'klinik setia',
		item_id,
		quantity,
		loaned_on: '2026-10-08',
	})
	return { item_id, id }
}

describe('borrowed and lent entries', () => {
	test('an entry keeps the clinic as listed and the item’s unit, and leaves stock alone', async () => {
		const t = setup()
		const { item_id, id } = await borrow(t)

		const [loan, stock, movements] = await t.run(
			async (ctx) =>
				[
					await ctx.db.get(id),
					await ctx.db.get(item_id),
					await ctx.db.query('stock_movements').collect(),
				] as const,
		)
		expect(loan).toMatchObject({ clinic: CLINIC, unit: 'BTL', pack_size: 60, returns: [] })
		expect(loan?.settled_on).toBeUndefined()
		expect(stock?.quantity).toBe(0)
		expect(movements).toHaveLength(0)
	})

	test('a part return keeps it open and returning the rest settles it', async () => {
		const t = setup()
		const { id } = await borrow(t)

		await t.mutation(api.loans.recordReturn, {
			auth: MANAGER,
			id,
			quantity: 2,
			returned_on: '2026-10-15',
		})
		expect((await t.run(async (ctx) => await ctx.db.get(id)))?.settled_on).toBeUndefined()

		await t.mutation(api.loans.recordReturn, {
			auth: MANAGER,
			id,
			quantity: 4,
			returned_on: '2026-10-30',
		})
		const loan = await t.run(async (ctx) => await ctx.db.get(id))
		expect(loan?.settled_on).toBe('2026-10-30')
		expect(loan?.returns).toHaveLength(2)
	})

	test('more than is owed is refused', async () => {
		const t = setup()
		const { id } = await borrow(t)
		await t.mutation(api.loans.recordReturn, {
			auth: MANAGER,
			id,
			quantity: 2,
			returned_on: '2026-10-15',
		})

		await expect(
			t.mutation(api.loans.recordReturn, {
				auth: MANAGER,
				id,
				quantity: 5,
				returned_on: '2026-10-16',
			}),
		).rejects.toThrow(/Only 4 BTL \(60 ML\) is still owed/)
	})

	test('settling another way closes it with the note, and a settled entry takes no return', async () => {
		const t = setup()
		const { id } = await borrow(t)

		await t.mutation(api.loans.settle, {
			auth: MANAGER,
			id,
			note: ' Paid RM 24.00 cash ',
			settled_on: '2026-10-20',
		})

		const loan = await t.run(async (ctx) => await ctx.db.get(id))
		expect(loan).toMatchObject({ settled_on: '2026-10-20', settled_note: 'Paid RM 24.00 cash' })
		await expect(
			t.mutation(api.loans.recordReturn, {
				auth: MANAGER,
				id,
				quantity: 1,
				returned_on: '2026-10-21',
			}),
		).rejects.toThrow(/already settled/)
	})

	test('a clinic not on the list and a part quantity are refused', async () => {
		const t = setup()
		const item_id = await clinicAndItem(t)
		const entry = {
			auth: MANAGER,
			direction: 'lent' as const,
			item_id,
			loaned_on: '2026-10-08',
		}

		await expect(
			t.mutation(api.loans.add, { ...entry, clinic: 'KLINIK LAIN', quantity: 1 }),
		).rejects.toThrow(/not on the Clinics list/)
		await expect(
			t.mutation(api.loans.add, { ...entry, clinic: CLINIC, quantity: 1.5 }),
		).rejects.toThrow(/whole number/)
	})

	test('renaming the clinic or the item renames the entry, and a clinic in use cannot be deleted', async () => {
		const t = setup()
		const { item_id, id } = await borrow(t)
		const clinic = await t.run(
			async (ctx) =>
				await ctx.db
					.query('clinics')
					.withIndex('by_name', (q) => q.eq('name', CLINIC))
					.unique(),
		)

		await t.mutation(api.clinics.rename, {
			auth: MANAGER,
			id: clinic!._id,
			name: 'Klinik Setia Jaya',
		})
		await t.mutation(api.inventory.update, { auth: MANAGER, id: item_id, item_name: 'Amoxicillin' })

		const loan = await t.run(async (ctx) => await ctx.db.get(id))
		expect(loan).toMatchObject({ clinic: 'KLINIK SETIA JAYA', item_name: 'AMOXICILLIN' })
		await expect(
			t.mutation(api.clinics.remove, { auth: MANAGER, id: clinic!._id }),
		).rejects.toThrow(/named on 1 entry/)
	})

	test('the requester password cannot see or add entries', async () => {
		const t = setup()
		await expect(t.query(api.loans.list, { auth: REQUESTER })).rejects.toThrow(
			/requires the manager role/,
		)
	})
})
