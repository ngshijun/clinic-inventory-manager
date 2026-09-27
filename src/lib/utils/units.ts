import type { UnitParts } from '../../../convex/lib/units'

/** The Unit field as a form holds it: an empty number means the unit holds nothing countable */
export interface UnitForm {
	unit: string
	pack_size: number | ''
	pack_unit: string
}

export const emptyUnitForm = (): UnitForm => ({ unit: '', pack_size: '', pack_unit: '' })

export const unitFormFrom = (parts: UnitParts): UnitForm => ({
	unit: parts.unit,
	pack_size: parts.pack_size ?? '',
	pack_unit: parts.pack_unit ?? '',
})

/** The parts to save, or null while the field is incomplete */
export function unitFormParts(form: UnitForm): UnitParts | null {
	if (!form.unit) return null
	if (form.pack_size === '' || form.pack_size === null) return { unit: form.unit }
	const size = Number(form.pack_size)
	if (!Number.isInteger(size) || size <= 0 || !form.pack_unit) return null
	return { unit: form.unit, pack_size: size, pack_unit: form.pack_unit }
}
