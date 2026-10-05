/*
 * What the clinic's Telegram group is told as it happens, and the words it
 * is told in. Telegram reads a message as HTML, so every name goes through
 * `plain` first.
 */
import { internal } from '../_generated/api'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { clinicToday } from './orders'
import { unitLabel } from './units'

type Item = Doc<'inventory'>
type OrderedStatus = Extract<NonNullable<Item['order_status']>, { kind: 'ordered' }>

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * Posts to the group once the mutation has committed, so a mutation that
 * fails says nothing. A null message is an event not worth telling.
 */
export async function notify(ctx: MutationCtx, text: string | null): Promise<void> {
	if (text !== null) await ctx.scheduler.runAfter(0, internal.telegram.send, { text })
}

export const plain = (text: string): string =>
	text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** "05 Oct" from "2026-10-05", as the pages show a date in a tight spot */
export const dayMonth = (date: string): string =>
	`${date.slice(8, 10)} ${MONTHS[Number(date.slice(5, 7)) - 1]}`

export const plural = (count: number, noun: string): string =>
	`${count} ${count === 1 ? noun : `${noun}s`}`

export const fromSupplier = (item: Item): string =>
	item.supplier ? ` from ${plain(item.supplier)}` : ''

const title = (state: string, item: Item): string => `<b>${state}: ${plain(item.item_name)}</b>`

const onHand = (item: Item): string =>
	`${item.quantity} ${unitLabel(item)} left, reorder at ${item.reorder_level}.`

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

	const lines = [title(ranOut ? 'Out of stock' : 'Running low', after), onHand(after)]
	if (after.supplier) lines.push(`Supplier: ${plain(after.supplier)}.`)
	const status = after.order_status
	if (status?.kind === 'ordered') {
		lines.push(`On order: ${status.quantity - status.received} to come, ${expected(status)}.`)
	} else if (status?.kind === 'snoozed' && status.until > clinicToday(Date.now())) {
		lines.push(`Snoozed until ${dayMonth(status.until)}: ${plain(status.reason)}.`)
	}
	return lines.join('\n')
}

/** An item marked ordered, or an order whose quantity or expected date changed. */
export function orderedMessage(before: Item, after: Item): string | null {
	const status = after.order_status
	if (status?.kind !== 'ordered') return null
	const previous = before.order_status?.kind === 'ordered' ? before.order_status : null
	if (previous?.quantity === status.quantity && previous.expected_by === status.expected_by) {
		return null
	}

	const lines = [
		title(previous ? 'Order changed' : 'Ordered', after),
		`${status.quantity} ${unitLabel(after)}${fromSupplier(after)}, ${expected(status)}.`,
	]
	if (status.received > 0) lines.push(`${status.received} received so far.`)
	return lines.join('\n')
}

/** Stock in for an item on order: what came, and what is still to come. */
export function arrivedMessage(before: Item, quantity: number): string | null {
	const status = before.order_status
	if (status?.kind !== 'ordered') return null
	const received = status.received + quantity
	return [
		title('Arrived', before),
		`${quantity} ${unitLabel(before)} stocked in.`,
		received >= status.quantity
			? `The order of ${status.quantity} is complete.`
			: `${received} of ${status.quantity} received, ${status.quantity - received} still to come.`,
	].join('\n')
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
	return [
		title('Snoozed', after),
		`Until ${dayMonth(status.until)}. ${plain(status.reason)}.`,
		onHand(after),
	].join('\n')
}
