import { v } from 'convex/values'
import { internal } from './_generated/api'
import { env, httpAction, internalAction } from './_generated/server'
import { isDetailKey } from './summary'

/** Calls one method of Telegram's Bot API as the clinic's bot. */
async function botApi(method: string, body: Record<string, unknown>): Promise<Response> {
	return await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	})
}

async function requireOk(response: Response, what: string): Promise<void> {
	if (!response.ok) {
		throw new Error(`Telegram refused ${what} (${response.status}): ${await response.text()}`)
	}
}

/**
 * Posts one message to the clinic's Telegram group, with any buttons under
 * it. A pinned message replaces whatever the group had pinned, quietly, so
 * its first line stays in the bar at the top of the chat; the bot must be an
 * admin of the group that may pin messages. A deployment with no bot set,
 * such as a developer's, sends nothing.
 */
export const send = internalAction({
	args: {
		text: v.string(),
		buttons: v.optional(
			v.array(v.array(v.object({ text: v.string(), callback_data: v.string() }))),
		),
		pin: v.optional(v.boolean()),
	},
	returns: v.null(),
	handler: async (_ctx, args) => {
		const chat_id = env.TELEGRAM_CHAT_ID
		if (!env.TELEGRAM_BOT_TOKEN || !chat_id) return null

		const response = await botApi('sendMessage', {
			chat_id,
			text: args.text,
			parse_mode: 'HTML',
			...(args.buttons ? { reply_markup: { inline_keyboard: args.buttons } } : {}),
		})
		await requireOk(response, 'the message')
		if (!args.pin) return null

		const { result } = (await response.json()) as { result: { message_id: number } }
		await requireOk(await botApi('unpinAllChatMessages', { chat_id }), 'unpinning')
		await requireOk(
			await botApi('pinChatMessage', {
				chat_id,
				message_id: result.message_id,
				disable_notification: true,
			}),
			'pinning',
		)
		return null
	},
})

/** The part of a Telegram update this bot reads: a press of a button under one of its messages */
interface Update {
	callback_query?: {
		id: string
		data?: string
		message?: { message_id: number; chat: { id: number } }
	}
}

/**
 * Where Telegram sends a button press. The bot replies under the message
 * with the list the button asks for, quietly, so nobody's phone rings for
 * something one person looked up. Only presses in the clinic's own group are
 * answered, and only requests that carry the secret Telegram was given.
 */
export const webhook = httpAction(async (ctx, request) => {
	const secret = env.TELEGRAM_WEBHOOK_SECRET
	if (!secret || request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== secret) {
		return new Response(null, { status: 403 })
	}

	const { callback_query: press } = (await request.json()) as Update
	if (!press) return new Response(null, { status: 200 })

	// First, and whatever it answers: it only stops the button's spinner, and a press
	// Telegram sends again after a failure below is by then too old to be answered
	await botApi('answerCallbackQuery', { callback_query_id: press.id })

	const chat_id = env.TELEGRAM_CHAT_ID
	const { data, message } = press
	if (message && String(message.chat.id) === chat_id && isDetailKey(data)) {
		const text = await ctx.runQuery(internal.summary.detail, { key: data, now: Date.now() })
		const response = await botApi('sendMessage', {
			chat_id,
			text,
			parse_mode: 'HTML',
			disable_notification: true,
			reply_parameters: { message_id: message.message_id, allow_sending_without_reply: true },
		})
		await requireOk(response, 'the reply')
	}
	return new Response(null, { status: 200 })
})

/**
 * Tells Telegram where to send button presses. Run once on a deployment,
 * after TELEGRAM_WEBHOOK_SECRET is set: `npx convex run telegram:registerWebhook`.
 */
export const registerWebhook = internalAction({
	args: {},
	returns: v.null(),
	handler: async () => {
		const secret_token = env.TELEGRAM_WEBHOOK_SECRET
		if (!env.TELEGRAM_BOT_TOKEN || !secret_token) {
			throw new Error('Set TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET first')
		}
		const response = await botApi('setWebhook', {
			url: `${env.CONVEX_SITE_URL}/telegram`,
			secret_token,
			allowed_updates: ['callback_query'],
		})
		await requireOk(response, 'the webhook')
		return null
	},
})
