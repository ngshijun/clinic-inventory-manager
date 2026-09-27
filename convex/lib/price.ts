/*
 * What an item costs, kept as the purchaser typed it: an amount in ringgit
 * and the unit it was quoted for, "RM 12.00 / BTL". The unit is the item's
 * own unit or the unit of its contents. Pure functions shared by the server
 * and the app.
 */
import type { UnitParts } from './units'

export interface Price {
	amount: number
	unit: string
}

/**
 * The units a price can be quoted in: the item's unit, then its contents
 * when they are packs. `measures` are the units marked on the Units page as
 * amounts, such as TAB or ML, which no supplier quotes a price for.
 */
export function priceUnits(parts: UnitParts, measures: ReadonlySet<string>): string[] {
	const pack = parts.pack_unit
	return parts.pack_size !== undefined && pack && pack !== parts.unit && !measures.has(pack)
		? [parts.unit, pack]
		: [parts.unit]
}

export const roundAmount = (amount: number): number => Math.round(amount * 100) / 100

/** The price of one of the item's unit, or null when the unit has changed since the price was given */
export function pricePerUnit(parts: UnitParts, price: Price): number | null {
	if (price.unit === parts.unit) return price.amount
	if (price.unit === parts.pack_unit && parts.pack_size !== undefined) {
		return roundAmount(price.amount * parts.pack_size)
	}
	return null
}
