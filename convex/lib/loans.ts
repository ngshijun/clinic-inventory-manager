/*
 * How much of a borrowed or lent entry has come back. Pure functions shared
 * by the server and the app, so both count an entry the same way.
 */
import type { Doc } from '../_generated/dataModel'

type Returns = Pick<Doc<'loans'>, 'returns'>

export const returnedOf = (loan: Returns): number =>
	loan.returns.reduce((sum, entry) => sum + entry.quantity, 0)

/** What is still to come back. Zero once returned in full. */
export const owedOf = (loan: Returns & Pick<Doc<'loans'>, 'quantity'>): number =>
	Math.max(0, loan.quantity - returnedOf(loan))
