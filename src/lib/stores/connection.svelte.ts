import { convex } from '$lib/convex'

/*
 * Whether the Convex WebSocket is up. The client reconnects and replays its
 * subscriptions on its own, so the shell only shows a banner while the
 * socket is down; nothing polls and nothing reloads the page.
 */
let isConnected = $state(true)
/* Shown only once the socket has been down a moment, so a blip never flashes it. */
let isOffline = $state(false)
let unsubscribe: (() => void) | null = null
let offlineTimer: ReturnType<typeof setTimeout> | null = null
const OFFLINE_GRACE_MS = 3000

const setConnected = (connected: boolean) => {
	isConnected = connected
	if (offlineTimer) clearTimeout(offlineTimer)
	offlineTimer = null
	if (connected) isOffline = false
	else offlineTimer = setTimeout(() => (isOffline = true), OFFLINE_GRACE_MS)
}

export const connection = {
	get isConnected() {
		return isConnected
	},
	get isOffline() {
		return isOffline
	},
}

/** Start following the socket state. Call once during component init; stops on destroy. */
export function useConnection() {
	$effect(() => {
		setConnected(convex.connectionState().isWebSocketConnected)
		unsubscribe = convex.subscribeToConnectionState((state) => {
			setConnected(state.isWebSocketConnected)
		})
		return () => {
			unsubscribe?.()
			unsubscribe = null
			if (offlineTimer) clearTimeout(offlineTimer)
			offlineTimer = null
		}
	})
}
