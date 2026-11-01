import type { Doc, Id } from '#convex/_generated/dataModel.js'
import type { WithLegacy } from '#lib/types/legacy.js'

export type LoanId = Id<'loans'>
export type LoanDirection = Doc<'loans'>['direction']

/**
 * Medicine borrowed from or lent to another clinic. `unit_label` is the unit
 * as copied onto the entry, "BTL (60 ML)"; `owed` is what is still to come back.
 */
export type Loan = WithLegacy<Doc<'loans'>> & { unit_label: string; returned: number; owed: number }

/** What the Add Entry and Edit Entry form provides */
export interface LoanEntry {
	direction: LoanDirection
	clinic: string
	item_id: Id<'inventory'>
	quantity: number
	loaned_on: string
	remark: string
}
