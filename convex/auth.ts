import { v } from 'convex/values'
import { query } from './_generated/server'
import { roleForPassword } from './lib/auth'
import { role } from './schema'

/** Resolves a shared password to a role. Null means the password is wrong. */
export const login = query({
	args: { password: v.string() },
	returns: v.union(role, v.null()),
	handler: async (_ctx, args) => {
		return roleForPassword(args.password)
	},
})
