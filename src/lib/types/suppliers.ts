import type { Doc, Id } from '#convex/_generated/dataModel.js'
import type { WithLegacy } from '#lib/types/legacy.js'

export type SupplierId = Id<'suppliers'>

/** One supplier on the Suppliers list */
export type Supplier = WithLegacy<Doc<'suppliers'>>
