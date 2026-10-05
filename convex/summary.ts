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
import {
	ICON,
	bold,
	dayMonth,
	facts,
	fromSupplier,
	italic,
	notify,
	plain,
	plural,
} from './lib/telegram'

type Item = Doc<'inventory'>

/**
 * Rows a list shows before "and N more". The summary is read at a glance,
 * and a longer list is read on the Dashboard.
 */
const LIST_ROWS = 5

/** Suppliers named under Still to order, the ones with the most to order first */
const TOP_SUPPLIERS = 5

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** As wide as a bullet, in spaces Telegram does not trim */
const INDENT = '\u00a0\u00a0\u00a0'

const byName = (a: Item, b: Item): number => a.item_name.localeCompare(b.item_name)

const heading = (icon: string, label: string, count: number): string =>
	`${icon} ${bold(label)} (${count})`

/** A name runs to 60 letters, so what is said about it goes on a line of its own */
const row = (name: string, detail: string): string => `• ${plain(name)}\n${INDENT}${detail}`

const capped = (rows: string[]): string[] =>
	rows.length > LIST_ROWS
		? [...rows.slice(0, LIST_ROWS), italic(`and ${rows.length - LIST_ROWS} more on the Dashboard`)]
		: rows

const list = (icon: string, label: string, rows: string[]): string[] =>
	rows.length === 0 ? [] : [[heading(icon, label, rows.length), ...capped(rows)].join('\n')]

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
			ICON.late,
			'Late deliveries',
			late.map(({ item, status }) => {
				const figure = `${status.quantity - status.received} ${item.unit}${fromSupplier(item)}`
				const lateness = status.expected_by
					? `${plural(daysBetween(status.expected_by, today), 'day')} late`
					: `no date, ordered ${dayMonth(status.ordered_on)}`
				return row(item.item_name, facts(figure, lateness))
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
			ICON.expiring,
			'Expiring batches',
			expiring.map(({ item, batch, expiry }) => {
				// Bold marks the batches past saving, so they stand out from the ones with time left
				const when =
					expiry < today
						? bold(`expired ${dayMonth(expiry)}`)
						: expiry === today
							? bold('expires today')
							: `expires ${dayMonth(expiry)}`
				return row(item.item_name, facts(`${batch.quantity} ${item.unit}`, when))
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
			ICON.snooze,
			'Snooze ended',
			woke.map((item) => row(item.item_name, `${item.quantity} ${item.unit} left`)),
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
			heading(ICON.toOrder, 'Still to order', toOrder.length),
			`${ICON.out} ${bold(out)} out of stock`,
			`${ICON.low} ${bold(toOrder.length - out)} running low`,
		]
		if (top.length > 0) {
			lines.push('Most from:', ...top.map(([name, count]) => `• ${plain(name)} (${count})`))
		}
		sections.push(lines.join('\n'))
	}

	const weekday = new Date(`${today}T00:00:00Z`).getUTCDay()
	const notMoving = weekday === 1 ? items.filter((item) => isNotMoving(item, now)) : []
	if (notMoving.length > 0) {
		const joined = notMoving
			.filter((item) => daysIdle(item, now) <= NOT_MOVING_DAYS + 7)
			.sort(byName)
			.map((item) => row(item.item_name, `${item.quantity} ${item.unit}`))
		sections.push(
			[
				heading(ICON.notMoving, `Not moving for ${NOT_MOVING_DAYS} days`, notMoving.length),
				joined.length > 0 ? `${joined.length} new this week:` : italic('None new this week'),
				...capped(joined),
			].join('\n'),
		)
	}

	if (sections.length === 0) return null
	const title = facts(
		`${ICON.summary} ${bold('Morning summary')}`,
		`${WEEKDAYS[weekday]} ${dayMonth(today)}`,
	)
	return [title, ...sections].join('\n\n')
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
