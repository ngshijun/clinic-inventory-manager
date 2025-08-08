import { ref, onMounted, onUnmounted } from 'vue'
import { supabase } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface SystemPayload {
  status: 'ONLINE' | 'OFFLINE' | string
}

export function useConnectionMonitor() {
  const isConnected = ref(true)
  const lastHeartbeat = ref(Date.now())
  const heartbeatInterval = ref<number | null>(null)
  const checkInterval = ref<number | null>(null)

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
    const timeSinceLastHeartbeat = now - lastHeartbeat.value

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
        lastHeartbeat.value = Date.now()
        isConnected.value = true
      } else {
        console.warn('Heartbeat failed:', error)
        isConnected.value = false
      }
    } catch (err) {
      console.warn('Heartbeat error:', err)
      isConnected.value = false
    }
  }

  const startMonitoring = () => {
    // Send initial heartbeat
    sendHeartbeat()

    // Set up heartbeat interval
    heartbeatInterval.value = window.setInterval(sendHeartbeat, HEARTBEAT_INTERVAL)

    // Set up connection check interval
    checkInterval.value = window.setInterval(checkConnection, CHECK_INTERVAL)

    // Monitor Supabase realtime connection status
    channel = supabase.channel('connection_monitor')

    // Listen for connection status changes
    channel
      .on('system', {}, (payload: SystemPayload) => {
        if (payload.status === 'ONLINE') {
          lastHeartbeat.value = Date.now()
          isConnected.value = true
        } else if (payload.status === 'OFFLINE') {
          isConnected.value = false
        }
      })
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          lastHeartbeat.value = Date.now()
          isConnected.value = true
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          isConnected.value = false
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
    if (heartbeatInterval.value) {
      clearInterval(heartbeatInterval.value)
      heartbeatInterval.value = null
    }

    if (checkInterval.value) {
      clearInterval(checkInterval.value)
      checkInterval.value = null
    }

    if (channel) {
      channel.unsubscribe()
      channel = null
    }
  }

  onMounted(() => {
    const cleanup = startMonitoring()

    onUnmounted(() => {
      cleanup?.()
      stopMonitoring()
    })
  })

  return {
    isConnected,
    lastHeartbeat,
    startMonitoring,
    stopMonitoring,
  }
}
