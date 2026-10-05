/*
 * What the clinic's Telegram group is told as it happens, and the words it
 * is told in. Telegram reads a message as HTML, so every name goes through
 * `plain` first.
 *
 * Every message is laid out the same way, the summary in summary.ts
 * included, so it is read at a glance on a phone: the icon and the state in
 * bold on the first line, with the one number that belongs to the state, the
 * item on a line of its own with a blank line either side so it stands
 * clear, then its facts. Bold is kept for the first line, a
 * heading and an item's name, so those are what the eye lands on; a fact
 * never is. In a list the item's icon leads its name, so every item starts
 * at the left edge however far its name wraps, and a blank line parts one
 * item from the next.
 */
import { internal } from '../_generated/api'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { clinicToday, daysBetween } from './orders'

type Item = Doc<'inventory'>
type OrderedStatus = Extract<NonNullable<Item['order_status']>, { kind: 'ordered' }>

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** One icon for one state, the same in every message. Telegram has no colour, so these carry it. */
export const ICON = {
	low: '🟡',
	out: '🔴',
	ordered: '✅',
	orderChanged: '✏️',
	arrived: '📦',
	snooze: '⏰',
	summary: '☀️',
	late: '🚚',
	expiring: '⏳',
	toOrder: '🛒',
	notMoving: '💤',
} as const

/**
 * A button under a message. Pressing it sends nothing to the chat: it tells
 * the bot `callback_data`, and the webhook in telegram.ts answers.
 */
export interface Button {
	text: string
	callback_data: string
}

/**
 * Posts to the group once the mutation has committed, so a mutation that
 * fails says nothing. A null message is an event not worth telling.
 * `buttons` are rows of buttons to set under the message; `pin` keeps the
 * message at the top of the group in place of whatever was pinned before.
 */
export async function notify(
	ctx: MutationCtx,
	text: string | null,
	options: { buttons?: Button[][]; pin?: boolean } = {},
): Promise<void> {
	if (text === null) return
	await ctx.scheduler.runAfter(0, internal.telegram.send, { text, ...options })
}

export const plain = (text: string): string =>
	text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** "05 Oct" from "2026-10-05", as the pages show a date in a tight spot */
export const dayMonth = (date: string): string =>
	`${date.slice(8, 10)} ${MONTHS[Number(date.slice(5, 7)) - 1]}`

/** "Mon 05 Oct" from "2026-10-05" */
export const weekdayDayMonth = (date: string): string =>
	`${WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]} ${dayMonth(date)}`

/**
 * A date as the reader thinks of it: "Thu 09 Oct, in 4 days", so nobody
 * counts from today. Two weeks or more are told in weeks.
 */
export function whenIs(date: string, today: string): string {
	const days = daysBetween(today, date)
	const relative =
		days === 0
			? 'today'
			: days === 1
				? 'tomorrow'
				: days < 0
					? `${plural(-days, 'day')} ago`
					: days < 14
						? `in ${days} days`
						: `in ${plural(Math.round(days / 7), 'week')}`
	return `${weekdayDayMonth(date)}, ${relative}`
}

export const plural = (count: number, noun: string, many = `${noun}s`): string =>
	`${count} ${count === 1 ? noun : many}`

export const bold = (text: string): string => `<b>${text}</b>`

/** Facts that share a line: "3 BOX left · uses 14 BOX a month" */
export const facts = (...parts: string[]): string => parts.join(' · ')

/** What is on hand, in the item's unit without its pack size: a phone line is short */
export const left = (item: Item): string =>
	item.quantity === 0 ? 'None left' : `${item.quantity} ${item.unit} left`

/** The supplier on a line of its own, for an item that has one */
export const supplierLine = (item: Item): string[] =>
	item.supplier ? [`Supplier: ${plain(item.supplier)}`] : []

/** Sets a line in under the one above it, in spaces Telegram does not trim */
const INDENT = '    '

/**
 * An item and what is said about it: the name in bold on a line of its own,
 * since one runs to 60 letters, and each fact set in under it. `marker` leads
 * the name in a list: the item's icon, or a bullet where it has none.
 */
export const entry = (name: string, details: string[], marker = ''): string =>
	[`${marker}${bold(plain(name))}`, ...details.map((detail) => `${INDENT}${detail}`)].join('\n')

/** A heading and the items under it, a blank line between each */
export const listed = (heading: string, rows: string[]): string => [heading, ...rows].join('\n\n')

/**
 * One event about one item: the icon and the state, the item, then its
 * facts, each apart. The facts stand flush, since the blank line already
 * parts them from the name.
 */
const message = (icon: string, state: string, item: Item, details: string[]): string =>
	[
		`${icon} ${bold(state)}`,
		bold(plain(item.item_name)),
		...(details.length > 0 ? [details.join('\n')] : []),
	].join('\n\n')

const today = (): string => clinicToday(Date.now())

/**
 * A fall in stock worth telling: the item ran out, or dropped to its reorder
 * level. One the purchaser has already ordered or put aside needs nothing
 * done, so nothing is said.
 */
export function stockDropMessage(before: Item, after: Item): string | null {
	if (after.not_track || after.quantity >= before.quantity) return null
	const status = after.order_status
	if (status?.kind === 'ordered') return null
	if (status?.kind === 'snoozed' && status.until > today()) return null

	if (after.quantity === 0) return message(ICON.out, 'Out of stock', after, supplierLine(after))
	if (after.quantity <= after.reorder_level && before.quantity > before.reorder_level) {
		return message(ICON.low, 'Running low', after, [left(after), ...supplierLine(after)])
	}
	return null
}

const expected = (status: OrderedStatus): string =>
	status.expected_by ? `Expected ${whenIs(status.expected_by, today())}` : 'No date yet'

/** An item marked ordered, or an order whose quantity or expected date changed. */
export function orderedMessage(before: Item, after: Item): string | null {
	const status = after.order_status
	if (status?.kind !== 'ordered') return null
	const previous = before.order_status?.kind === 'ordered' ? before.order_status : null
	if (previous?.quantity === status.quantity && previous.expected_by === status.expected_by) {
		return null
	}

	const details = [expected(status), ...supplierLine(after)]
	if (status.received > 0) details.push(`${status.received} received so far`)
	const amount = `${status.quantity} ${after.unit}`
	return previous
		? message(ICON.orderChanged, `Order changed to ${amount}`, after, details)
		: message(ICON.ordered, `Ordered ${amount}`, after, details)
}

/** Stock in for an item on order: what came, and what is still to come. */
export function arrivedMessage(before: Item, quantity: number): string | null {
	const status = before.order_status
	if (status?.kind !== 'ordered') return null
	const toCome = status.quantity - status.received - quantity
	return message(ICON.arrived, `Arrived ${quantity} ${before.unit}`, before, [
		toCome > 0 ? `${toCome} still to come` : 'Order complete',
	])
}

/** An item put aside, or a snooze whose date or reason changed. */
export function snoozedMessage(before: Item, after: Item): string | null {
	const status = after.order_status
	if (status?.kind !== 'snoozed') return null
	const previous = before.order_status
	if (
		previous?.kind === 'snoozed' &&
		previous.until === status.until &&
		previous.reason === status.reason
	) {
		return null
	}
	return message(ICON.snooze, `Snoozed to ${whenIs(status.until, today())}`, after, [
		plain(status.reason),
		left(after),
	])
}
