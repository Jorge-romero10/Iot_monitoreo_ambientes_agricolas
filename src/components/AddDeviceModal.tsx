import React, { useState, useEffect } from 'react'
import { XIcon, PlusIcon, LoaderIcon } from 'lucide-react'
import { getUnregisteredDevices, registerDevice, type Device } from '../services/firebase'

type AddDeviceModalProps = {
  isOpen: boolean
  onClose: () => void
  onDeviceAdded: (device: Device) => void
}

export const AddDeviceModal: React.FC<AddDeviceModalProps> = ({
  isOpen,
  onClose,
  onDeviceAdded
}) => {
  const [unregisteredDevices, setUnregisteredDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')
  const [deviceName, setDeviceName] = useState<string>('')
  const [registering, setRegistering] = useState(false)
  const [error, setError] = useState<string>('')

  // Cargar dispositivos sin registrar cuando abre el modal
  useEffect(() => {
    if (!isOpen) return

    const loadUnregistered = async () => {
      setLoading(true)
      setError('')
      try {
        const devices = await getUnregisteredDevices()
        setUnregisteredDevices(devices)
        if (devices.length > 0) {
          setSelectedDeviceId(devices[0].id)
          setDeviceName(devices[0].id) // Nombre por defecto es el ID
        }
      } catch (err) {
        setError('Error al cargar dispositivos')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    loadUnregistered()
  }, [isOpen])

  const handleRegister = async () => {
    if (!selectedDeviceId || !deviceName.trim()) {
      setError('Por favor selecciona un dispositivo y asigna un nombre')
      return
    }

    setRegistering(true)
    setError('')

    try {
      const success = await registerDevice(selectedDeviceId, deviceName)
      if (success) {
        // Notificar que se agregó el dispositivo
        onDeviceAdded({
          id: selectedDeviceId,
          name: deviceName
        })
        // Limpiar y cerrar
        setSelectedDeviceId('')
        setDeviceName('')
        setUnregisteredDevices(unregisteredDevices.filter(d => d.id !== selectedDeviceId))
        onClose()
      } else {
        setError('Error al registrar el dispositivo')
      }
    } catch (err) {
      setError('Error inesperado al registrar')
      console.error(err)
    } finally {
      setRegistering(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Overlay oscuro */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <PlusIcon className="h-5 w-5 text-green-600" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Agregar Dispositivo
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <XIcon className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <LoaderIcon className="h-6 w-6 animate-spin text-green-600" />
              </div>
            ) : unregisteredDevices.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600 dark:text-gray-400">
                  No hay dispositivos sin registrar
                </p>
              </div>
            ) : (
              <>
                {/* Error message */}
                {error && (
                  <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200 text-sm">
                    {error}
                  </div>
                )}

                {/* Seleccionar dispositivo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Dispositivo
                  </label>
                  <select
                    value={selectedDeviceId}
                    onChange={(e) => {
                      setSelectedDeviceId(e.target.value)
                      setDeviceName(e.target.value) // Actualizar nombre por defecto
                      setError('')
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    {unregisteredDevices.map((device) => (
                      <option key={device.id} value={device.id}>
                        {device.id}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Nombre del dispositivo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nombre (p.ej: "Sensor Invernadero A")
                  </label>
                  <input
                    type="text"
                    value={deviceName}
                    onChange={(e) => {
                      setDeviceName(e.target.value)
                      setError('')
                    }}
                    placeholder="Ingresa un nombre descriptivo"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                {/* Info */}
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-blue-800 dark:text-blue-200 text-sm">
                  <p>
                    <strong>ID:</strong> {selectedDeviceId}
                  </p>
                  <p className="text-xs mt-1 opacity-75">
                    Este dispositivo se agregará a tu lista de dispositivos
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          {!loading && unregisteredDevices.length > 0 && (
            <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleRegister}
                disabled={registering || !selectedDeviceId}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {registering ? (
                  <>
                    <LoaderIcon className="h-4 w-4 animate-spin" />
                    Agregando...
                  </>
                ) : (
                  <>
                    <PlusIcon className="h-4 w-4" />
                    Agregar
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
