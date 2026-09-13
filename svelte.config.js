import adapter from '@sveltejs/adapter-vercel'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    // Pinned: the adapter maps the *local* Node version to a Vercel runtime and
    // only knows 20/22/24. Nothing runs server-side anyway (ssr = false).
    adapter: adapter({ runtime: 'nodejs22.x' }),
    alias: { '@/*': './src/lib/*' },
  },
}

export default config
