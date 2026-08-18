// @ts-ignore - Tipos de Google Maps cargados dinámicamente desde CDN
declare const google: any

import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { Layout } from '../components/Layout'
import { MapIcon } from 'lucide-react'
import { db } from '../firebase'
import { collection, query, orderBy, onSnapshot, doc, updateDoc, limit } from 'firebase/firestore'
import { useFirestoreReady } from '../hooks/useOnlineStatus'
// ya no usamos librería de terceros para el mapa

interface Device {
  id: string
  name: string
  status: 'online' | 'offline'
  lat?: number
  lng?: number
  telemetry?: { t_air_c?: number; h_air_pct?: number; co2_ppm?: number; ts_server?: any } | null
}

export const MapPage = () => {
  // const { selectedDeviceId } = useDevice() // not currently needed
  const [devices, setDevices] = useState<Device[]>([])
  const [openInfoWindowDeviceId, setOpenInfoWindowDeviceId] = useState<string | null>(null)
  
  const mapInstance = useRef<any>(null)
  const markers = useRef<Record<string, any>>({})
  const infoWindow = useRef<any>(null)
  const openInfoWindowDeviceIdRef = useRef<string | null>(null)
  
  const sortedDevices = useMemo<Device[]>(() => {
    const priority = (status: Device['status']) => (status === 'online' ? 0 : 1)

    return [...devices].sort((a, b) => {
      const statusDiff = priority(a.status) - priority(b.status)
      if (statusDiff !== 0) return statusDiff
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    })
  }, [devices])

  const telemetryUnsubs = useRef<Record<string, () => void>>({})

  // referencias para el mapa
  const mapRef = useRef<HTMLDivElement | null>(null)
  const devicesRef = useRef<Device[]>([]) // Mantener dispositivos actualizados para listeners
  const [mapReady, setMapReady] = useState(false)

  // utiliza variable de entorno (se castea para evitar error de tipo)
  const GOOGLE_API_KEY = ((import.meta as any).env?.VITE_GOOGLE_MAPS_KEY as string) || ''

  // Escuchar metadata_devices en tiempo real
  useEffect(() => {
    const ref = collection(db, 'metadata_devices')
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const list: Device[] = snap.docs.map((d) => ({
          id: d.id,
          name: (d.data() as any).name || (d.data() as any).alias || d.id,
          status: 'offline', // Por defecto assumimos sin señal hasta recibir datos
          lat: parseFloat((d.data() as any).lat),
          lng: parseFloat((d.data() as any).lng),
          telemetry: null,
        }))
        console.log('[MapPage] Dispositivos procesados después de parseFloat:', list)
        setDevices(list)
      },
      (err) => {
        console.error('[MapPage] metadata_devices error', err)
      }
    )

    return () => unsub()
  }, [])

  // Suscribir a la última telemetría por cada dispositivo (limit 1)
  useEffect(() => {
    // limpiar subscripciones previas
    Object.values(telemetryUnsubs.current).forEach((u) => u())
    telemetryUnsubs.current = {}

    devices.forEach((device) => {
      const telemRef = collection(db, `devices/${device.id}/telemetria`)
      const q = query(telemRef, orderBy('ts_server', 'desc'), limit(1))
      const unsub = onSnapshot(
        q,
        (snap) => {
          if (!snap.empty) {
            const data = snap.docs[0].data() as any
            const tsServer = data.ts_server?.seconds ? data.ts_server.seconds * 1000 : Date.now()
            const now = Date.now()
            const diffMinutos = (now - tsServer) / 1000 / 60
            
            // Si hay datos recientes (menos de 6 minutos) = online, sino = offline
            // Usar el mismo umbral que Dashboard (360 segundos = 6 minutos)
            const isOnline = diffMinutos < 6
            
            setDevices((prev) =>
              prev.map((p) =>
                p.id === device.id
                  ? {
                      ...p,
                      status: isOnline ? 'online' : 'offline',
                      telemetry: {
                        t_air_c: data.t_air_c ?? data.t_air ?? null,
                        h_air_pct: data.h_air_pct ?? data.h_air ?? null,
                        co2_ppm: data.co2_ppm ?? data.co2 ?? null,
                        ts_server: tsServer,
                      },
                    }
                  : p
              )
            )
            // Actualizar InfoWindow si está abierto para este dispositivo
            updateInfoWindowContentRef.current(device.id)
            console.log(`[MapPage] Telemetría ${device.id}: datos recientes hace ${diffMinutos.toFixed(1)} mins, status=${isOnline ? 'online' : 'offline'}`)
          } else {
            // Sin datos = offline
            setDevices((prev) => prev.map((p) => (p.id === device.id ? { ...p, status: 'offline', telemetry: null } : p)))
            updateInfoWindowContentRef.current(device.id)
            console.log(`[MapPage] Telemetría ${device.id}: sin datos, status=offline`)
          }
        },
        (err) => console.error('[MapPage] telemetry error', device.id, err)
      )

      telemetryUnsubs.current[device.id] = unsub
    })

    return () => {
      Object.values(telemetryUnsubs.current).forEach((u) => u())
      telemetryUnsubs.current = {}
    }
  }, [devices])

  // Mantener devicesRef sincronizado con el estado de devices
  useEffect(() => {
    devicesRef.current = devices
  }, [devices])

  // Función para actualizar el InfoWindow cuando llega nueva telemetría
  const updateInfoWindowContent = useCallback((deviceId: string) => {
    if (!infoWindow.current || openInfoWindowDeviceIdRef.current !== deviceId) return

    const device = devicesRef.current.find(d => d.id === deviceId)
    if (!device) return

    const formatDateTime = (timestamp: number) => {
      const date = new Date(timestamp)
      const day = String(date.getDate()).padStart(2, '0')
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const year = date.getFullYear()
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${day}/${month}/${year} ${hours}:${minutes}`
    }

    const deviceName = device.name || device.id
    const hasTelemetry = device.telemetry && device.telemetry.t_air_c !== null
    
    let content: string
    
    if (!hasTelemetry) {
      // Si no hay telemetría, mostrar "Cargando..."
      content = `<div style="font-family: Arial, sans-serif; padding: 6px 8px; font-size: 12px;">
        <div style="margin: 0 0 4px 0; font-size: 13px; font-weight: bold; color: #22c55e;">${deviceName}</div>
        <div style="color: #999; line-height: 1.4; text-align: center;">
          <div style="padding: 12px 0;">Cargando datos...</div>
        </div>
      </div>`
    } else {
      // Si hay telemetría, mostrar los datos
      const lastDataTime = device.telemetry?.ts_server 
        ? formatDateTime(device.telemetry.ts_server) 
        : '—'
      content = `<div style="font-family: Arial, sans-serif; padding: 6px 8px; font-size: 12px;">
        <div style="margin: 0 0 4px 0; font-size: 13px; font-weight: bold; color: #22c55e;">${deviceName}</div>
        <div style="color: #555; line-height: 1.4;">
          <div>Temp: ${device.telemetry?.t_air_c ?? '—'}°C</div>
          <div>Humedad: ${device.telemetry?.h_air_pct ?? '—'}%</div>
          <div>CO₂: ${device.telemetry?.co2_ppm ?? '—'} ppm</div>
          <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #ddd; font-size: 11px; color: #888;">
            <div>Última actualización:</div>
            <div style="font-weight: bold;">${lastDataTime}</div>
          </div>
        </div>
      </div>`
    }
    
    infoWindow.current.setContent(content)
    console.log('[MapPage] InfoWindow actualizado para:', deviceName)
  }, [])

  const updateInfoWindowContentRef = useRef(updateInfoWindowContent)

  // Sincronizar la función de actualización de InfoWindow
  useEffect(() => {
    updateInfoWindowContentRef.current = updateInfoWindowContent
  }, [updateInfoWindowContent])

  // Actualizar lat/lng en Firestore cuando arrastren el marcador
  const updateDeviceLocation = async (deviceId: string, lat: number, lng: number) => {
    try {
      const d = doc(db, 'metadata_devices', deviceId)
      await updateDoc(d, { lat, lng })
    } catch (err) {
      console.error('[MapPage] updateDeviceLocation error:', err)
    }
  }

  // cargar script de Google Maps si hace falta
  useEffect(() => {
    if (!GOOGLE_API_KEY || !mapRef.current) {
      console.warn('[MapPage] Sin API key o sin ref al div del mapa')
      return
    }

    // Función para inicializar el mapa (con reintentos)
    const initMap = () => {
      if (!(window as any).google?.maps?.Map) {
        console.warn('[MapPage] google.maps.Map aún no disponible, reintentando...')
        setTimeout(initMap, 500)
        return
      }

      try {
        mapInstance.current = new google.maps.Map(mapRef.current!, {
          center: { lat: 4.5709, lng: -74.2973 },
          zoom: 5,
          mapTypeId: 'roadmap',
          gestureHandling: 'greedy',
          draggable: true,
          disableDoubleClickZoom: false,
        })
        setMapReady(true)
        console.log('[MapPage] Mapa creado exitosamente en Colombia')
      } catch (err) {
        console.error('[MapPage] Error creando mapa:', err)
      }
    }

    // Si ya está cargado
    if ((window as any).google?.maps?.Map) {
      console.log('[MapPage] Google Maps ya estaba cargado')
      initMap()
      return
    }

    // Cargar el script
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}`
    script.async = true
    script.defer = true

    script.onload = () => {
      console.log('[MapPage] Script de Google Maps cargado')
      initMap()
    }

    script.onerror = () => {
      console.error('[MapPage] Error cargando script de Google Maps')
    }

    document.head.appendChild(script)
    console.log('[MapPage] Script de Google Maps añadido al DOM')

    return () => {
      // Cleanup si es necesario
      console.log('[MapPage] Limpiando script de Google Maps')
    }
  }, [GOOGLE_API_KEY])

  // sincronizar marcadores cuando cambie la lista de dispositivos + ajustar zoom
  useEffect(() => {
    const map = mapInstance.current
    if (!map || !mapReady) {
      console.warn('[MapPage] No hay instancia del mapa disponible o aún no está listo')
      return
    }
    console.log('[MapPage] Sincronizando marcadores, dispositivos:', devices.length)
    console.log('[MapPage] Dispositivos recibidos:', devices)

    // actualiza o crea marcadores
    devices.forEach((device) => {
      console.log(`[MapPage] Procesando dispositivo ${device.id}:`, { lat: device.lat, lng: device.lng, name: device.name })
      if (device.lat == null || device.lng == null) {
        console.warn(`[MapPage] Dispositivo ${device.id} sin coordenadas válidas`)
        return
      }
      let marker = markers.current[device.id]
      if (!marker) {
        // Crear icono de localización personalizado en verde o rojo
        const pinColor = device.status === 'online' ? '#22c55e' : '#ef4444'
        const pinIcon = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='${pinColor}'><path d='M12 0C7.03 0 3 4.03 3 9c0 5.25 9 15 9 15s9-9.75 9-15c0-4.97-4.03-9-9-9zm0 12c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z'/></svg>`
        const encodedPin = encodeURIComponent(pinIcon)
        
        marker = new google.maps.Marker({
          position: { lat: device.lat, lng: device.lng },
          map,
          draggable: false,
          title: device.name,
          icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodedPin,
            scaledSize: new google.maps.Size(32, 42),
            anchor: new google.maps.Point(16, 42),
          },
        })
        
        const formatDateTime = (timestamp: number) => {
          const date = new Date(timestamp)
          const day = String(date.getDate()).padStart(2, '0')
          const month = String(date.getMonth() + 1).padStart(2, '0')
          const year = date.getFullYear()
          const hours = String(date.getHours()).padStart(2, '0')
          const minutes = String(date.getMinutes()).padStart(2, '0')
          return `${day}/${month}/${year} ${hours}:${minutes}`
        }

        const showInfoWindow = () => {
          if (!infoWindow.current) infoWindow.current = new google.maps.InfoWindow({
            disableAutoPan: false,
          })
          // Buscar el dispositivo ACTUAL del ref (siempre tiene los datos más recientes)
          const currentDevice = devicesRef.current.find(d => d.id === device.id)
          if (!currentDevice) return
          
          const deviceName = currentDevice.name || currentDevice.id
          const lastDataTime = currentDevice.telemetry?.ts_server 
            ? formatDateTime(currentDevice.telemetry.ts_server) 
            : '—'
          const content = `<div style="font-family: Arial, sans-serif; padding: 6px 8px; font-size: 12px;">
            <div style="margin: 0 0 4px 0; font-size: 13px; font-weight: bold; color: #22c55e;">${deviceName}</div>
            <div style="color: #555; line-height: 1.4;">
              <div>Temp: ${currentDevice.telemetry?.t_air_c ?? '—'}°C</div>
              <div>Humedad: ${currentDevice.telemetry?.h_air_pct ?? '—'}%</div>
              <div>CO₂: ${currentDevice.telemetry?.co2_ppm ?? '—'} ppm</div>
              <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #ddd; font-size: 11px; color: #888;">
                <div>Última actualización:</div>
                <div style="font-weight: bold;">${lastDataTime}</div>
              </div>
            </div>
          </div>`
          infoWindow.current.setContent(content)
          infoWindow.current.open(map, marker)
          setOpenInfoWindowDeviceId(device.id)
          console.log('[MapPage] InfoWindow abierta para:', device.name)
        }
        
        const hideInfoWindow = () => {
          if (infoWindow.current) {
            infoWindow.current.close()
            setOpenInfoWindowDeviceId(null)
          }
        }

        // Eventos para desktop (mouse)
        marker.addListener('mouseover', showInfoWindow)
        marker.addListener('mouseout', hideInfoWindow)
        
        // Evento para móvil y desktop (click)
        marker.addListener('click', () => {
          showInfoWindow()
          // Buscar el dispositivo actual para coords actualizadas
          const currentDevice = devicesRef.current.find(d => d.id === device.id)
          if (!currentDevice || currentDevice.lat == null || currentDevice.lng == null) return
          
          // Hacer zoom al dispositivo cuando se hace clic en el marcador
          const bounds = new google.maps.LatLngBounds()
          bounds.extend({ lat: currentDevice.lat, lng: currentDevice.lng })
          // Expandir los bounds un poco para dar contexto
          const ne = bounds.getNorthEast()
          const sw = bounds.getSouthWest()
          const latDiff = (ne.lat() - sw.lat()) * 0.5
          const lngDiff = (ne.lng() - sw.lng()) * 0.5
          
          const expandedBounds = new google.maps.LatLngBounds(
            { lat: sw.lat() - latDiff, lng: sw.lng() - lngDiff },
            { lat: ne.lat() + latDiff, lng: ne.lng() + lngDiff }
          )
          
          map.fitBounds(expandedBounds)
          console.log('[MapPage] Zoom a dispositivo:', currentDevice.name, { lat: currentDevice.lat, lng: currentDevice.lng })
        })
        markers.current[device.id] = marker
      } else {
        marker.setPosition({ lat: device.lat, lng: device.lng })
        // actualiza color si cambió status
        const pinColor = device.status === 'online' ? '#22c55e' : '#ef4444'
        const pinIcon = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='${pinColor}'><path d='M12 0C7.03 0 3 4.03 3 9c0 5.25 9 15 9 15s9-9.75 9-15c0-4.97-4.03-9-9-9zm0 12c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z'/></svg>`
        const encodedPin = encodeURIComponent(pinIcon)
        marker.setIcon({
          url: 'data:image/svg+xml;charset=UTF-8,' + encodedPin,
          scaledSize: new google.maps.Size(32, 42),
          anchor: new google.maps.Point(16, 42),
        })
      }
    })

    // eliminar marcadores de dispositivos que desaparecieron
    Object.keys(markers.current).forEach((id) => {
      if (!devices.find((d) => d.id === id)) {
        markers.current[id].setMap(null)
        delete markers.current[id]
      }
    })

    // El mapa se mantiene centrado en Colombia hasta que el usuario haga clic en un dispositivo
    console.log('[MapPage] Marcadores sincronizados, mapa mantiene vista de Colombia')
  }, [devices, mapReady])

  // Actualizar contenido del InfoWindow cuando cambian los datos o se abre/cierra
  useEffect(() => {
    if (!openInfoWindowDeviceId || !infoWindow.current) return

    const device = devicesRef.current.find(d => d.id === openInfoWindowDeviceId)
    if (!device) return

    const formatDateTime = (timestamp: number) => {
      const date = new Date(timestamp)
      const day = String(date.getDate()).padStart(2, '0')
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const year = date.getFullYear()
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${day}/${month}/${year} ${hours}:${minutes}`
    }

    const deviceName = device.name || device.id
    const lastDataTime = device.telemetry?.ts_server 
      ? formatDateTime(device.telemetry.ts_server) 
      : '—'
    const content = `<div style="font-family: Arial, sans-serif; padding: 6px 8px; font-size: 12px;">
      <div style="margin: 0 0 4px 0; font-size: 13px; font-weight: bold; color: #22c55e;">${deviceName}</div>
      <div style="color: #555; line-height: 1.4;">
        <div>Temp: ${device.telemetry?.t_air_c ?? '—'}°C</div>
        <div>Humedad: ${device.telemetry?.h_air_pct ?? '—'}%</div>
        <div>CO₂: ${device.telemetry?.co2_ppm ?? '—'} ppm</div>
        <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #ddd; font-size: 11px; color: #888;">
          <div>Última actualización:</div>
          <div style="font-weight: bold;">${lastDataTime}</div>
        </div>
      </div>
    </div>`
    
    infoWindow.current.setContent(content)
    console.log('[MapPage] InfoWindow actualizado para:', deviceName)
  }, [devices, openInfoWindowDeviceId])

  // Calcular estado global: online si al menos un dispositivo está online
  const isAnyDeviceOnline = devices.some(d => d.status === 'online')
  const onlineDevicesCount = devices.filter(d => d.status === 'online').length
  const statusHint = `${onlineDevicesCount}/${devices.length} dispositivos en línea`
  
  // Solo mostrar el badge cuando TODOS los dispositivos tengan telemetría
  const allDevicesHaveTelemetry = devices.length > 0 && devices.every(d => d.telemetry)
  const firestoreReady = useFirestoreReady(allDevicesHaveTelemetry)

  return (
    <Layout isOnline={firestoreReady ? isAnyDeviceOnline : undefined} statusHint={allDevicesHaveTelemetry ? statusHint : undefined}>
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-2 sm:gap-3">
          <MapIcon className="h-6 sm:h-8 w-6 sm:w-8 text-gray-600 flex-shrink-0" />
          <h1 className="text-lg sm:text-2xl font-bold text-gray-800 dark:text-white">Mapa del Invernadero</h1>
        </div>
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-2">Visualización espacial de sensores y lecturas en tiempo real</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Main Map Area */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-3 sm:p-6">
            {!GOOGLE_API_KEY ? (
              <div className="text-xs sm:text-sm text-red-600">
                No se ha configurado la clave de Google Maps. Crea un archivo <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">.env</code> con
                <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">VITE_GOOGLE_MAPS_KEY=tu_api_key</code> y reinicia el servidor.
              </div>
            ) : (
              <div ref={mapRef} className="w-full h-[400px] sm:h-[600px]" />
            )}
          </div>
        </div>

        {/* Info Panel */}
        <div className="lg:col-span-1 space-y-4 sm:space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
            <div className="flex items-center mb-3 sm:mb-4">
              <h2 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-white">Estado General</h2>
            </div>

            <div className="space-y-3 sm:space-y-4">
              <div>
                <h3 className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Dispositivos Activos</h3>
                <div className="space-y-1.5 sm:space-y-2">
                  {sortedDevices.map((device) => (
                    <div key={device.id} className="flex items-center justify-between p-2 sm:p-3 bg-gray-50 dark:bg-gray-700 rounded-md gap-2">
                      <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 truncate">{device.name}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap flex-shrink-0 ${
                        device.status === 'online' ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-200'
                      }`}>
                        {device.status === 'online' ? 'En línea' : 'Sin señal'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Resumen de Dispositivos</h3>
                <ul className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 space-y-1.5 sm:space-y-2">
                  <li className="flex items-center"> <span className="w-2 h-2 bg-green-500 rounded-full mr-2 flex-shrink-0"></span> <span>En línea: {devices.filter((d) => d.status === 'online').length}</span></li>
                  <li className="flex items-center"> <span className="w-2 h-2 bg-red-300 rounded-full mr-2 flex-shrink-0"></span> <span>Sin señal: {devices.filter((d) => d.status === 'offline').length}</span></li>
                  <li className="flex items-center"> <span className="w-2 h-2 bg-blue-500 rounded-full mr-2 flex-shrink-0"></span> <span>Total: {devices.length}</span></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
