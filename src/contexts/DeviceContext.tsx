import React, { createContext, useContext, useState, useEffect } from 'react'
import { getAvailableDevices, type Device } from '../services/firebase'

type DeviceContextType = {
  availableDevices: Device[]
  selectedDeviceId: string
  setSelectedDeviceId: (id: string) => void
  devicesLoading: boolean
  deviceLoadingError: string | null
  reloadDevices: () => Promise<void>
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined)

export const DeviceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [availableDevices, setAvailableDevices] = useState<Device[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')
  const [devicesLoading, setDevicesLoading] = useState(true)
  const [deviceLoadingError, setDeviceLoadingError] = useState<string | null>(null)

  // Función para cargar dispositivos
  const loadDevices = React.useCallback(async () => {
    try {
      console.log('[DeviceContext] Cargando dispositivos...')
      setDevicesLoading(true)
      const devices = await getAvailableDevices()
      console.log('[DeviceContext] Dispositivos cargados:', devices)
      setAvailableDevices(devices)
      setDeviceLoadingError(null)

      if (devices.length > 0) {
        // Si hay dispositivos, seleccionar el primero (o mantener selección existente si aún es válida)
        if (selectedDeviceId && devices.some(d => d.id === selectedDeviceId)) {
          // Mantener el dispositivo seleccionado si sigue existiendo
          console.log('[DeviceContext] Manteniendo dispositivo seleccionado:', selectedDeviceId)
        } else {
          // Seleccionar el primer dispositivo si no hay uno válido
          setSelectedDeviceId(devices[0].id)
          console.log('[DeviceContext] Dispositivo inicial:', devices[0].id)
        }
      } else {
        setDeviceLoadingError('No hay dispositivos disponibles')
        setSelectedDeviceId('')
      }
    } catch (error) {
      console.error('[DeviceContext] Error al cargar dispositivos:', error)
      setDeviceLoadingError('Error al cargar dispositivos')
    } finally {
      setDevicesLoading(false)
    }
  }, [selectedDeviceId])

  // Cargar dispositivos al montar el componente
  useEffect(() => {
    loadDevices()
  }, [])

  const value: DeviceContextType = {
    availableDevices,
    selectedDeviceId,
    setSelectedDeviceId,
    devicesLoading,
    deviceLoadingError,
    reloadDevices: loadDevices,
  }

  return <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>
}

export const useDevice = () => {
  const context = useContext(DeviceContext)
  if (!context) {
    throw new Error('useDevice debe usarse dentro de <DeviceProvider>')
  }
  return context
}
