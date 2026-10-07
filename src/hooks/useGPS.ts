import { useEffect, useRef, useState, useCallback } from 'react'
import { GPSEngine } from '../engines/gps'
import { Sentry } from '../lib/sentry'
import { isInsideTelegram, requestTelegramLocation } from '../lib/telegram'
import type { GPSState, GPSPosition } from '../types/geo'

const INITIAL_STATE: GPSState = { position: null, status: 'idle', error: null }

export function useGPS(): GPSState & { start: () => void; stop: () => void } {
  const [state, setState] = useState<GPSState>(INITIAL_STATE)
  const engineRef = useRef<GPSEngine | null>(null)
  const telegramTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false; engineRef.current?.stop() }
  }, [])

  const start = useCallback(() => {
    if (engineRef.current || telegramTimerRef.current) return
    setState((s) => ({ ...s, status: 'acquiring', error: null }))

    if (isInsideTelegram()) {
      const poll = async () => {
        const pos = await requestTelegramLocation()
        if (!mountedRef.current) return
        if (pos) {
          setState({ position: pos, status: 'active', error: null })
          telegramTimerRef.current = setTimeout(poll, 3_000)
        } else {
          setState((s) => ({ ...s, status: 'denied', error: 'Геолокация недоступна или доступ запрещён.' }))
          telegramTimerRef.current = null
        }
      }
      void poll()
      return
    }

    engineRef.current = new GPSEngine({
      onPosition: (pos: GPSPosition) => {
        if (!mountedRef.current) return
        setState({ position: pos, status: 'active', error: null })
      },
      onError: (status, msg, code) => {
        if (!mountedRef.current) return
        setState((s) => ({ ...s, status, error: msg }))
        if (status !== 'lost') {
          Sentry.captureMessage(`GPS error: ${msg}`, {
            level: 'warning',
            tags: { op: 'useGPS', gpsStatus: status },
            extra: { geolocationErrorCode: code },
          })
        }
      },
      minDistanceM: 2, minIntervalMs: 1_000,
    })
    engineRef.current.start()
  }, [])

  const stop = useCallback(() => {
    engineRef.current?.stop()
    engineRef.current = null
    if (telegramTimerRef.current) clearTimeout(telegramTimerRef.current)
    telegramTimerRef.current = null
    setState(INITIAL_STATE)
  }, [])

  return { ...state, start, stop }
}
