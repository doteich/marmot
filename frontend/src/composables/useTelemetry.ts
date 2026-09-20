import { ref, reactive } from 'vue'

export interface TelemetryMessage {
  dataPointId: string
  dataPointName?: string
  machineId?: string
  value: unknown
  dataType?: string
  timestamp?: string
  quality?: string
}

// Module-level shared reactive telemetry state
const telemetryState = reactive<Record<string, unknown>>({})
const isWsConnected = ref(false)
const wsError = ref<string | null>(null)
const lastUpdate = ref<Date | null>(null)
const messageCount = ref(0)

let socket: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let shouldReconnect = true

const defaultWsUrl =
  typeof window !== 'undefined'
    ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`
    : 'ws://localhost:3001/ws'

export function useTelemetry(wsUrl = defaultWsUrl) {
  let activeUrl = wsUrl

  function connect(overrideUrl?: string) {
    if (overrideUrl) {
      activeUrl = overrideUrl
    }
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
      if (socket.url === activeUrl) return
      disconnect()
    }

    shouldReconnect = true
    try {
      socket = new WebSocket(activeUrl)

      socket.onopen = () => {
        isWsConnected.value = true
        wsError.value = null
        if (reconnectTimer) {
          clearTimeout(reconnectTimer)
          reconnectTimer = null
        }
      }

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as TelemetryMessage
          if (msg && msg.dataPointId !== undefined) {
            telemetryState[msg.dataPointId] = msg.value
            lastUpdate.value = new Date()
            messageCount.value++
          }
        } catch (e) {
          console.warn('[Telemetry] Failed to parse message:', event.data, e)
        }
      }

      socket.onerror = (e) => {
        wsError.value = 'WebSocket connection error'
        console.warn('[Telemetry] WebSocket error:', e)
      }

      socket.onclose = () => {
        isWsConnected.value = false
        socket = null
        if (shouldReconnect) {
          reconnectTimer = setTimeout(() => {
            connect()
          }, 3000)
        }
      }
    } catch (err) {
      wsError.value = String(err)
      isWsConnected.value = false
      if (shouldReconnect) {
        reconnectTimer = setTimeout(() => {
          connect()
        }, 5000)
      }
    }
  }

  function disconnect() {
    shouldReconnect = false
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    if (socket) {
      socket.close()
      socket = null
    }
    isWsConnected.value = false
    messageCount.value = 0
    for (const key of Object.keys(telemetryState)) {
      delete telemetryState[key]
    }
  }

  return {
    telemetryState,
    isWsConnected,
    wsError,
    lastUpdate,
    messageCount,
    connect,
    disconnect,
  }
}
