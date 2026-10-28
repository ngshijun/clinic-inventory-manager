import { describe, expect, test } from 'vitest'
import { internal } from './_generated/api'
import { addDays, clinicToday } from './lib/orders'
import { counterPress } from './lib/telegram'
import { item, setup } from './test.helpers'

describe('snoozeForCounter', () => {
	test('snoozes the item for the days pressed, as counter stock', async () => {
		const t = setup()
		const id = await item(t, { quantity: 2 })
		const reply = await t.mutation(internal.inventory.snoozeForCounter, {
			id,
			days: 14,
			by: 'Mei',
		})
		const snoozed = await t.run(async (ctx) => await ctx.db.get(id))
		expect(snoozed?.order_status).toEqual({
			kind: 'snoozed',
			until: addDays(clinicToday(Date.now()), 14),
			reason: 'Counter still has enough',
		})
		expect(reply).toMatch(/^⏰ Mei snoozed this until \w+ \d+ \w+: counter still has enough\.$/)
	})

	test('an item ordered since the alert is left as it is', async () => {
		const t = setup()
		const order_status = {
			kind: 'ordered' as const,
			ordered_on: '2026-10-01',
			quantity: 10,
			received: 0,
		}
		const id = await item(t, { order_status })
		const reply = await t.mutation(internal.inventory.snoozeForCounter, {
			id,
			days: 7,
			by: 'Mei',
		})
		const after = await t.run(async (ctx) => await ctx.db.get(id))
		expect(after?.order_status).toEqual(order_status)
		expect(reply).toBe('Already ordered, so nothing was changed.')
	})

	test('a button for an item since deleted says so', async () => {
		const t = setup()
		const id = await item(t)
		await t.run(async (ctx) => await ctx.db.delete(id))
		const reply = await t.mutation(internal.inventory.snoozeForCounter, {
			id,
			days: 7,
			by: 'Mei',
		})
		expect(reply).toBe('This item has been deleted, so nothing was changed.')
	})
})

describe('counterPress', () => {
	test('reads the item and days, and only the lengths offered', () => {
		expect(counterPress('counter:abc123:30')).toEqual({ id: 'abc123', days: 30 })
		expect(counterPress('counter:abc123:3')).toBeNull()
		expect(counterPress('late')).toBeNull()
		expect(counterPress(undefined)).toBeNull()
	})
})
