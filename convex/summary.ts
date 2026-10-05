import { v, type Infer } from 'convex/values'
import { env, internalMutation, internalQuery, type QueryCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { demandOf, demandSince, type Demand } from './lib/demand'
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
	entry,
	facts,
	left,
	notify,
	plural,
	supplierLine,
	weekdayDayMonth,
	type Button,
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
	v.literal('snoozes'),
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
	/** Snoozes that end today on an item still low */
	woke: Item[]
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

	const woke = items
		.filter(
			(item) =>
				needsStock(item) &&
				item.order_status?.kind === 'snoozed' &&
				item.order_status.until === today,
		)
		.sort(byName)

	const notMoving = items
		.filter((item) => isNotMoving(item, now))
		.sort((a, b) => b.updated_at - a.updated_at || byName(a, b))

	return { now, today, toOrder, inDemand, late, expiring, woke, notMoving }
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
	const { now, today, inDemand, late, expiring, woke, notMoving } = queues
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

	if (woke.length > 0) {
		also.push(`${ICON.snooze} ${plural(woke.length, 'snooze')} ended`)
		buttons.push(button('snoozes', `${ICON.snooze} Snoozes ended (${woke.length})`))
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
	if (orderFirst.length > 0) blocks.push([bold('Order first'), ...orderFirst].join('\n'))
	if (also.length > 0) {
		blocks.push([...(orderFirst.length > 0 ? [bold('Also today')] : []), ...also].join('\n'))
	}
	if (blocks.length === 0) return null
	const title = `${ICON.summary} ${bold(weekdayDayMonth(today))}`
	return {
		text: [title, ...blocks].join('\n\n'),
		// Two to a row, so a label is never cut short on a phone
		buttons: buttons.flatMap((_, index) =>
			index % 2 === 0 ? [buttons.slice(index, index + 2)] : [],
		),
	}
}

/**
 * The list behind one line of the summary, as it stands when it is asked
 * for, which may be hours after the summary was posted.
 */
export function detailText(key: DetailKey, queues: Queues): string {
	const { now, today, inDemand, late, expiring, woke, notMoving } = queues
	const list = (heading: string, rows: string[], none: string): string =>
		rows.length === 0
			? none
			: [
					heading,
					...rows.slice(0, DETAIL_ROWS),
					...(rows.length > DETAIL_ROWS
						? [`and ${rows.length - DETAIL_ROWS} more on the Dashboard`]
						: []),
				].join('\n')

	switch (key) {
		case 'late':
			return list(
				`${ICON.late} ${bold('Late deliveries')} (${late.length})`,
				late.map(({ item, status }) =>
					bullet(item.item_name, [
						facts(
							status.expected_by
								? `${plural(daysBetween(status.expected_by, today), 'day')} late`
								: `no date, ordered ${dayMonth(status.ordered_on)}`,
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
								? `expired ${dayMonth(expiry)}`
								: expiry === today
									? 'expires today'
									: `expires ${dayMonth(expiry)}`,
							`${quantity} ${item.unit}`,
						),
					]),
				),
				'No batch is expiring now.',
			)
		case 'snoozes':
			return list(
				`${ICON.snooze} ${bold('Snoozes ended today')} (${woke.length})`,
				woke.map((item) => bullet(item.item_name, [left(item)])),
				'No snooze ended today.',
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
						facts(`${item.quantity} ${item.unit}`, `${plural(daysIdle(item, now), 'day')} idle`),
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

/** Run by the cron in crons.ts. */
export const sendMorning = internalMutation({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const summary = morningSummary(await queuesNow(ctx, Date.now()))
		if (!summary) return null
		// A button is only worth showing where the webhook that answers it is set up; see telegram.ts
		const answered = env.TELEGRAM_WEBHOOK_SECRET && summary.buttons.length > 0
		await notify(ctx, summary.text, {
			pin: true,
			...(answered ? { buttons: summary.buttons } : {}),
		})
		return null
	},
})

/** What the webhook in telegram.ts replies with when a button is pressed. */
export const detail = internalQuery({
	args: { key: detailKey, now: v.number() },
	returns: v.string(),
	handler: async (ctx, args) => detailText(args.key, await queuesNow(ctx, args.now)),
})
