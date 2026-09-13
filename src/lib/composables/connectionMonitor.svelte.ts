// composables/connectionMonitor.svelte.ts
import { supabase } from '$lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface SystemPayload {
  status: 'ONLINE' | 'OFFLINE' | string
}

export interface ConnectionMonitor {
  readonly isConnected: boolean
  readonly lastHeartbeat: number
  startMonitoring: () => () => void
  stopMonitoring: () => void
}

/**
 * Monitors the Supabase connection and reloads the page if it stays down.
 *
 * NOTE: this must be called during component initialisation — it creates an
 * `$effect`, which can only be created inside a component or an effect root.
 * The effect starts monitoring on mount and tears it down on destroy.
 */
export function createConnectionMonitor(): ConnectionMonitor {
  let isConnected = $state(true)
  let lastHeartbeat = $state(Date.now())
  let heartbeatInterval: number | null = null
  let checkInterval: number | null = null

  // Configuration
  const HEARTBEAT_INTERVAL = 30000 // 30 seconds
  const CONNECTION_TIMEOUT = 120000 // 2 minutes
  const CHECK_INTERVAL = 10000 // Check every 10 seconds

  let channel: RealtimeChannel | null = null

  const refreshPage = () => {
    console.warn('Connection lost for too long, refreshing page...')
    window.location.reload()
  }

  const checkConnection = () => {
    const now = Date.now()
    const timeSinceLastHeartbeat = now - lastHeartbeat

    if (timeSinceLastHeartbeat > CONNECTION_TIMEOUT) {
      console.warn(`No heartbeat for ${timeSinceLastHeartbeat}ms, refreshing page`)
      refreshPage()
    }
  }

  const sendHeartbeat = async () => {
    try {
      // Simple query to test connection
      const { error } = await supabase.from('inventory').select('id').limit(1)

      if (!error) {
        lastHeartbeat = Date.now()
        isConnected = true
      } else {
        console.warn('Heartbeat failed:', error)
        isConnected = false
      }
    } catch (err) {
      console.warn('Heartbeat error:', err)
      isConnected = false
    }
  }

  const startMonitoring = () => {
    // Send initial heartbeat
    sendHeartbeat()

    // Set up heartbeat interval
    heartbeatInterval = window.setInterval(sendHeartbeat, HEARTBEAT_INTERVAL)

    // Set up connection check interval
    checkInterval = window.setInterval(checkConnection, CHECK_INTERVAL)

    // Monitor Supabase realtime connection status
    channel = supabase.channel('connection_monitor')

    // Listen for connection status changes
    channel
      .on('system', {}, (payload: SystemPayload) => {
        if (payload.status === 'ONLINE') {
          lastHeartbeat = Date.now()
          isConnected = true
        } else if (payload.status === 'OFFLINE') {
          isConnected = false
        }
      })
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          lastHeartbeat = Date.now()
          isConnected = true
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          isConnected = false
        }
      })

    // Listen for page visibility changes
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Page became visible, send immediate heartbeat
        sendHeartbeat()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Cleanup function
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }

  const stopMonitoring = () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval)
      heartbeatInterval = null
    }

    if (checkInterval) {
      clearInterval(checkInterval)
      checkInterval = null
    }

    if (channel) {
      channel.unsubscribe()
      channel = null
    }
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
