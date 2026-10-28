import { describe, expect, test } from 'vitest'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { addDays, clinicToday } from './lib/orders'
import { snoozeEndedMessage } from './lib/telegram'
import { item, setup } from './test.helpers'

const snoozed = (until: string) => ({
	kind: 'snoozed' as const,
	until,
	reason: 'Counter still has enough',
})

describe('sendMorning', () => {
	test('clears every snooze whose day has come, and keeps the rest', async () => {
		const t = setup()
		const today = clinicToday(Date.now())
		const endsToday = await item(t, { quantity: 2, order_status: snoozed(today) })
		const missed = await item(t, { quantity: 2, order_status: snoozed(addDays(today, -3)) })
		const restocked = await item(t, { quantity: 50, order_status: snoozed(today) })
		const later = await item(t, { quantity: 2, order_status: snoozed(addDays(today, 1)) })

		await t.mutation(internal.summary.sendMorning, {})

		const status = async (id: Id<'inventory'>) =>
			(await t.run(async (ctx) => await ctx.db.get(id)))?.order_status
		expect(await status(endsToday)).toBeUndefined()
		expect(await status(missed)).toBeUndefined()
		expect(await status(restocked)).toBeUndefined()
		expect(await status(later)).toEqual(snoozed(addDays(today, 1)))
	})
})

describe('snoozeEndedMessage', () => {
	const doc = (fields: Partial<Doc<'inventory'>>): Doc<'inventory'> => ({
		_id: 'item' as Id<'inventory'>,
		_creationTime: 0,
		item_name: 'Alcohol Swab',
		quantity: 2,
		reorder_level: 5,
		unit: 'BOX',
		remark: '',
		not_track: false,
		is_pinned: false,
		updated_at: 0,
		...fields,
	})

	test('tells an item still low again, quietly, with the reason', () => {
		const today = clinicToday(Date.now())
		const notice = snoozeEndedMessage(doc({}), snoozed(today), [])
		expect(notice?.silent).toBe(true)
		expect(notice?.text).toBe(
			'🟡 <b>Alcohol Swab</b> is still running low. Its snooze ended today.\n\n' +
				'Reason: Counter still has enough\n2 BOX left.',
		)
	})

	test('says nothing of an item no longer low', () => {
		const today = clinicToday(Date.now())
		expect(snoozeEndedMessage(doc({ quantity: 9 }), snoozed(today), [])).toBeNull()
	})
})
