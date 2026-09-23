/** Which column a table is sorted by, and in which direction */
export type SortState<K extends string> = { key: K | null; direction: 'asc' | 'desc' }
