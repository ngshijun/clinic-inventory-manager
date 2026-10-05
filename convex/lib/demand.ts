/*
 * How much an item is in demand: how often it is taken and how fast it
 * goes, read from the stock movements of the last DEMAND_DAYS. Only the days
 * the item had stock count. Staff use a replacement once an item runs out, so
 * its own use stops there, and counting those days would mark down the very
 * items that ran out first.
 */
import type { Doc } from '../_generated/dataModel'
import { clinicToday } from './orders'

/** Days of stock movements that demand is read from */
export const DEMAND_DAYS = 90

/**
 * Days in stock within DEMAND_DAYS before a rate means anything. An item with
 * fewer has been out so long that the clinic is managing without it.
 */
const MIN_DAYS_IN_STOCK = 14

const DAY = 86_400_000

/** The instant the movements that demand is read from begin */
export const demandSince = (now: number): number => now - DEMAND_DAYS * DAY

export interface Demand {
	/** Days in a month on which the item is taken: how often */
	daysTakenPerMonth: number
	/** How many of the item's unit go in a month: how fast */
	quantityPerMonth: number
}

/**
 * `movements` are the item's own since `demandSince(now)`, in any order.
 * Null when the item was not taken, or had stock too briefly to say.
 */
export function demandOf(
	item: Pick<Doc<'inventory'>, 'quantity'>,
	movements: Doc<'stock_movements'>[],
	now: number,
): Demand | null {
	// Walk back from the quantity on hand, undoing each movement, to find the days there was stock
	let level = item.quantity
	let until = now
	let inStock = 0
	let taken = 0
	const daysTaken = new Set<string>()
	for (const movement of [...movements].sort((a, b) => b._creationTime - a._creationTime)) {
		if (level > 0) inStock += until - movement._creationTime
		until = movement._creationTime
		if (movement.movement_type === 'stock_out') {
			level += movement.quantity
			taken += movement.quantity
			daysTaken.add(clinicToday(movement._creationTime))
		} else {
			level = Math.max(0, level - movement.quantity)
		}
	}
	if (level > 0) inStock += until - demandSince(now)

	const days = inStock / DAY
	if (taken === 0 || days < MIN_DAYS_IN_STOCK) return null
	return {
		daysTakenPerMonth: (daysTaken.size / days) * 30,
		quantityPerMonth: (taken / days) * 30,
	}
}
