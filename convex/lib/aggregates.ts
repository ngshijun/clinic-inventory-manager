import { TableAggregate } from '@convex-dev/aggregate'
import { components } from '../_generated/api'
import type { DataModel } from '../_generated/dataModel'

/**
 * Count of stock_movements per movement_type (namespace), ordered by
 * _creationTime so date-range counts are a single bounded lookup.
 * Every stock_movements insert MUST go through `insertMovement` in lib/stock.ts
 * so this stays in sync.
 */
export const movementsByType = new TableAggregate<{
	Namespace: 'stock_in' | 'stock_out'
	Key: number
	DataModel: DataModel
	TableName: 'stock_movements'
}>(components.movementsByType, {
	namespace: (d) => d.movement_type,
	sortKey: (d) => d._creationTime,
})
