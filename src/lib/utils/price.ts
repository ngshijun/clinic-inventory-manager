import { priceUnits, roundAmount, type Price } from '../../../convex/lib/price'
import type { UnitParts } from '../../../convex/lib/units'
import { formatRM } from '$lib/utils/money'

/** The Price field as a form holds it: an empty amount means the price is not known */
export interface PriceForm {
	amount: number | ''
	unit: string
}

/** The saved price, or an empty field in the item's own unit */
export function priceFormFrom(item: UnitParts & { price?: Price }): PriceForm {
	const saved = item.price
	return saved && (saved.unit === item.unit || saved.unit === item.pack_unit)
		? { amount: saved.amount, unit: saved.unit }
		: { amount: '', unit: item.unit }
}

/** The units the field offers: what a supplier quotes in, and the saved unit if it is another */
export function priceFormUnits(parts: UnitParts, form: PriceForm): string[] {
	const units = priceUnits(parts)
	return units.includes(form.unit) ? units : [...units, form.unit]
}

export const priceFormIsValid = (form: PriceForm): boolean =>
	form.amount === '' || form.amount === null || Number(form.amount) > 0

/** The price to save, or null when the field is empty */
export function priceFormValue(form: PriceForm): Price | null {
	const amount = roundAmount(Number(form.amount))
	return form.amount === '' || form.amount === null || !(amount > 0)
		? null
		: { amount, unit: form.unit }
}

export const samePrice = (a: Price | null | undefined, b: Price | null | undefined): boolean =>
	(a?.amount ?? null) === (b?.amount ?? null) && (a?.unit ?? null) === (b?.unit ?? null)

/** "RM 12.00 / BTL" */
export const formatPrice = (price: Price): string => `${formatRM(price.amount)} / ${price.unit}`
