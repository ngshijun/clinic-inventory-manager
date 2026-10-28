import { v, type Infer } from 'convex/values'
import {
	internalMutation,
	internalQuery,
	type MutationCtx,
	type QueryCtx,
} from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { demandOf, demandSince, type Demand } from './lib/demand'
import { batchesOf } from './lib/stock'
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
	toIsoDate,
} from './lib/orders'
import {
	ICON,
	bold,
	buttonsAnswered,
	dayMonth,
	entry,
	facts,
	left,
	listed,
	notify,
	plural,
	snoozeEndedMessage,
	supplierLine,
	weekdayDate,
	type Button,
	type Notice,
} from './lib/telegram'

type Item = Doc<'inventory'>
type OrderedStatus = Extract<NonNullable<Item['order_status']>, { kind: 'ordered' }>

/** Items named under Order first */
const ORDER_FIRST = 5

/** Rows a list of details shows; a longer one is read on the Dashboard */
const DETAIL_ROWS = 10

const isMonday = (date: string): boolean => new Date(`${date}T00:00:00Z`).getUTCDay() === 1

/** The lists a button under the summary asks for */
export const detailKey = v.union(
	v.literal('late'),
	v.literal('expiring'),
	v.literal('next'),
	v.literal('idle'),
)
export type DetailKey = Infer<typeof detailKey>

export const isDetailKey = (value: unknown): value is DetailKey =>
	detailKey.members.some((member) => member.value === value)

/** The Dashboard's queues at one moment, each in the order it is read in */
export interface Queues {
	now: number
	today: string
	toOrder: Item[]
	/** The items to order that are in use, the most in demand first */
	inDemand: { item: Item; demand: Demand }[]
	/** The longest overdue first */
	late: { item: Item; status: OrderedStatus }[]
	/** The soonest first, so the batches already expired lead */
	expiring: { item: Item; quantity: number; expiry: string }[]
	/** The latest to stop moving first */
	notMoving: Item[]
}

const byName = (a: Item, b: Item): number => a.item_name.localeCompare(b.item_name)

/** `movements` are every item's since `demandSince(now)`. */
export function queuesAt(
	items: Item[],
	batches: Doc<'stock_batches'>[],
	movements: Doc<'stock_movements'>[],
	now: number,
): Queues {
	const today = clinicToday(now)
	const toOrder = items.filter((item) => needsDecision(item, today))

	// How often an item is taken decides its place, and how fast it goes settles a tie
	const movementsByItem = new Map<Id<'inventory'>, Doc<'stock_movements'>[]>()
	for (const movement of movements) {
		const own = movementsByItem.get(movement.item_id)
		if (own) own.push(movement)
		else movementsByItem.set(movement.item_id, [movement])
	}
	const inDemand = toOrder
		.flatMap((item) => {
			const demand = demandOf(item, movementsByItem.get(item._id) ?? [], now)
			return demand ? [{ item, demand }] : []
		})
		.sort(
			(a, b) =>
				b.demand.daysTakenPerMonth - a.demand.daysTakenPerMonth ||
				b.demand.quantityPerMonth - a.demand.quantityPerMonth ||
				byName(a.item, b.item),
		)

	const due = (status: OrderedStatus): string =>
		status.expected_by ?? addDays(status.ordered_on, BACK_ORDER_LATE_DAYS)
	const late = items
		.flatMap((item) => {
			const status = item.order_status
			return status?.kind === 'ordered' && isLate(status, today) ? [{ item, status }] : []
		})
		.sort((a, b) => due(a.status).localeCompare(due(b.status)) || byName(a.item, b.item))

	const itemsById = new Map(items.map((item) => [item._id, item]))
	const expiring = batches
		.flatMap((batch) => {
			const item = itemsById.get(batch.item_id)
			const expiry = toIsoDate(batch.expiry_date)
			if (!item || item.not_track || !expiry || batch.quantity <= 0) return []
			if (daysBetween(today, expiry) > EXPIRY_WARNING_DAYS) return []
			return [{ item, quantity: batch.quantity, expiry }]
		})
		.sort((a, b) => a.expiry.localeCompare(b.expiry) || byName(a.item, b.item))

	const notMoving = items
		.filter((item) => isNotMoving(item, now))
		.sort((a, b) => b.updated_at - a.updated_at || byName(a, b))

	return { now, today, toOrder, inDemand, late, expiring, notMoving }
}

/** One item of a list, led by a bullet where no icon says its state */
const bullet = (name: string, details: string[]): string => entry(name, details, '• ')

/** An item to order, led by how low it is; its rank is its place in the list */
const demandEntry = ({ item, demand }: Queues['inDemand'][number]): string => {
	const monthly = Math.max(1, Math.round(demand.quantityPerMonth))
	return entry(
		item.item_name,
		[facts(left(item), `uses ${monthly} ${item.unit} a month`)],
		`${item.quantity === 0 ? ICON.out : ICON.low} `,
	)
}

const button = (key: DetailKey, text: string): Button => ({ text, callback_data: key })

/**
 * The morning's message, or null on a day with nothing to say. It is meant
 * to fit one phone screen: the few items to order first are named, in order
 * of demand, and every other Dashboard queue is one line with its count.
 * Each of those lines has a button that asks for its list; see `detailText`.
 */
export function morningSummary(queues: Queues): { text: string; buttons: Button[][] } | null {
	const { now, today, inDemand, late, expiring, notMoving } = queues
	const also: string[] = []
	const buttons: Button[] = []

	if (late.length > 0) {
		also.push(`${ICON.late} ${plural(late.length, 'delivery', 'deliveries')} late`)
		buttons.push(button('late', `${ICON.late} Late (${late.length})`))
	}

	if (expiring.length > 0) {
		const expired = expiring.filter(({ expiry }) => expiry < today).length
		also.push(
			facts(
				`${ICON.expiring} ${plural(expiring.length, 'batch', 'batches')} expiring`,
				...(expired > 0 ? [`${expired} already expired`] : []),
			),
		)
		buttons.push(button('expiring', `${ICON.expiring} Expiring (${expiring.length})`))
	}

	const next = Math.min(DETAIL_ROWS, inDemand.length - ORDER_FIRST)
	if (next > 0) buttons.push(button('next', `${ICON.toOrder} Next ${next} to order`))

	// A slow list, so it is told once a week, with how many joined it since the last time
	if (isMonday(today) && notMoving.length > 0) {
		const joined = notMoving.filter((item) => daysIdle(item, now) <= NOT_MOVING_DAYS + 7).length
		also.push(
			facts(
				`${ICON.notMoving} ${notMoving.length} not moving`,
				...(joined > 0 ? [`${joined} new this week`] : []),
			),
		)
		buttons.push(button('idle', `${ICON.notMoving} Not moving (${notMoving.length})`))
	}

	const orderFirst = inDemand.slice(0, ORDER_FIRST).map(demandEntry)
	const blocks: string[] = []
	if (orderFirst.length > 0) blocks.push(`${bold('Order first')}\n${orderFirst.join('\n\n')}`)
	if (also.length > 0) {
		blocks.push([...(orderFirst.length > 0 ? [bold('Also today')] : []), ...also].join('\n'))
	}
	if (blocks.length === 0) return null
	const title = `${ICON.summary} ${bold(weekdayDate(today, today))}`
	return {
		text: [title, ...blocks].join('\n\n'),
		// One to a row, so a label is never cut short on a phone
		buttons: buttons.map((button) => [button]),
	}
}

/**
 * The list behind one line of the summary, as it stands when it is asked
 * for, which may be hours after the summary was posted.
 */
export function detailText(key: DetailKey, queues: Queues): string {
	const { now, today, inDemand, late, expiring, notMoving } = queues
	const list = (heading: string, rows: string[], none: string): string =>
		rows.length === 0
			? none
			: listed(heading, [
					...rows.slice(0, DETAIL_ROWS),
					...(rows.length > DETAIL_ROWS
						? [`${rows.length - DETAIL_ROWS} more are on the Dashboard.`]
						: []),
				])

	switch (key) {
		case 'late':
			return list(
				`${ICON.late} ${bold('Late deliveries')} (${late.length})`,
				late.map(({ item, status }) =>
					bullet(item.item_name, [
						facts(
							status.expected_by
								? `${plural(daysBetween(status.expected_by, today), 'day')} late`
								: `No date, ordered ${dayMonth(status.ordered_on)}`,
							`${status.quantity - status.received} ${item.unit}`,
						),
						...supplierLine(item),
					]),
				),
				'No delivery is late now.',
			)
		case 'expiring':
			return list(
				`${ICON.expiring} ${bold('Expiring batches')} (${expiring.length})`,
				expiring.map(({ item, quantity, expiry }) =>
					bullet(item.item_name, [
						facts(
							expiry < today
								? `Expired ${dayMonth(expiry)}`
								: expiry === today
									? 'Expires today'
									: `Expires ${dayMonth(expiry)}`,
							`${quantity} ${item.unit}`,
						),
					]),
				),
				'No batch is expiring now.',
			)
		case 'next':
			return list(
				`${ICON.toOrder} ${bold('Next to order')}`,
				inDemand.slice(ORDER_FIRST).map(demandEntry),
				'Nothing more to order is in use now.',
			)
		case 'idle':
			return list(
				`${ICON.notMoving} ${bold('Not moving')} (${notMoving.length})`,
				notMoving.map((item) =>
					bullet(item.item_name, [
						facts(
							`${item.quantity} ${item.unit}`,
							`Last moved ${plural(daysIdle(item, now), 'day')} ago`,
						),
					]),
				),
				'Every item with stock has moved lately.',
			)
	}
}

async function queuesNow(ctx: QueryCtx, now: number): Promise<Queues> {
	// Bounded by product count and by stock on hand, as inventory.list and stock.listBatches are
	const items = await ctx.db.query('inventory').collect()
	const batches = await ctx.db.query('stock_batches').collect()
	// Bounded by the window: a few thousand movements at the clinic's pace
	const movements = await ctx.db
		.query('stock_movements')
		.withIndex('by_creation_time', (q) => q.gte('_creationTime', demandSince(now)))
		.collect()
	return queuesAt(items, batches, movements, now)
}

/**
 * Clears every snooze whose date has come, a day the cron missed included,
 * and returns the alert for each item still low. The item is not marked
 * updated: nobody touched it, and Not Moving counts from the last touch.
 */
async function clearEndedSnoozes(ctx: MutationCtx, today: string): Promise<Notice[]> {
	const alerts: Notice[] = []
	// Bounded by product count, as inventory.list is
	for (const item of (await ctx.db.query('inventory').collect()).sort(byName)) {
		const snooze = item.order_status
		if (snooze?.kind !== 'snoozed' || snooze.until > today) continue
		await ctx.db.patch(item._id, { order_status: undefined })
		const alert = snoozeEndedMessage(item, snooze, await batchesOf(ctx, item._id))
		if (alert) alerts.push(alert)
	}
	return alerts
}

/** Run by the cron in crons.ts: the summary, then an alert for each snooze that ended. */
export const sendMorning = internalMutation({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const now = Date.now()
		const alerts = await clearEndedSnoozes(ctx, clinicToday(now))
		const summary = morningSummary(await queuesNow(ctx, now))
		await notify(
			ctx,
			summary && {
				text: summary.text,
				pin: true,
				...(buttonsAnswered() && summary.buttons.length > 0 ? { buttons: summary.buttons } : {}),
			},
			...alerts,
		)
		return null
	},
})

/** What the webhook in telegram.ts replies with when a button is pressed. */
export const detail = internalQuery({
	args: { key: detailKey, now: v.number() },
	returns: v.string(),
	handler: async (ctx, args) => detailText(args.key, await queuesNow(ctx, args.now)),
})
