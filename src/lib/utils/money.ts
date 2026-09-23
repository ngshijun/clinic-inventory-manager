/** "24,300.00": two decimals with thousands separators, no currency */
export const formatAmount = (amount: number): string =>
	amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

/** "RM 24,300.00" */
export const formatRM = (amount: number): string => `RM ${formatAmount(amount)}`
