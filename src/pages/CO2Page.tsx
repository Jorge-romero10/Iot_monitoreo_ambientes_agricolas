import React, { useEffect, useMemo, useState } from 'react'
import { Layout } from '../components/Layout'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { WindIcon } from 'lucide-react'

import { db } from '../firebase'
import {
  collection, query, orderBy, onSnapshot, doc, limit as qlimit,
} from 'firebase/firestore'
import type { QueryDocumentSnapshot, Unsubscribe, DocumentData } from 'firebase/firestore'
import { useDevice } from '../contexts/DeviceContext'
import { useFirestoreReady } from '../hooks/useOnlineStatus'

const CO2_PAGE_STORE_KEY = 'co2_page_v1'
type Range = '1h' | '6h' | '12h' | '24h'

type LatestDoc = { co2_ppm?: number; ts?: { toDate?: () => Date } }
type TelemetryRow = { timestamp: Date; co2: number | null }

export const CO2Page: React.FC = () => {
  const { selectedDeviceId } = useDevice()
  const [selectedTimeRange, setSelectedTimeRange] = useState<Range>('1h')
  const [isLoading, setIsLoading] = useState(true)
  const [latest, setLatest] = useState<LatestDoc | null>(null)
  const [points, setPoints] = useState<TelemetryRow[]>([])

  /* ---------- Firestore: último (devices/{id}.last) ---------- */
  useEffect(() => {
    if (!selectedDeviceId) return

    // Restaurar datos desde localStorage primero
    try {
      const raw = localStorage.getItem(CO2_PAGE_STORE_KEY)
      if (raw) {
        const s = JSON.parse(raw)
        if (Array.isArray(s?.points) && s.points.length > 0) {
          setPoints(s.points.map((p: any) => ({
            ...p,
            timestamp: new Date(p.timestamp)
          })))
          setIsLoading(false)
        }
        if (s?.selectedTimeRange) setSelectedTimeRange(s.selectedTimeRange)
      }
    } catch (e) {
      console.error('Error restaurando datos de CO2:', e)
    }

    const unsubLast = onSnapshot(
      doc(db, `devices/${selectedDeviceId}`),
      (snap) => setLatest((snap.data()?.last as LatestDoc) || null),
      (err) => console.error('[FS] last error:', err)
    )
    return () => unsubLast()
  }, [selectedDeviceId])

  /* ---------- Firestore: serie CRUDA por rango (une ts_server/ts/timestamp) ---------- */
  useEffect(() => {
    if (!selectedDeviceId) return

    const colRef = collection(db, `devices/${selectedDeviceId}/telemetria`)

    let s1: QueryDocumentSnapshot<DocumentData>[] = []
    let s2: QueryDocumentSnapshot<DocumentData>[] = []
    let s3: QueryDocumentSnapshot<DocumentData>[] = []

    const recompute = () => {
      const merged = new Map<string, DocumentData>()
      ;[s1, s2, s3].forEach(list => list.forEach(d => merged.set(d.id, d.data())))
      const rows: TelemetryRow[] = []
      merged.forEach((v) => {
        function parseDate(val: any): Date | null {
          if (!val) return null
          if (typeof val === 'object' && typeof val.toDate === 'function') return val.toDate()
          if (typeof val === 'number') {
            return new Date(val > 1e12 ? val : val * 1000)
          }
          return null
        }
        // Buscar CO2 en varios lugares
        let co2 = numOrNull(v.co2_ppm)
        if (co2 == null && v.sensors && typeof v.sensors === 'object') co2 = numOrNull(v.sensors.co2_ppm)
        if (co2 == null && v.raw && v.raw.sensors && typeof v.raw.sensors === 'object') co2 = numOrNull(v.raw.sensors.co2_ppm)
        if (co2 == null && v.raw) co2 = numOrNull(v.raw.co2_ppm)
        // Buscar timestamp en varios lugares
        const t =
          parseDate(v.ts_server) ??
          parseDate(v.ts) ??
          parseDate(v.timestamp) ??
          parseDate(v.ts_device)
        if (!t) return
  // Sin filtro de tiempo: graficar todos los datos
        rows.push({ timestamp: t, co2 })
      })
  rows.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  setPoints(rows)
  setIsLoading(false)
  // Guardar en localStorage
  try {
    localStorage.setItem(CO2_PAGE_STORE_KEY, JSON.stringify({
      points: rows,
      selectedTimeRange
    }))
  } catch {}
    }

    const unsubs: Unsubscribe[] = [
      onSnapshot(
        query(colRef, orderBy('ts_server', 'asc')),
        snap => { s1 = snap.docs; recompute() },
        err => console.error('[FS] ts_server error:', err)
      ),
      onSnapshot(
        query(colRef, orderBy('ts', 'asc'), qlimit(5000)),
        snap => { s2 = snap.docs; recompute() },
        err => console.error('[FS] ts error:', err)
      ),
      onSnapshot(
        query(colRef, orderBy('timestamp', 'asc'), qlimit(5000)),
        snap => { s3 = snap.docs; recompute() },
        err => console.error('[FS] timestamp error:', err)
      ),
    ]

    return () => unsubs.forEach(u => u())
  }, [selectedDeviceId])

  // Guardar selectedTimeRange en localStorage cuando cambia
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CO2_PAGE_STORE_KEY)
      if (raw) {
        const s = JSON.parse(raw)
        localStorage.setItem(CO2_PAGE_STORE_KEY, JSON.stringify({ points: s.points, selectedTimeRange }))
      }
    } catch (e) {
      console.error('Error guardando rango de CO2:', e)
    }
  }, [selectedTimeRange])

  /* ---------- Estado Online/Offline ---------- */
  const [now, setNow] = useState<number>(Date.now())
  const [navigatorOnline, setNavigatorOnline] = useState<boolean>(navigator.onLine)

  // Actualizar `now` cada segundo
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // Monitorear cambios en navigator.onLine
  useEffect(() => {
    const onOnline = () => setNavigatorOnline(true)
    const onOffline = () => setNavigatorOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  // Obtener la fecha del último punto de datos
  const lastDate = useMemo(() => {
    if (points.length === 0) return null
    return points[points.length - 1].timestamp
  }, [points])

  // Verificar si el último punto está dentro de los últimos 6 minutos
  const isLastPointWithinLastMinute = useMemo(() => {
    if (!lastDate) return false
    const sixMinutesAgo = now - 360 * 1000 // 6 minutos
    return lastDate.getTime() >= sixMinutesAgo
  }, [lastDate, now])

  // Online solo si: navegador online + último punto está dentro del último minuto
  const isOnline = Boolean(navigatorOnline && isLastPointWithinLastMinute)

  // Texto descriptivo del estado
  const statusHint = useMemo(() => {
    if (isOnline) {
      return `Último dato: hace ${formatAgo(now - lastDate!.getTime())}`
    } else {
      return `Último dato: ${lastDate?.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) || '—'}`
    }
  }, [isOnline, now, lastDate])

  /* ---------- Cálculos ---------- */
  const latestCO2 = useMemo(() => numOrNull(latest?.co2_ppm), [latest])

  // Filtrar datos por rango seleccionado
  const filteredPoints = useMemo(() => {
    if (!points.length) return []
    const msByRange: Record<Range, number> = {
      '1h': 1 * 3600 * 1000,
      '6h': 6 * 3600 * 1000,
      '12h': 12 * 3600 * 1000,
      '24h': 24 * 3600 * 1000,
    }
    const lastTs = points[points.length - 1].timestamp.getTime()
    const from = new Date(lastTs - msByRange[selectedTimeRange])
    return points.filter(p => p.timestamp >= from && p.timestamp <= points[points.length - 1].timestamp)
  }, [points, selectedTimeRange])

  // Serie para la gráfica (filtrada por rango)
  const chartData = useMemo(() => {
    return filteredPoints.map(p => ({
      ts: p.timestamp.getTime(),
      co2: p.co2,
    }))
  }, [filteredPoints])

  // Estadísticas del rango (filtradas)
  const stats = useMemo(() => {
    const xs = filteredPoints.map(p => p.co2).filter(isFiniteNum)
    const minV = xs.length ? Math.min(...xs) : null
    const maxV = xs.length ? Math.max(...xs) : null
    const avgV = xs.length ? round1(xs.reduce((s, x) => s + x, 0) / xs.length) : null
    const spread = (minV != null && maxV != null) ? round1(maxV - minV) : null
    return { minV, maxV, avgV, spread }
  }, [filteredPoints])

  // % de barra "rango óptimo" (visual)
  const rangeWidth = useMemo(() => {
    if (!isFiniteNum(latestCO2)) return 0
    const c = latestCO2 as number
    const min = 300, max = 1500
    const optimalMin = 400, optimalMax = 1000
    const currentPct = ((c - min) / (max - min)) * 100
    // Si está dentro del rango óptimo, mostrar el % dentro del mismo; si no, usar el de CO2 actual
    if (c >= optimalMin && c <= optimalMax) {
      return ((c - optimalMin) / (optimalMax - optimalMin)) * 100
    }
    return Math.max(0, Math.min(100, currentPct))
  }, [latestCO2])

  const timeRanges: Range[] = ['1h', '6h', '12h', '24h']

  // Controlar cuándo mostrar el badge: solo cuando Firestore ha traído datos reales
  const firestoreReady = useFirestoreReady(points.length > 0)

  /* ---------- Render ---------- */
  return (
    <Layout isOnline={firestoreReady && points.length > 0 ? isOnline : undefined} statusHint={firestoreReady && points.length > 0 ? statusHint : undefined}>
      <div className="mb-8">
        <div className="flex items-center">
          <WindIcon className="h-8 w-8 text-green-500 mr-3" />
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Monitoreo de CO₂</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Análisis detallado de dióxido de carbono ambiental</p>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="space-y-4 sm:space-y-6">
          {/* Skeleton: tarjeta de CO2 actual */}
          <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          {/* Skeleton: gráfico */}
          <div className="h-64 sm:h-96 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          {/* Skeleton: secciones opcionales */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className="lg:col-span-2 h-40 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            <div className="lg:col-span-1 h-40 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          </div>
        </div>
      ) : (
        <>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-6 mb-4 sm:mb-6 transition-colors duration-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4">Nivel de CO₂ Actual</h2>
            <div className="flex items-center gap-4">
              <div className="p-3 sm:p-4 rounded-lg bg-green-50 dark:bg-green-900/20 flex-shrink-0">
                <WindIcon className="h-8 sm:h-10 w-8 sm:w-10 text-green-500" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-end gap-1">
                  <span className="text-3xl sm:text-4xl font-bold text-gray-800 dark:text-white truncate">
                    {isFiniteNum(latestCO2) ? round1(latestCO2 as number) : 'N/D'}
                  </span>
                  <span className="text-lg sm:text-xl text-gray-500 dark:text-gray-400 flex-shrink-0">ppm</span>
                </div>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                  Nivel de CO₂ ambiente
                  {(() => {
                    if (!points.length) return null
                    const last = points[points.length - 1]
                    if (isOnline) {
                      return <span className="ml-2 text-green-600 dark:text-green-400 font-medium">(actual)</span>
                    }
                    return (
                      <span className="ml-2 text-yellow-600 dark:text-yellow-400 font-medium">
                        (último dato: {last.timestamp.toLocaleDateString()} {last.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                      </span>
                    )
                  })()}
                </p>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-xs sm:text-sm mb-1">
                <span className="text-gray-500 dark:text-gray-400">Rango óptimo</span>
                <span className="font-medium text-gray-700 dark:text-gray-300">400 ppm - 1000 ppm</span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className="h-2 bg-green-500" style={{ width: `${rangeWidth}%` }} />
              </div>
            </div>
          </div>

          {/* Stats del rango seleccionado */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="bg-gray-50 dark:bg-gray-700 p-3 sm:p-4 rounded-lg transition-colors duration-200">
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Promedio</p>
              <p className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-white mt-1">
                {stats.avgV != null ? `${stats.avgV} ppm` : 'N/D'}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 p-3 sm:p-4 rounded-lg transition-colors duration-200">
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Mínima</p>
              <p className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-white mt-1">
                {stats.minV != null ? `${round1(stats.minV)} ppm` : 'N/D'}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 p-3 sm:p-4 rounded-lg transition-colors duration-200">
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Máxima</p>
              <p className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-white mt-1">
                {stats.maxV != null ? `${round1(stats.maxV)} ppm` : 'N/D'}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 p-3 sm:p-4 rounded-lg transition-colors duration-200">
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Variación</p>
              <p className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-white mt-1">
                {stats.spread != null ? `±${stats.spread} ppm` : 'N/D'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Gráfico: serie CRUDA del rango */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-6 mb-4 sm:mb-6 transition-colors duration-200">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-4">
          <h2 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-white">Gráfico de CO₂</h2>
          <div className="w-full sm:w-auto flex space-x-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-md overflow-x-auto">
            {timeRanges.map(range => (
              <button
                key={range}
                className={`px-2 sm:px-3 py-1 text-xs sm:text-sm rounded-md transition-colors whitespace-nowrap ${
                  selectedTimeRange === range ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-800 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
                onClick={() => setSelectedTimeRange(range)}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        <div className="h-64 sm:h-80 overflow-x-auto -mx-4 sm:-mx-6 px-4 sm:px-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={300}>
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" vertical={false} />
              <XAxis
                dataKey="ts"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                allowDuplicatedCategory={false}
                tick={{ fontSize: 11 }}
                tickFormatter={(ts: number) => {
                  const d = new Date(ts)
                  // Mostrar hora para rangos cortos (1h, 6h, 12h), fecha y hora para 24h
                  if (selectedTimeRange === '1h' || selectedTimeRange === '6h' || selectedTimeRange === '12h') {
                    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
                  }
                  return `${d.getDate()}/${d.getMonth() + 1} ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })}`
                }}
              />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} domain={[350, 650]} />
              <Tooltip
                labelFormatter={(ts) => {
                  const d = new Date(Number(ts))
                  if (selectedTimeRange === '1h' || selectedTimeRange === '6h' || selectedTimeRange === '12h') {
                    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
                  }
                  return `${d.getDate()}/${d.getMonth() + 1} ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })}`
                }}
              />
              <Legend />
              <Line
                name="Nivel de CO₂"
                type="monotone"
                dataKey="co2"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3 }}
                isAnimationActive={true}
                animationDuration={800}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Secciones opcionales eliminadas: comparativa y alertas */}
        </>
      )}
    </Layout>
  )
}

/* ===== Helpers ===== */
function isFiniteNum(x: any): x is number { return Number.isFinite(x) }
function numOrNull(x: unknown): number | null { const n = Number(x); return Number.isFinite(n) ? n : null }
function round1(x: number): number { return Math.round(x * 10) / 10 }
function formatAgo(ms: number): string {
  if (!Number.isFinite(ms)) return '—'
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  return `${d}d`
}
