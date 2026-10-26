import adapter from '@sveltejs/adapter-vercel'
import { sveltekit } from '@sveltejs/kit/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
	// Honour an assigned PORT (e.g. from the desktop app's preview runner) so several dev servers can coexist.
	server: { port: Number(process.env.PORT) || 5173 },
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true,
			},
			alias: {
				$convex: './convex',
			},
			// Pinned: the adapter maps the *local* Node version to a Vercel runtime and
			// only knows 20/22/24. Nothing runs server-side anyway (ssr = false).
			adapter: adapter({ runtime: 'nodejs22.x' }),
			// A tab left open all day learns about a new deploy within a minute; the
			// root layout then reloads on the next navigation and offers a Reload toast.
			version: { pollInterval: 60_000 },
		}),
	],
})
