import type { Doc, Id } from '../../../convex/_generated/dataModel'
import type { WithLegacy } from '$lib/types/legacy'

export type StockRequestId = Id<'stock_requests'>

// The server joins the item's current unit onto each request
export type StockRequest = WithLegacy<Doc<'stock_requests'> & { unit: string }>

export interface NewStockRequest {
	item_id: Id<'inventory'>
	quantity: number
	remark?: string
}
