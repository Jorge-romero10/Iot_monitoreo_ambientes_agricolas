import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { db } from '../firebase'
import {
  collection, query, orderBy, onSnapshot, addDoc, deleteDoc, getDocs,
  Timestamp, Unsubscribe
} from 'firebase/firestore'
import { useAuth } from './AuthContext'

export type EventType = 'success' | 'error' | 'warning' | 'info'

export type EventItem = {
  id: string
  title: string
  status: string
  type: EventType
  timeMs: number
  deviceName?: string
  dataTimeMs?: number
}

type EventLogContextValue = {
  events: EventItem[]
  pushEvent: (event: Omit<EventItem, 'id' | 'timeMs'> & { eventTimeMs?: number; dataTimeMs?: number }) => void
  clearEvents: () => void
}

const EVENTS_STORE_KEY = 'agrisense_events_v1'
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000

const EventLogContext = createContext<EventLogContextValue | undefined>(undefined)

export const EventLogProvider: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const { isAuthenticated, username } = useAuth()
  const [events, setEvents] = useState<EventItem[]>(() => {
    try {
      const raw = localStorage.getItem(EVENTS_STORE_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      const now = Date.now()
      return parsed.filter((e: any) => {
        return typeof e?.timeMs === 'number' && now - e.timeMs < TWO_DAYS_MS
      })
    } catch {
      return []
    }
  })

  // Guardar en localStorage
  useEffect(() => {
    try {
      localStorage.setItem(EVENTS_STORE_KEY, JSON.stringify(events))
    } catch {
      // ignore
    }
  }, [events])

  // Suscribirse a eventos desde Firestore cuando el usuario autenticado cambia
  useEffect(() => {
    if (!isAuthenticated || !username) return

    const eventsRef = collection(db, `users/${username}/events`)
    const q = query(eventsRef, orderBy('timeMs', 'desc'))

    let unsubscribe: Unsubscribe | null = null

    const setupSubscription = async () => {
      try {
        unsubscribe = onSnapshot(
          q,
          (snap) => {
            const now = Date.now()
            const fsEvents: EventItem[] = snap.docs
              .map((doc) => {
                const data = doc.data()
                return {
                  id: doc.id,
                  title: data.title,
                  status: data.status,
                  type: data.type,
                  timeMs: data.timeMs,
                  deviceName: data.deviceName,
                  dataTimeMs: data.dataTimeMs,
                }
              })
              .filter((e) => now - e.timeMs < TWO_DAYS_MS)
            
            setEvents(fsEvents.slice(0, 100))
          },
          (err) => console.error('[FS] Error cargando eventos:', err)
        )
      } catch (err) {
        console.error('[FS] Error suscribiendo a eventos:', err)
      }
    }

    setupSubscription()

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [isAuthenticated, username])

  const pushEvent = useCallback(
    (event: Omit<EventItem, 'id' | 'timeMs'> & { eventTimeMs?: number; dataTimeMs?: number }) => {
      const now = Date.now()
      const timeMs = event.eventTimeMs ?? now

      // Guardar en Firestore si el usuario está autenticado
      if (isAuthenticated && username) {
        const eventsRef = collection(db, `users/${username}/events`)
        addDoc(eventsRef, {
          title: event.title,
          status: event.status,
          type: event.type,
          timeMs: timeMs,
          deviceName: event.deviceName,
          dataTimeMs: event.dataTimeMs,
          createdAt: Timestamp.now(),
        }).catch((err) => console.error('[FS] Error guardando evento:', err))
      }

      // Actualizar estado local
      setEvents((prev) => {
        const newEvent: EventItem = {
          ...event,
          id: `${timeMs}-${Math.random().toString(16).slice(2)}`,
          timeMs,
          dataTimeMs: event.dataTimeMs,
        }

        const merged = [newEvent, ...prev].slice(0, 100)
        return merged.filter((e) => now - e.timeMs < TWO_DAYS_MS)
      })
    },
    [isAuthenticated, username]
  )

  const clearEvents = useCallback(() => {
    setEvents([])
    
    // Limpiar en Firestore también
    if (isAuthenticated && username) {
      const eventsRef = collection(db, `users/${username}/events`)
      getDocs(eventsRef)
        .then((snap) => {
          snap.docs.forEach((doc) => deleteDoc(doc.ref))
        })
        .catch((err) => console.error('[FS] Error limpiando eventos:', err))
    }
  }, [isAuthenticated, username])

  return (
    <EventLogContext.Provider value={{ events, pushEvent, clearEvents }}>
      {children}
    </EventLogContext.Provider>
  )
}

export function useEventLog() {
  const ctx = useContext(EventLogContext)
  if (!ctx) throw new Error('useEventLog must be used within an EventLogProvider')
  return ctx
}

export function formatEventTime(timeMs: number) {
  return new Date(timeMs).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}
