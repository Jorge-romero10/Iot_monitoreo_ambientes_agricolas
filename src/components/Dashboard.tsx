import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { MetricCards } from './MetricCards'
import { ChartSection } from './ChartSection'
import { EventLog } from './EventLog'
import { ReportModal } from './ReportModal'
import { mockData } from '../utils/mockData'
import { useDevice } from '../contexts/DeviceContext'
import { useFirestoreReady } from '../hooks/useOnlineStatus'
import { useAuth } from '../contexts/AuthContext'
import { useEventLog, formatEventTime, EventType } from '../contexts/EventLogContext'

import { db } from '../firebase'
import {
  collection, query, orderBy, where, onSnapshot,
  Query, QueryDocumentSnapshot,
} from 'firebase/firestore'

// Swiper imports
import { Swiper, SwiperSlide } from 'swiper/react'
import { Autoplay, Navigation, Pagination, Parallax } from 'swiper/modules'
// @ts-ignore - CSS modules for Swiper
import 'swiper/css'
// @ts-ignore - CSS modules for Swiper
import 'swiper/css/navigation'
// @ts-ignore - CSS modules for Swiper
import 'swiper/css/pagination'

const STORE_KEY = 'agrisense_dash_v1'
const EVENTS_PREVIEW_COUNT = 4

type Range = '1h' | '6h' | '12h' | '24h'
type TelemetryRow = {
  timestamp: Date
  t_air: number | null
  h_air: number | null
  co2: number | null
}
type MetricCardsData = {
  airTemperature: { value: number | null; change: number; sparkline: number[]; times?: string[]; danger?: boolean }
  humidity: { value: number | null; change: number; sparkline: number[]; times?: string[]; danger?: boolean }
  co2: { value: number | null; change: number; sparkline: number[]; times?: string[]; danger?: boolean }
}

export const Dashboard: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const { isAdmin } = useAuth()
  const { availableDevices, selectedDeviceId, setSelectedDeviceId, devicesLoading } = useDevice()

  const [selectedTempRange, setSelectedTempRange] = useState<Range>('1h')
  const [selectedHumidityRange, setSelectedHumidityRange] = useState<Range>('1h')
  const [selectedCo2Range, setSelectedCo2Range] = useState<Range>('1h')

  const [points, setPoints] = useState<TelemetryRow[]>([])

  const [now, setNow] = useState<number>(Date.now())
  const { events: eventLog, pushEvent, clearEvents } = useEventLog()
  const [onlineSince, setOnlineSince] = useState<number | null>(null)
  const [offlineSince, setOfflineSince] = useState<number | null>(null)
  const prevOnlineRef = useRef<boolean | null>(null)
  const prevHumHighRef = useRef<boolean>(false)
  const lastDataTimestampRef = useRef<number | null>(null) // Rastrear el timestamp del último dato
  const isFirstInitRef = useRef<boolean>(true) // Bandera para primera inicialización (NO generar eventos)
  const [showAllEvents, setShowAllEvents] = useState(false)
  const [reportModalOpen, setReportModalOpen] = useState(false)

  // Restaurar estado persistido (incluye historial de puntos)
  // Ejecuta primero para mostrar datos de localStorage inmediatamente
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY)
      if (raw) {
        const s = JSON.parse(raw)
        if (typeof s?.onlineSince === 'number' || s?.onlineSince === null) setOnlineSince(s.onlineSince)
        if (typeof s?.offlineSince === 'number' || s?.offlineSince === null) setOfflineSince(s.offlineSince)
        if (typeof s?.prevOnline === 'boolean' || s?.prevOnline === null) prevOnlineRef.current = s.prevOnline
        // Restaurar historial de puntos si existe
        if (Array.isArray(s?.points) && s.points.length > 0) {
          setPoints(s.points.map((p: any) => ({
            ...p,
            timestamp: new Date(p.timestamp)
          })))
          // Restaurar el timestamp del último dato para evitar generar eventos falsos
          if (s.points[s.points.length - 1]?.timestamp) {
            lastDataTimestampRef.current = new Date(s.points[s.points.length - 1].timestamp).getTime()
          }
          // Datos restaurados, desactivar loading
          setIsLoading(false)
        }
      }
    } catch (e) {
      console.error('Error restaurando estado:', e)
      setIsLoading(false)
    }
  }, [])

  // Guardar estado persistido continuamente
  useEffect(() => {
    const data = { onlineSince, offlineSince, prevOnline: prevOnlineRef.current, points }
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)) } catch {}
  }, [onlineSince, offlineSince, points])

  useEffect(() => { document.documentElement.classList.toggle('dark', darkMode) }, [darkMode])
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id) }, [])

  // Suscripción a datos de Firestore - se actualiza cuando cambia el dispositivo seleccionado
  useEffect(() => {
    // No hacer nada si no hay dispositivo seleccionado
    if (!selectedDeviceId) {
      console.log('[Dashboard] Sin dispositivo seleccionado aún')
      return
    }

    let detach: (() => void) | null = null;
    
    // Limpiar puntos cuando cambia el dispositivo
    setPoints([])
    setIsLoading(true)
    
    const colRef = collection(db, `devices/${selectedDeviceId}/telemetria`);

    // Suscribirse en tiempo real solo si está online
    // Confiar en localStorage para datos iniciales
    if (!navigator.onLine) {
      // Si no hay conexión y no se restauraron puntos, dejar de mostrar skeletons
      setIsLoading(false)
    }

    if (navigator.onLine) {
      const from7d = new Date(Date.now() - 7 * 24 * 3600 * 1000);
      const qByTime: Query = query(colRef, where('ts_server', '>=', from7d), orderBy('ts_server', 'asc'));
      detach = onSnapshot(
        qByTime,
        (snap) => {
          // marcar recepción de snapshot (aunque venga vacío) para indicar que la conexión en tiempo real está activa
          // Dejamos de mostrar el estado de loading en cuanto llegue el primer snapshot (incluso si está vacío)
          setIsLoading(false)

          if (!snap.empty) {
            const docs = mapDocs(snap.docs);
            // No combinar con historial restaurado al cambiar de dispositivo
            setPoints(docs);
            // Actualizar el timestamp del último dato
            if (docs.length > 0) {
              lastDataTimestampRef.current = docs[docs.length - 1].timestamp.getTime()
            }
          }
        },
        (err) => {
          console.error('[FS] snapshot error:', err);
          setIsLoading(false)
        }
      );
    }

    return () => { if (detach) detach(); };
  }, [selectedDeviceId]);

  // Al iniciar, si no hay datos, cargar el historial completo guardado en localStorage
  useEffect(() => {
    if (points.length === 0) {
      try {
        const raw = localStorage.getItem(STORE_KEY)
        if (raw) {
          const s = JSON.parse(raw)
          if (Array.isArray(s?.points) && s.points.length > 0) {
            setPoints(s.points.map((p: any) => ({
              ...p,
              timestamp: new Date(p.timestamp)
            })))
          }
        }
      } catch {}
    }
  }, [points.length])

  // (removed) previous isOffline calculation

  /* ====== TARJETAS: datos de HOY ====== */
  const startOfToday = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d }, [])
  const endOfToday   = useMemo(() => { const d = new Date(); d.setHours(24,0,0,0); return d }, [])

  const todayPoints = useMemo(
    () => points.filter(p => p.timestamp >= startOfToday && p.timestamp < endOfToday),
    [points, startOfToday, endOfToday]
  )
  const todayLast: TelemetryRow | null = todayPoints.length ? todayPoints[todayPoints.length - 1] : null

  // Si no hay datos de hoy, usar el último punto recibido (aunque sea de otro día)
  const cardsRow: TelemetryRow | null = todayLast ?? points.at(-1) ?? null

  // Series + tiempos de hoy (para tooltips)
  const seriesToday = useMemo(() => {
    const toSeries = (selector: (p: TelemetryRow) => number | null) => {
      const xs: number[] = []
      const ts: string[] = []
      for (const p of todayPoints) {
        const v = selector(p)
        if (Number.isFinite(v as number)) { xs.push(v as number); ts.push(fmtTime(p.timestamp)) }
      }
      const take = 60
      return { xs: xs.slice(-take), ts: ts.slice(-take) }
    }
    return {
      air: toSeries(p => p.t_air),
      hum: toSeries(p => p.h_air),
      co2: toSeries(p => p.co2),
    }
  }, [todayPoints])

  const v  = (x: unknown) => (Number.isFinite(Number(x)) ? round1(x) : 0)
  const vn = (x: unknown) => (Number.isFinite(Number(x)) ? round1(x) : null)

  // ====== Datos para MetricCards ======
  const metricData: MetricCardsData = {
    airTemperature: {
      value: v(cardsRow?.t_air),
      change: trendPct(seriesToday.air.xs),
      sparkline: spark(seriesToday.air.xs),
      times: seriesToday.air.ts,
    },
    humidity: {
      value: v(cardsRow?.h_air),
      change: trendPct(seriesToday.hum.xs),
      sparkline: spark(seriesToday.hum.xs),
      times: seriesToday.hum.ts,
    },
    co2: {
      value: vn(cardsRow?.co2), // null -> N/D en card
      change: trendPct(seriesToday.co2.xs),
      sparkline: spark(seriesToday.co2.xs),
      times: seriesToday.co2.ts,
      danger: Number(cardsRow?.co2) > 1500, // umbral ejemplo
    },
  }

  /* ===== Helpers de rango/agrupación para GRÁFICAS ===== */
  const filterByRange = (arr: TelemetryRow[], range: Range) => {
    if (arr.length === 0) return []
    
    // Calcular el rango relativo al último punto recibido, no a la hora actual
    const lastPoint = arr[arr.length - 1];
    const lastMs = lastPoint.timestamp.getTime();
    
    const ms =
      range === '1h' ? 1 * 3600 * 1000 :
      range === '6h' ? 6 * 3600 * 1000 :
      range === '12h' ? 12 * 3600 * 1000 :
      24 * 3600 * 1000
    const from = lastMs - ms
    return arr.filter((r) => r.timestamp.getTime() >= from)
  }

  /* ===== Gráficas por rango  ===== */
  const temperatureDataByRange = useMemo(() => {
    const last1h = filterByRange(points, '1h').map((r) => ({
      time: fmtTime(r.timestamp),
      airTemp: r.t_air ?? null,
    }))
    const last6h = filterByRange(points, '6h').map((r) => ({
      time: fmtTime(r.timestamp),
      airTemp: r.t_air ?? null,
    }))
    const last12h = filterByRange(points, '12h').map((r) => ({
      time: fmtTime(r.timestamp),
      airTemp: r.t_air ?? null,
    }))
    const last24h = filterByRange(points, '24h').map((r) => ({
      time: fmtTime(r.timestamp),
      airTemp: r.t_air ?? null,
    }))
    return { '1h': last1h, '6h': last6h, '12h': last12h, '24h': last24h } as Record<Range, any[]>
  }, [points])

  const environmentalDataByRange = useMemo(() => {
    const last1h = filterByRange(points, '1h').map((r) => ({
      time: fmtTime(r.timestamp),
      humidity: r.h_air ?? null,
      co2: r.co2 ?? null,
    }))
    const last6h = filterByRange(points, '6h').map((r) => ({
      time: fmtTime(r.timestamp),
      humidity: r.h_air ?? null,
      co2: r.co2 ?? null,
    }))
    const last12h = filterByRange(points, '12h').map((r) => ({
      time: fmtTime(r.timestamp),
      humidity: r.h_air ?? null,
      co2: r.co2 ?? null,
    }))
    const last24h = filterByRange(points, '24h').map((r) => ({
      time: fmtTime(r.timestamp),
      humidity: r.h_air ?? null,
      co2: r.co2 ?? null,
    }))
    return { '1h': last1h, '6h': last6h, '12h': last12h, '24h': last24h } as Record<Range, any[]>
  }, [points])

  const tempArrayForChart =
    temperatureDataByRange[selectedTempRange]?.length
      ? temperatureDataByRange[selectedTempRange]
      : mockData.temperatureData

  const humidityArrayForChart =
    environmentalDataByRange[selectedHumidityRange]?.length
      ? environmentalDataByRange[selectedHumidityRange]
      : mockData.environmentalData

  const co2ArrayForChart =
    environmentalDataByRange[selectedCo2Range]?.length
      ? environmentalDataByRange[selectedCo2Range]
      : mockData.environmentalData

  /* ===== Estado Online + Eventos ===== */
  const lastDate = useMemo(() => {
    const fromPoints = points.length ? points[points.length - 1].timestamp : null
    return fromPoints || null
  }, [points])

  // Verificar si el último punto está dentro de los últimos 6 minutos (360 segundos)
  const isLastPointWithinLastMinute = useMemo(() => {
    if (!lastDate) return false
    const sixMinutesAgo = now - 360 * 1000 // 360 segundos = 6 minutos
    return lastDate.getTime() >= sixMinutesAgo
  }, [lastDate, now])

  // Monitorear el estado de conexión del navegador (solo para isOnline)
  const [navigatorOnline, setNavigatorOnline] = useState<boolean>(navigator.onLine)
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

  // Online solo si: navegador online + último punto está dentro del último minuto
  const isOnline = Boolean(
    navigatorOnline && isLastPointWithinLastMinute
  )

  const currentDeviceName = useMemo(() => {
    return availableDevices.find(d => d.id === selectedDeviceId)?.name ?? selectedDeviceId ?? '—'
  }, [availableDevices, selectedDeviceId])

  const pushLogEvent = useCallback(
    (args: { title: string; status: string; type: EventType; eventTimeMs?: number; dataTimeMs?: number }) => {
      pushEvent({ ...args, deviceName: currentDeviceName })
    },
    [currentDeviceName, pushEvent]
  )

  // Monitorear cambios en el estado de datos del dispositivo (offline/online)
  useEffect(() => {
    // No generar eventos hasta que tengamos al menos 1 dato real
    if (!lastDate) return

    const prevDataAvailable = prevOnlineRef.current
    const currentDataAvailable = isLastPointWithinLastMinute

    if (prevDataAvailable === null) {
      // Primera inicialización: guardar estado sin generar evento
      prevOnlineRef.current = currentDataAvailable
      lastDataTimestampRef.current = lastDate.getTime()
      isFirstInitRef.current = false // Marcar que ya pasó la inicialización
      if (currentDataAvailable) setOnlineSince(Date.now())
      else setOfflineSince(Date.now())
      return
    }

    // Después de la primera inicialización:
    // Solo generar eventos si cambia isLastPointWithinLastMinute
    // (indicando que el dispositivo IoT real pasó de online a offline o viceversa)
    if (prevDataAvailable !== currentDataAvailable) {
      if (currentDataAvailable) {
        // Dispositivo volvió a enviar datos (reconexión real)
        setOnlineSince(Date.now())
        setOfflineSince(null)
        pushLogEvent({ title: 'Reconexión exitosa', status: 'Resuelto', type: 'success', dataTimeMs: lastDate?.getTime() })
      } else {
        // Dispositivo dejó de enviar datos
        setOfflineSince(Date.now())
        setOnlineSince(null)
        pushLogEvent({ title: 'Sin conexión', status: 'Crítico', type: 'error', dataTimeMs: lastDate?.getTime() })
      }
      prevOnlineRef.current = currentDataAvailable
    }
  }, [isLastPointWithinLastMinute, pushLogEvent, lastDate, points.length])

  useEffect(() => {
    const h = points.at(-1)?.h_air
    const high = Number.isFinite(h as number) && (h as number) > 90
    if (high && !prevHumHighRef.current) pushLogEvent({ title: 'Alerta: Alta humedad', status: 'Advertencia', type: 'warning', dataTimeMs: lastDate?.getTime() })
    prevHumHighRef.current = !!high
  }, [points, pushLogEvent, lastDate])

  const statusHint = useMemo(() => {
    if (isOnline) {
      return `Último dato: hace ${formatAgo(now - lastDate!.getTime())}`
    } else {
      return `Último dato: ${lastDate?.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) || '—'}`
    }
  }, [isOnline, now, lastDate])

  const reportData = useMemo(() => ({
    deviceName: currentDeviceName,
    generatedAt: new Date(),
    periodStart: points.length > 0 ? points[0].timestamp : new Date(),
    periodEnd: lastDate || new Date(),
    statusHint,
    isOnline,
    latest: {
      timestamp: lastDate,
      temperature: cardsRow?.t_air ?? null,
      humidity: cardsRow?.h_air ?? null,
      co2: cardsRow?.co2 ?? null,
    },
    points: points,
    events: eventLog,
    summary: `Este reporte incluye el último registro conocido para el dispositivo. La conexión se considera ${isOnline ? 'activa' : 'inactiva'} y la última lectura fue ${statusHint}.`,
  }), [currentDeviceName, statusHint, isOnline, lastDate, cardsRow, points, eventLog])

  const eventsPreview = eventLog.slice(0, EVENTS_PREVIEW_COUNT)
  const moreCount = Math.max(0, eventLog.length - EVENTS_PREVIEW_COUNT)

  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), [])
  const toggleDarkMode = useCallback(() => setDarkMode((v) => !v), [])

  // Controlar cuándo mostrar el badge: solo cuando Firestore ha traído datos reales
  const firestoreReady = useFirestoreReady(points.length > 0)

  return (
    <>
      <style>
        {`
          .custom-swiper .swiper-button-next,
          .custom-swiper .swiper-button-prev {
            width: 20px !important;
            height: 20px !important;
            margin-top: -12px !important;
          }
          .custom-swiper .swiper-button-next::after,
          .custom-swiper .swiper-button-prev::after {
            font-size: 20px !important;
          }
        `}
      </style>
      <div className={`flex h-screen overflow-hidden ${darkMode ? 'dark' : ''}`}>
      <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />

      <div className="flex flex-col flex-1 overflow-hidden">
        <Header
          toggleSidebar={toggleSidebar}
          darkMode={darkMode}
          toggleDarkMode={toggleDarkMode}
          deviceId={selectedDeviceId}
          availableDevices={availableDevices}
          onDeviceChange={setSelectedDeviceId}
          isOnline={firestoreReady && points.length > 0 ? isOnline : undefined}
          statusHint={firestoreReady && points.length > 0 ? statusHint : undefined}
        />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
          <div className="max-w-7xl mx-auto">

            {/* Error State - Sin dispositivos */}
            {!devicesLoading && availableDevices.length === 0 && (
              <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <h2 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
                  ⚠️ No hay dispositivos disponibles
                </h2>
                <p className="text-red-700 dark:text-red-300 mb-4">
                  No se encontraron dispositivos en la colección <code className="bg-red-100 dark:bg-red-900/50 px-2 py-1 rounded">metadata_devices</code>
                </p>
                <div className="text-sm text-red-600 dark:text-red-400 space-y-2">
                  <p>✅ <strong>Solución rápida:</strong></p>
                  <p>Agrega esta línea a tus reglas de Firebase Security Rules:</p>
                  <code className="block bg-red-100 dark:bg-red-900/50 p-2 rounded text-xs mt-2 overflow-auto max-w-md">
/* match /metadata_devices/{'{' }docId{'}'} {"\n"}  {" "} allow read: if true;{"\n"}  {" "}  allow write: if false;{"\n"}{"}'"} */
                  </code>
                  <p className="mt-3 text-xs">📍 Coloca esto <strong>antes</strong> del match /devices/...</p>
                </div>
              </div>
            )}

            {/* Cargando dispositivos iniciales */}
            {devicesLoading && (
              <div className="p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-blue-700 dark:text-blue-300">Cargando dispositivos...</p>
              </div>
            )}

            {/* Contenido si hay dispositivo seleccionado */}
            {!devicesLoading && selectedDeviceId && (
              <>
                {/* Loading State */}
                {isLoading ? (
                  <div className="space-y-4">
                    {/* Skeleton MetricCards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
                      ))}
                    </div>
                    {/* Skeleton Charts */}
                    <div className="mt-6 space-y-6">
                      <div className="h-64 sm:h-80 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
                      <div className="h-64 sm:h-80 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
                    </div>
                  </div>
                ) : (
                  <>
            {/* Validación defensiva para MetricCards y aviso de último registro */}
            {metricData && metricData.airTemperature && metricData.humidity && metricData.co2 ? (
              <>
                {/* Aviso si el dato mostrado no es de hoy */}
                {cardsRow && !(cardsRow.timestamp >= startOfToday && cardsRow.timestamp < endOfToday) && (
                  <div className="mb-2 p-2 bg-yellow-100 text-yellow-800 rounded text-sm flex items-center gap-2">
                    <span>Mostrando último registro disponible:</span>
                    <span className="font-semibold">{cardsRow.timestamp.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</span>
                  </div>
                )}
                <MetricCards data={metricData as any} />
              </>
            ) : (
              <div className="mb-4 p-4 bg-yellow-100 text-yellow-800 rounded">No hay datos recientes para mostrar tarjetas.</div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6 items-stretch">
              <div className="lg:col-span-2 flex flex-col h-full">
                <div className="flex-1">
                  <Swiper
                    spaceBetween={30}
                    slidesPerView={1}
                    autoplay={{ delay: 10000, disableOnInteraction: false }}
                    navigation
                    pagination={{ clickable: true }}
                    loop
                    parallax={true}
                    speed={600}
                    modules={[Autoplay, Navigation, Pagination, Parallax]}
                    className="h-full custom-swiper"
                    style={{
                      '--swiper-navigation-color': '#374151',
                      '--swiper-pagination-color': '#374151',
                    } as React.CSSProperties}
                  >
                    <div
                      slot="container-start"
                      className="parallax-bg"
                      style={{
                        background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
                      }}
                      data-swiper-parallax="-23%"
                    ></div>
                    <SwiperSlide>
                      <div data-swiper-parallax="-100">
                        {/* Validación defensiva para ChartSection Temperatura */}
                        {Array.isArray(tempArrayForChart) && tempArrayForChart.length > 0 ? (
                          <ChartSection
                            title="Temperatura Ambiente"
                            selectedTimeRange={selectedTempRange}
                            setSelectedTimeRange={setSelectedTempRange}
                            data={tempArrayForChart as any}
                            type="temperature"
                            darkMode={darkMode}
                          />
                        ) : (
                          <div className="p-4 bg-yellow-100 text-yellow-800 rounded">No hay datos de temperatura para graficar.</div>
                        )}
                      </div>
                    </SwiperSlide>
                    <SwiperSlide>
                      <div data-swiper-parallax="-100">
                        {/* Validación defensiva para ChartSection Humedad */}
                        {Array.isArray(humidityArrayForChart) && humidityArrayForChart.length > 0 ? (
                          <ChartSection
                            title="Humedad Ambiente"
                            selectedTimeRange={selectedHumidityRange}
                            setSelectedTimeRange={setSelectedHumidityRange}
                            data={humidityArrayForChart as any}
                            type="humidity"
                            darkMode={darkMode}
                          />
                        ) : (
                          <div className="p-4 bg-yellow-100 text-yellow-800 rounded">No hay datos de humedad para graficar.</div>
                        )}
                      </div>
                    </SwiperSlide>
                    <SwiperSlide>
                      <div data-swiper-parallax="-100">
                        {/* Validación defensiva para ChartSection CO₂ */}
                        {Array.isArray(co2ArrayForChart) && co2ArrayForChart.length > 0 ? (
                          <ChartSection
                            title="CO₂"
                            selectedTimeRange={selectedCo2Range}
                            setSelectedTimeRange={setSelectedCo2Range}
                            data={co2ArrayForChart as any}
                            type="co2"
                            darkMode={darkMode}
                          />
                        ) : (
                          <div className="p-4 bg-yellow-100 text-yellow-800 rounded">No hay datos de CO₂ para graficar.</div>
                        )}
                      </div>
                    </SwiperSlide>
                  </Swiper>
                </div>
              </div>

              <div className="lg:col-span-1 h-full">
                <EventLog
                  events={eventsPreview as any}
                  moreCount={moreCount}
                  onViewAll={() => setShowAllEvents(true)}
                  onClear={clearEvents}
                />
              </div>
            </div>

            {isAdmin && (
              <div className="mt-6 flex justify-start">
                <button
                  type="button"
                  onClick={() => setReportModalOpen(true)}
                  className="inline-flex items-center rounded-md bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Generar reporte
                </button>
              </div>
            )}

          </>
        )}
      </>
    )}
  </div>
</main>
</div>

  {showAllEvents && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-xl rounded-lg bg-white dark:bg-gray-800 shadow-lg">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">Todos los eventos ({eventLog.length})</h3>
              <button onClick={() => setShowAllEvents(false)} className="px-2 py-1 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">Cerrar</button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-4 space-y-3">
              {eventLog.map((e) => (
                <div key={e.id} className="flex items-start justify-between rounded-md border border-gray-200 dark:border-gray-700 p-3">
                  <div>
                    <div className="text-sm font-medium text-gray-800 dark:text-gray-100">{e.title}</div>
                    {e.deviceName ? (
                      <div className="text-xs text-gray-500 dark:text-gray-400">Dispositivo: {e.deviceName}</div>
                    ) : null}
                    <div className="text-xs text-gray-500 dark:text-gray-400">{formatEventTime(e.timeMs)}</div>
                  </div>
                  <span className={
                    'text-xs px-2 py-0.5 rounded-full ' +
                    (e.type === 'success' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200'
                    : e.type === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200'
                    : e.type === 'warning' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200')
                  }>{e.status}</span>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 text-right">
              <button onClick={() => setShowAllEvents(false)} className="inline-flex items-center rounded-md bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 text-sm">Listo</button>
            </div>
          </div>
        </div>
      )}

      <ReportModal
        open={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        devices={availableDevices}
        defaultDeviceId={selectedDeviceId}
        reportData={reportData}
        onReportGenerated={(fileName) => console.log('Reporte descargado:', fileName)}
      />
    </div>
    </>
  )
}

/* ===== Helpers ===== */
function mapDocs(docs: QueryDocumentSnapshot[]): TelemetryRow[] {
  return docs.map((d) => {
    const v: any = d.data()
    const t: Date =
      v.ts?.toDate?.() ??
      v.ts_server?.toDate?.() ??
      v.timestamp?.toDate?.() ??
      new Date()
    return {
      timestamp: t,
      t_air: numOrNull(v.t_air_c),
      h_air: numOrNull(v.h_air_pct),
      co2: numOrNull(v.co2_ppm),
    } as TelemetryRow
  })
}
function numOrNull(x: unknown): number | null { const n = Number(x); return Number.isFinite(n) ? n : null }
function round1(x: unknown): number | null { const n = Number(x); return Number.isFinite(n) ? Math.round(n * 100) / 100 : null }
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
function trendPct(arr: number[]): number {
  const a = arr.filter((n) => Number.isFinite(n))
  if (a.length < 2) return 0
  const first = a[0], last = a[a.length - 1]
  if (!Number.isFinite(first) || first === 0) return 0
  return Math.round(((last - first) / Math.abs(first)) * 1000) / 10
}
function spark(arr: number[]): number[] { return arr.filter((n) => Number.isFinite(n)) }
function fmtTime(d: Date) { return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false }) }
