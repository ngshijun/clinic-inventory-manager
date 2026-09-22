import { convex } from '$lib/convex'

/*
 * Whether the Convex WebSocket is up. The client reconnects and replays its
 * subscriptions on its own, so the shell only shows a banner while the
 * socket is down; nothing polls and nothing reloads the page.
 */
let isConnected = $state(true)
let unsubscribe: (() => void) | null = null

export const connection = {
	get isConnected() {
		return isConnected
	},
}

/** Start following the socket state. Call once during component init; stops on destroy. */
export function useConnection() {
	$effect(() => {
		isConnected = convex.connectionState().isWebSocketConnected
		unsubscribe = convex.subscribeToConnectionState((state) => {
			isConnected = state.isWebSocketConnected
		})
		return () => {
			unsubscribe?.()
			unsubscribe = null
		}
	})
}
