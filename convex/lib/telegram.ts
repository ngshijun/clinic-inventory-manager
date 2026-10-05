/*
 * What the clinic's Telegram group is told as it happens, and the words it
 * is told in. Telegram reads a message as HTML, so every name goes through
 * `plain` first.
 *
 * Every message is laid out the same way, the summary in summary.ts
 * included, so it is read at a glance on a phone: the icon and the state in
 * bold on the first line, the item alone on the second, then its facts set
 * in under it, so the name stands clear of what is said about it.
 * Facts that belong together, such as a quantity and its date, share a line
 * with a dot between them; the supplier is a different kind of fact and has a
 * labelled line of its own. Only a heading is bold.
 */
import { internal } from '../_generated/api'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { clinicToday } from './orders'

type Item = Doc<'inventory'>
type OrderedStatus = Extract<NonNullable<Item['order_status']>, { kind: 'ordered' }>

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

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
 * `buttons` are rows of buttons to set under the message.
 */
export async function notify(
	ctx: MutationCtx,
	text: string | null,
	buttons?: Button[][],
): Promise<void> {
	if (text === null) return
	await ctx.scheduler.runAfter(0, internal.telegram.send, { text, ...(buttons ? { buttons } : {}) })
}

export const plain = (text: string): string =>
	text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** "05 Oct" from "2026-10-05", as the pages show a date in a tight spot */
export const dayMonth = (date: string): string =>
	`${date.slice(8, 10)} ${MONTHS[Number(date.slice(5, 7)) - 1]}`

export const plural = (count: number, noun: string, many = `${noun}s`): string =>
	`${count} ${count === 1 ? noun : many}`

export const bold = (text: string): string => `<b>${text}</b>`

/** Facts that share a line: "3 BOX left · reorder at 5" */
export const facts = (...parts: string[]): string => parts.join(' · ')

/** What is on hand, in the item's unit without its pack size: a phone line is short */
export const left = (item: Item): string =>
	item.quantity === 0 ? 'None left' : `${item.quantity} ${item.unit} left`

/** The supplier on a line of its own, for an item that has one */
export const supplierLine = (item: Item): string[] =>
	item.supplier ? [`Supplier: ${plain(item.supplier)}`] : []

/** Sets a line in under the one above it, in spaces Telegram does not trim */
const INDENT = '\u00a0\u00a0\u00a0\u00a0'

/**
 * An item and what is said about it: the name on a line of its own, since one
 * runs to 60 letters, and each fact set in under it. `marker` leads the name
 * in a list: a bullet, or a number where the rank matters.
 */
export const entry = (name: string, details: string[], marker = ''): string =>
	[`${marker}${plain(name)}`, ...details.map((detail) => `${INDENT}${detail}`)].join('\n')

/** One event about one item: the icon and the state, then the item and its facts */
const message = (icon: string, state: string, item: Item, details: string[]): string =>
	`${icon} ${bold(state)}\n${entry(item.item_name, details)}`

const expected = (status: OrderedStatus): string =>
	status.expected_by ? `expected ${dayMonth(status.expected_by)}` : 'no date yet'

/**
 * A fall in stock worth telling: the item ran out, or dropped to its reorder
 * level. Says so when the purchaser has already ordered or snoozed it.
 */
export function stockDropMessage(before: Item, after: Item): string | null {
	if (after.not_track || after.quantity >= before.quantity) return null
	const ranOut = after.quantity === 0
	const wentLow = after.quantity <= after.reorder_level && before.quantity > before.reorder_level
	if (!ranOut && !wentLow) return null

	const details = [left(after), ...supplierLine(after)]
	const status = after.order_status
	if (status?.kind === 'ordered') {
		const toCome = `${status.quantity - status.received} to come`
		details.push(facts('Already ordered', toCome, expected(status)))
	} else if (status?.kind === 'snoozed' && status.until > clinicToday(Date.now())) {
		details.push(facts(`Snoozed until ${dayMonth(status.until)}`, plain(status.reason)))
	}
	return ranOut
		? message(ICON.out, 'Out of stock', after, details)
		: message(ICON.low, 'Running low', after, details)
}

/** An item marked ordered, or an order whose quantity or expected date changed. */
export function orderedMessage(before: Item, after: Item): string | null {
	const status = after.order_status
	if (status?.kind !== 'ordered') return null
	const previous = before.order_status?.kind === 'ordered' ? before.order_status : null
	if (previous?.quantity === status.quantity && previous.expected_by === status.expected_by) {
		return null
	}

	const details = [
		facts(`${status.quantity} ${after.unit}`, expected(status)),
		...supplierLine(after),
	]
	if (status.received > 0) details.push(`${status.received} received so far`)
	return previous
		? message(ICON.orderChanged, 'Order changed', after, details)
		: message(ICON.ordered, 'Ordered', after, details)
}

/** Stock in for an item on order: what came, and what is still to come. */
export function arrivedMessage(before: Item, quantity: number): string | null {
	const status = before.order_status
	if (status?.kind !== 'ordered') return null
	const toCome = status.quantity - status.received - quantity
	return message(ICON.arrived, 'Arrived', before, [
		facts(
			`${quantity} ${before.unit} stocked in`,
			toCome > 0 ? `${toCome} still to come` : 'order complete',
		),
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
	return message(ICON.snooze, 'Snoozed', after, [
		facts(`Until ${dayMonth(status.until)}`, plain(status.reason)),
		left(after),
	])
}
