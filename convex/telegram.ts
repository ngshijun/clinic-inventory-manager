import { v } from 'convex/values'
import { env, internalAction } from './_generated/server'

/**
 * Posts one message to the clinic's Telegram group. A deployment with no bot
 * set, such as a developer's, sends nothing.
 */
export const send = internalAction({
	args: { text: v.string() },
	returns: v.null(),
	handler: async (_ctx, args) => {
		const token = env.TELEGRAM_BOT_TOKEN
		const chat_id = env.TELEGRAM_CHAT_ID
		if (!token || !chat_id) return null

		const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ chat_id, text: args.text, parse_mode: 'HTML' }),
		})
		if (!response.ok) {
			throw new Error(`Telegram refused the message (${response.status}): ${await response.text()}`)
		}
		return null
	},
})
