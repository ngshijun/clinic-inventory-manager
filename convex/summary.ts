import { v } from 'convex/values'
import { internalMutation } from './_generated/server'
import type { Doc } from './_generated/dataModel'
import {
	BACK_ORDER_LATE_DAYS,
	EXPIRY_WARNING_DAYS,
	NOT_MOVING_DAYS,
	addDays,
	clinicToday,
	daysBetween,
	daysIdle,
	isLate,
	isNotMoving,
	needsDecision,
	needsStock,
	toIsoDate,
} from './lib/orders'
import { dayMonth, fromSupplier, notify, plain, plural } from './lib/telegram'

type Item = Doc<'inventory'>

/**
 * Rows a list shows before "and N more". A Telegram message holds 4096
 * characters, and a longer list is read on the Dashboard.
 */
const LIST_ROWS = 8

/** Suppliers named under Still to order, the ones with the most to order first */
const TOP_SUPPLIERS = 5

const byName = (a: Item, b: Item): number => a.item_name.localeCompare(b.item_name)

const capped = (rows: string[]): string[] =>
	rows.length > LIST_ROWS
		? [...rows.slice(0, LIST_ROWS), `and ${rows.length - LIST_ROWS} more`]
		: rows

const list = (heading: string, rows: string[]): string[] =>
	rows.length === 0 ? [] : [[`<b>${heading} (${rows.length})</b>`, ...capped(rows)].join('\n')]

/**
 * The Dashboard's queues as one message, or null on a day with nothing in
 * them. Late deliveries, expiring batches and ended snoozes are short lists
 * and are named. To Order and Not Moving run to a hundred items, so they are
 * counted: To Order by the suppliers to ring first, Not Moving on Mondays
 * with only the items that joined in the week.
 */
export function morningSummary(
	items: Item[],
	batches: Doc<'stock_batches'>[],
	now: number,
): string | null {
	const today = clinicToday(now)
	const sections: string[] = []

	// The longest overdue first
	const late = items
		.flatMap((item) => {
			const status = item.order_status
			if (status?.kind !== 'ordered' || !isLate(status, today)) return []
			const due = status.expected_by ?? addDays(status.ordered_on, BACK_ORDER_LATE_DAYS)
			return [{ item, status, due }]
		})
		.sort((a, b) => a.due.localeCompare(b.due) || byName(a.item, b.item))
	sections.push(
		...list(
			'Late deliveries',
			late.map(({ item, status }) => {
				const figure = `${status.quantity - status.received} ${item.unit}${fromSupplier(item)}`
				const lateness = status.expected_by
					? `${plural(daysBetween(status.expected_by, today), 'day')} late`
					: `no date, ordered ${dayMonth(status.ordered_on)}`
				return `${plain(item.item_name)}, ${figure}, ${lateness}`
			}),
		),
	)

	// The soonest first, with the batches already expired at the top
	const itemsById = new Map(items.map((item) => [item._id, item]))
	const expiring = batches
		.flatMap((batch) => {
			const item = itemsById.get(batch.item_id)
			const expiry = toIsoDate(batch.expiry_date)
			if (!item || item.not_track || !expiry || batch.quantity <= 0) return []
			if (daysBetween(today, expiry) > EXPIRY_WARNING_DAYS) return []
			return [{ item, batch, expiry }]
		})
		.sort((a, b) => a.expiry.localeCompare(b.expiry) || byName(a.item, b.item))
	sections.push(
		...list(
			'Expiring batches',
			expiring.map(({ item, batch, expiry }) => {
				const when =
					expiry < today
						? `expired ${dayMonth(expiry)}`
						: expiry === today
							? 'expires today'
							: `expires ${dayMonth(expiry)}`
				return `${plain(item.item_name)}, ${batch.quantity} ${item.unit}, ${when}`
			}),
		),
	)

	const woke = items
		.filter(
			(item) =>
				needsStock(item) &&
				item.order_status?.kind === 'snoozed' &&
				item.order_status.until === today,
		)
		.sort(byName)
	sections.push(
		...list(
			'Snooze ended',
			woke.map((item) => `${plain(item.item_name)}, ${item.quantity} ${item.unit} left`),
		),
	)

	const toOrder = items.filter((item) => needsDecision(item, today))
	if (toOrder.length > 0) {
		const out = toOrder.filter((item) => item.quantity === 0).length
		const counts = new Map<string, number>()
		for (const { supplier } of toOrder) {
			if (supplier) counts.set(supplier, (counts.get(supplier) ?? 0) + 1)
		}
		const top = [...counts]
			.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
			.slice(0, TOP_SUPPLIERS)
		const lines = [
			`<b>Still to order (${toOrder.length})</b>`,
			`${out} out of stock, ${toOrder.length - out} running low.`,
		]
		if (top.length > 0) {
			lines.push(`Most from: ${top.map(([name, count]) => `${plain(name)} ${count}`).join(', ')}.`)
		}
		sections.push(lines.join('\n'))
	}

	const isMonday = new Date(`${today}T00:00:00Z`).getUTCDay() === 1
	const notMoving = isMonday ? items.filter((item) => isNotMoving(item, now)) : []
	if (notMoving.length > 0) {
		const joined = notMoving
			.filter((item) => daysIdle(item, now) <= NOT_MOVING_DAYS + 7)
			.sort(byName)
			.map((item) => `${plain(item.item_name)}, ${item.quantity} ${item.unit}`)
		sections.push(
			[
				`<b>Not moving for ${NOT_MOVING_DAYS} days (${notMoving.length})</b>`,
				joined.length > 0 ? `${joined.length} new this week:` : 'None new this week.',
				...capped(joined),
			].join('\n'),
		)
	}

	if (sections.length === 0) return null
	return [`<b>Morning summary, ${dayMonth(today)}</b>`, ...sections].join('\n\n')
}

/** Run by the cron in crons.ts. */
export const sendMorning = internalMutation({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		// Bounded by product count and by stock on hand, as inventory.list and stock.listBatches are
		const items = await ctx.db.query('inventory').collect()
		const batches = await ctx.db.query('stock_batches').collect()
		await notify(ctx, morningSummary(items, batches, Date.now()))
		return null
	},
})
