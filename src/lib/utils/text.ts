/**
 * Plus Jakarta Sans sets capitals tightly, so a string entered in all caps
 * (most item names and every unit code) reads cramped at text size. Returns
 * the tracking class such a string needs, and nothing for mixed case, so a
 * name typed normally keeps the face's own spacing.
 */
export const capsClass = (text: string | null | undefined): string | undefined =>
	text && /[A-Za-z]/.test(text) && text === text.toUpperCase() ? 'tracking-wide' : undefined
