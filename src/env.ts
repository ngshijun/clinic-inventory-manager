import { defineEnvVars } from '@sveltejs/kit/env'

export const variables = defineEnvVars({
	PUBLIC_CONVEX_URL: {
		public: true,
		static: true,
		description: 'The Convex deployment the browser client talks to.',
	},
})
