/*
 * An item's unit in three parts: the unit it is counted in ("BOX") and,
 * when that unit holds something, how many of what ("30", "TAB"). Pure
 * functions shared by the server and the app, so both write and read
 * "BOX (30 TAB)" the same way.
 */
export interface UnitParts {
	unit: string
	pack_size?: number
	pack_unit?: string
}

/** A unit name is capital letters only, so one unit has one spelling. */
export const UNIT_NAME_PATTERN = /^[A-Z]{1,12}$/

export const normalizeUnitName = (name: string): string => name.trim().toUpperCase()

/** "BOX (30 TAB)", or "BOX" when the unit holds nothing countable. */
export function unitLabel(parts: UnitParts): string {
	return parts.pack_size !== undefined && parts.pack_unit
		? `${parts.unit} (${parts.pack_size} ${parts.pack_unit})`
		: parts.unit
}

/**
 * Reads a label as a person would type it in a spreadsheet. Spacing and
 * letter case are forgiven; anything else that does not fit returns null.
 */
export function parseUnitLabel(text: string): UnitParts | null {
	const match = text
		.trim()
		.toUpperCase()
		.match(/^([A-Z]+)(?:\s*\(\s*(\d+)\s*([A-Z]+)\s*\))?$/)
	if (!match) return null
	const [, unit, size, packUnit] = match
	if (!UNIT_NAME_PATTERN.test(unit)) return null
	if (size === undefined) return { unit }
	const pack_size = Number(size)
	if (pack_size <= 0 || !UNIT_NAME_PATTERN.test(packUnit)) return null
	return { unit, pack_size, pack_unit: packUnit }
}

export const sameUnit = (a: UnitParts, b: UnitParts): boolean =>
	a.unit === b.unit && a.pack_size === b.pack_size && a.pack_unit === b.pack_unit
