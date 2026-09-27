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

/** Contents that are measured out, which no supplier quotes a price for */
const MEASURES: ReadonlySet<string> = new Set([
	'TAB',
	'CAP',
	'ML',
	'G',
	'OZ',
	'DOSE',
	'PLY',
	'SPRAY',
])

/** The units a price can be quoted in: the item's unit, then its contents when they are packs */
export function priceUnits(parts: UnitParts): string[] {
	const pack = parts.pack_unit
	return parts.pack_size !== undefined && pack && pack !== parts.unit && !MEASURES.has(pack)
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
