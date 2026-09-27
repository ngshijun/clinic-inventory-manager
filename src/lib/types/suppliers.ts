import type { Doc, Id } from '../../../convex/_generated/dataModel'
import type { WithLegacy } from '$lib/types/legacy'

export type SupplierId = Id<'suppliers'>

/** One supplier on the Suppliers list */
export type Supplier = WithLegacy<Doc<'suppliers'>>
