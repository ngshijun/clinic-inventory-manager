import type { Attachment } from 'svelte/attachments'

/**
 * Selects the whole value whenever the field gains focus, so a prefilled
 * default is replaced by whatever the user types instead of appended to.
 *
 * Browsers collapse a selection made during `focus` on the following
 * `mouseup`, so the first mouseup after a focus is swallowed. A mousedown
 * disarms that so clicking into an already focused field still moves the
 * caret normally.
 */
export function selectOnFocus(enabled = true): Attachment<HTMLInputElement> {
	return (node) => {
		if (!enabled) return

		let armed = false

		const onFocus = () => {
			armed = true
			node.select()
		}
		const onMouseDown = () => {
			armed = false
		}
		const onMouseUp = (event: MouseEvent) => {
			if (!armed) return
			armed = false
			event.preventDefault()
		}
		const onBlur = () => {
			armed = false
		}

		node.addEventListener('focus', onFocus)
		node.addEventListener('mousedown', onMouseDown)
		node.addEventListener('mouseup', onMouseUp)
		node.addEventListener('blur', onBlur)

		return () => {
			node.removeEventListener('focus', onFocus)
			node.removeEventListener('mousedown', onMouseDown)
			node.removeEventListener('mouseup', onMouseUp)
			node.removeEventListener('blur', onBlur)
		}
	}
}

/**
 * Puts the caret after the existing text the first time the field is
 * focused, so a prefilled remark is appended to rather than overwritten.
 * Later focuses (clicks) are left alone.
 */
export function caretAtEnd(enabled = true): Attachment<HTMLTextAreaElement> {
	return (node) => {
		if (!enabled) return

		const onFocus = () => {
			node.removeEventListener('focus', onFocus)
			const end = node.value.length
			node.setSelectionRange(end, end)
		}

		node.addEventListener('focus', onFocus)

		return () => node.removeEventListener('focus', onFocus)
	}
}
