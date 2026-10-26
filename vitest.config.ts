import { defineConfig } from 'vitest/config'

// Backend tests only: convex-test runs the functions in-memory under the edge runtime.
export default defineConfig({
	test: {
		environment: 'edge-runtime',
		include: ['convex/**/*.test.ts'],
		server: { deps: { inline: ['convex-test'] } },
	},
})
