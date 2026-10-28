import { v } from 'convex/values'
import { internal } from './_generated/api'
import { env, httpAction, internalAction } from './_generated/server'
import { counterPress } from './lib/telegram'
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

const notice = v.object({
	text: v.string(),
	buttons: v.optional(v.array(v.array(v.object({ text: v.string(), callback_data: v.string() })))),
	pin: v.optional(v.boolean()),
	silent: v.optional(v.boolean()),
})

/**
 * Posts messages to the clinic's Telegram group, one after another, each
 * with any buttons under it. A silent message rings nobody's phone. A pinned
 * message replaces whatever the group had pinned, quietly, so its first line
 * stays in the bar at the top of the chat; the bot must be an admin of the
 * group that may pin messages. A deployment with no bot set, such as a
 * developer's, sends nothing.
 */
export const send = internalAction({
	args: { notices: v.array(notice) },
	returns: v.null(),
	handler: async (_ctx, { notices }) => {
		const chat_id = env.TELEGRAM_CHAT_ID
		if (!env.TELEGRAM_BOT_TOKEN || !chat_id) return null

		for (const args of notices) {
			const response = await botApi('sendMessage', {
				chat_id,
				text: args.text,
				parse_mode: 'HTML',
				...(args.silent ? { disable_notification: true } : {}),
				...(args.buttons ? { reply_markup: { inline_keyboard: args.buttons } } : {}),
			})
			await requireOk(response, 'the message')
			if (!args.pin) continue

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
		}
		return null
	},
})

/** The part of a Telegram update this bot reads: a press of a button under one of its messages */
interface Update {
	callback_query?: {
		id: string
		from: { first_name: string }
		data?: string
		message?: { message_id: number; chat: { id: number } }
	}
}

/** Answers under a message, quietly, so nobody's phone rings for something one person did */
async function reply(chat_id: string, message_id: number, text: string): Promise<void> {
	const response = await botApi('sendMessage', {
		chat_id,
		text,
		parse_mode: 'HTML',
		disable_notification: true,
		reply_parameters: { message_id, allow_sending_without_reply: true },
	})
	await requireOk(response, 'the reply')
}

/**
 * Where Telegram sends a button press. A summary's button is answered with
 * the list it asks for. A stock alert's "Counter has enough for" snoozes the
 * item, takes the buttons off the alert so nobody presses twice, and says
 * who did it. Only presses in the clinic's own group are answered, and only
 * requests that carry the secret Telegram was given.
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
	if (!chat_id || !message || String(message.chat.id) !== chat_id) {
		return new Response(null, { status: 200 })
	}

	const counter = counterPress(data)
	if (counter) {
		const text = await ctx.runMutation(internal.inventory.snoozeForCounter, {
			...counter,
			by: press.from.first_name,
		})
		// Whatever it answers: a second press before the first took the buttons off finds
		// them gone, and the reply below still tells that presser what happened
		await botApi('editMessageReplyMarkup', {
			chat_id,
			message_id: message.message_id,
			reply_markup: { inline_keyboard: [] },
		})
		await reply(chat_id, message.message_id, text)
	} else if (isDetailKey(data)) {
		const text = await ctx.runQuery(internal.summary.detail, { key: data, now: Date.now() })
		await reply(chat_id, message.message_id, text)
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
