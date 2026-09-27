import type { Doc, Id } from '../../../convex/_generated/dataModel'
import type { WithLegacy } from '$lib/types/legacy'

export type UnitId = Id<'units'>

/** One preset unit an item's unit is picked from */
export type Unit = WithLegacy<Doc<'units'>>
