/*
 * What the clinic's Telegram group is told as it happens, and the words it
 * is told in. Telegram reads a message as HTML, so every name goes through
 * `plain` first.
 *
 * A message about one item is written in complete sentences, so it reads
 * like a note from a person. The first line names the item and what
 * happened to it, after the icon of its state, since that line is all a
 * phone shows before the chat is opened. The item's name is in bold, so it
 * is what the eye lands on; a fact never is. The facts follow after a blank
 * line, a sentence to a line. A date the reader acts on is written out in
 * full; a list, such as the summary in summary.ts, is read at a glance
 * instead, so it keeps short dates and lays out each item with `entry`.
 */
import { internal } from '../_generated/api'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { clinicToday, daysBetween, toIsoDate } from './orders'

type Item = Doc<'inventory'>
type Batch = Doc<'stock_batches'>

const MONTHS = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December',
]
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

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

/** A message for the group, and how it is posted */
export interface Notice {
	text: string
	/** Rows of buttons to set under the message */
	buttons?: Button[][]
	/** Keeps the message at the top of the group in place of whatever was pinned before */
	pin?: boolean
	/** Posts without ringing anyone's phone: a change to something the group was already told */
	silent?: boolean
}

/**
 * Posts to the group once the mutation has committed, so a mutation that
 * fails says nothing. A null notice is an event not worth telling.
 */
export async function notify(ctx: MutationCtx, notice: Notice | null): Promise<void> {
	if (notice === null) return
	await ctx.scheduler.runAfter(0, internal.telegram.send, notice)
}

export const plain = (text: string): string =>
	text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** "5 Oct" from "2026-10-05", for a list, where a line is short */
export const dayMonth = (date: string): string =>
	`${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1].slice(0, 3)}`

/** "5 October" from "2026-10-05", with the year when it is not this one's: "9 March 2027" */
export const fullDate = (date: string, today: string): string => {
	const year = date.slice(0, 4)
	const dayAndMonth = `${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1]}`
	return year === today.slice(0, 4) ? dayAndMonth : `${dayAndMonth} ${year}`
}

/** "Monday 5 October" from "2026-10-05", for a day someone will act on */
export const weekdayDate = (date: string, today: string): string =>
	`${WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]} ${fullDate(date, today)}`

/**
 * A day as the reader thinks of it: "Thursday 9 October, in 4 days", so
 * nobody counts from today. Two weeks or more are told in weeks.
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
	return `${weekdayDate(date, today)}, ${relative}`
}

export const plural = (count: number, noun: string, many = `${noun}s`): string =>
	`${count} ${count === 1 ? noun : many}`

export const bold = (text: string): string => `<b>${text}</b>`

/** Facts that share a line of a list: "3 BOX left · uses 14 BOX a month" */
export const facts = (...parts: string[]): string => parts.join(' · ')

/** What is on hand, in the item's unit without its pack size: a phone line is short */
export const left = (item: Item): string =>
	item.quantity === 0 ? 'None left' : `${item.quantity} ${item.unit} left`

/** The supplier on a line of its own in a list, for an item that has one */
export const supplierLine = (item: Item): string[] =>
	item.supplier ? [`Supplier: ${plain(item.supplier)}`] : []

/** Sets a line in under the one above it, in spaces Telegram does not trim */
const INDENT = '    '

/**
 * An item of a list and what is said about it: the name in bold on a line
 * of its own, since one runs to 60 letters, and each fact set in under it.
 * `marker` leads the name: the item's icon, or a bullet where it has none.
 */
export const entry = (name: string, details: string[], marker = ''): string =>
	[`${marker}${bold(plain(name))}`, ...details.map((detail) => `${INDENT}${detail}`)].join('\n')

/** A heading and the items under it, a blank line between each */
export const listed = (heading: string, rows: string[]): string => [heading, ...rows].join('\n\n')

const name = (item: Item): string => bold(plain(item.item_name))

/** One event about one item: the first line, then its facts a sentence to a line */
const message = (icon: string, headline: string, details: string[], silent = false): Notice => ({
	text: [`${icon} ${headline}`, ...(details.length > 0 ? [details.join('\n')] : [])].join('\n\n'),
	...(silent ? { silent } : {}),
})

const suppliedBy = (item: Item): string[] =>
	item.supplier ? [`Supplied by ${plain(item.supplier)}.`] : []

/**
 * What is left and when it expires: "3 BOX left, the earliest expiring 9
 * December." The earliest date is the one told, since that stock is used
 * first. A snooze `until` a later day is warned of.
 */
function leftSentence(item: Item, batches: Batch[], today: string, until?: string): string {
	const held = batches.filter((batch) => batch.quantity > 0)
	const [earliest] = held
		.flatMap((batch) => {
			const expiry = toIsoDate(batch.expiry_date)
			return expiry ? [expiry] : []
		})
		.sort()
	if (!earliest) return `${left(item)}.`
	const expiry =
		earliest < today
			? `expired on ${fullDate(earliest, today)}`
			: earliest === today
				? 'expiring today'
				: `expiring ${fullDate(earliest, today)}`
	const beforeUntil =
		until && earliest >= today && earliest < until ? ', before the snooze ends' : ''
	return `${left(item)}, ${held.length > 1 ? 'the earliest ' : ''}${expiry}${beforeUntil}.`
}

/**
 * A fall in stock worth telling: the item ran out, or dropped to its reorder
 * level. One the purchaser has already ordered or put aside needs nothing
 * done, so nothing is said. `batches` are the item's after the fall.
 */
export function stockDropMessage(before: Item, after: Item, batches: Batch[]): Notice | null {
	const today = clinicToday(Date.now())
	if (after.not_track || after.quantity >= before.quantity) return null
	const status = after.order_status
	if (status?.kind === 'ordered') return null
	if (status?.kind === 'snoozed' && status.until > today) return null

	if (after.quantity === 0) {
		return message(ICON.out, `${name(after)} is out of stock.`, suppliedBy(after))
	}
	if (after.quantity <= after.reorder_level && before.quantity > before.reorder_level) {
		return message(ICON.low, `${name(after)} is running low.`, [
			leftSentence(after, batches, today),
			...suppliedBy(after),
		])
	}
	return null
}

/**
 * An item marked ordered, or an order whose quantity or expected date
 * changed. A change is posted silently: the group already knows of the order.
 */
export function orderedMessage(before: Item, after: Item): Notice | null {
	const status = after.order_status
	if (status?.kind !== 'ordered') return null
	const previous = before.order_status?.kind === 'ordered' ? before.order_status : null
	if (previous?.quantity === status.quantity && previous.expected_by === status.expected_by) {
		return null
	}

	const today = clinicToday(Date.now())
	const amount = `${status.quantity} ${after.unit}`
	const details = [
		status.expected_by
			? `Expected on ${whenIs(status.expected_by, today)}.`
			: 'No delivery date yet.',
		...(status.received > 0 ? [`${status.received} ${after.unit} received so far.`] : []),
		...suppliedBy(after),
	]
	return previous
		? message(
				ICON.orderChanged,
				`The order for ${name(after)} has changed.`,
				[`${amount} on order.`, ...details],
				true,
			)
		: message(ICON.ordered, `${amount} of ${name(after)} ordered.`, details)
}

/** Stock in for an item on order: what came, when it expires, and what is still to come. */
export function arrivedMessage(
	before: Item,
	quantity: number,
	expiry_date: string | undefined,
): Notice | null {
	const status = before.order_status
	if (status?.kind !== 'ordered') return null
	const today = clinicToday(Date.now())
	const expiry = toIsoDate(expiry_date)
	const toCome = status.quantity - status.received - quantity
	return message(ICON.arrived, `${quantity} ${before.unit} of ${name(before)} arrived.`, [
		...(expiry
			? [
					expiry < today
						? `Expired on ${fullDate(expiry, today)}.`
						: `Expires ${expiry === today ? 'today' : fullDate(expiry, today)}.`,
				]
			: []),
		toCome > 0
			? `${toCome} ${before.unit} ${toCome === 1 ? 'is' : 'are'} still to come.`
			: 'The order is complete.',
	])
}

/**
 * An item put aside, or a snooze whose date or reason changed, which is
 * posted silently. `batches` are the item's, for when what is left expires.
 */
export function snoozedMessage(before: Item, after: Item, batches: Batch[]): Notice | null {
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
	const today = clinicToday(Date.now())
	return message(
		ICON.snooze,
		`${name(after)} is snoozed until ${whenIs(status.until, today)}.`,
		[`Reason: ${plain(status.reason)}`, leftSentence(after, batches, today, status.until)],
		previous?.kind === 'snoozed',
	)
}
