// composables/connectionMonitor.svelte.ts
import { convex } from '$lib/convex'

export interface ConnectionMonitor {
	readonly isConnected: boolean
	readonly lastHeartbeat: number
	startMonitoring: () => () => void
	stopMonitoring: () => void
}

/**
 * Watches the Convex WebSocket and reloads the page if it stays down.
 *
 * The client reconnects on its own and replays subscriptions, so this is
 * only a backstop for a tab that has been asleep long enough to be stuck.
 *
 * NOTE: this must be called during component initialisation — it creates an
 * `$effect`, which can only be created inside a component or an effect root.
 * The effect starts monitoring on mount and tears it down on destroy.
 */
export function createConnectionMonitor(): ConnectionMonitor {
	let isConnected = $state(true)
	let lastHeartbeat = $state(Date.now())
	let checkInterval: number | null = null
	let unsubscribe: (() => void) | null = null

	// Configuration
	const CONNECTION_TIMEOUT = 120000 // 2 minutes
	const CHECK_INTERVAL = 10000 // Check every 10 seconds

	const refreshPage = () => {
		console.warn('Connection lost for too long, refreshing page...')
		window.location.reload()
	}

	const noteState = (connected: boolean) => {
		isConnected = connected
		if (connected) lastHeartbeat = Date.now()
	}

	const checkConnection = () => {
		noteState(convex.connectionState().isWebSocketConnected)
		if (Date.now() - lastHeartbeat > CONNECTION_TIMEOUT) refreshPage()
	}

	const startMonitoring = () => {
		noteState(convex.connectionState().isWebSocketConnected)

		unsubscribe = convex.subscribeToConnectionState((state) => {
			noteState(state.isWebSocketConnected)
		})

		checkInterval = window.setInterval(checkConnection, CHECK_INTERVAL)

		// A tab coming back from the background gets checked straight away
		const handleVisibilityChange = () => {
			if (!document.hidden) checkConnection()
		}
		document.addEventListener('visibilitychange', handleVisibilityChange)

		return () => {
			document.removeEventListener('visibilitychange', handleVisibilityChange)
		}
	}

	const stopMonitoring = () => {
		if (checkInterval) {
			clearInterval(checkInterval)
			checkInterval = null
		}
		unsubscribe?.()
		unsubscribe = null
	}

	$effect(() => {
		const cleanup = startMonitoring()

		return () => {
			cleanup?.()
			stopMonitoring()
		}
	})

	return {
		get isConnected() {
			return isConnected
		},
		get lastHeartbeat() {
			return lastHeartbeat
		},
		startMonitoring,
		stopMonitoring,
	}
}
