import { defineApp } from 'convex/server'
import { v } from 'convex/values'
import aggregate from '@convex-dev/aggregate/convex.config'

const app = defineApp({
	env: {
		// Shared role passwords. Set with `npx convex env set MANAGER_PASSWORD ...`.
		MANAGER_PASSWORD: v.string(),
		REQUESTER_PASSWORD: v.string(),
		// The Telegram bot and the group it posts to. A deployment without them sends nothing.
		TELEGRAM_BOT_TOKEN: v.optional(v.string()),
		TELEGRAM_CHAT_ID: v.optional(v.string()),
		// Lets the bot answer the buttons under its summary; see telegram.ts registerWebhook.
		// Any long random text. Without it the summary carries no buttons.
		TELEGRAM_WEBHOOK_SECRET: v.optional(v.string()),
	},
})

// Count of stock_movements, namespaced by movement_type, keyed by _creationTime.
app.use(aggregate, { name: 'movementsByType' })

export default app
