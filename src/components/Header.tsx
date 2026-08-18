import React from 'react'
import { MenuIcon, MoonIcon, SunIcon, ChevronDownIcon, PlusIcon, Loader2Icon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useDevice } from '../contexts/DeviceContext'
import { UserMenu } from './UserMenu'
import { AddDeviceModal } from './AddDeviceModal'
import type { Device } from '../services/firebase'

type HeaderProps = {
  toggleSidebar: () => void
  darkMode: boolean
  toggleDarkMode: () => void
  /** ID del dispositivo mostrado en el chip (p.ej. pico-001) - opcional, usa context si no se proporciona */
  deviceId?: string
  /** Lista de dispositivos disponibles - opcional, usa context si no se proporciona */
  availableDevices?: Device[]
  /** Callback cuando se cambia el dispositivo - opcional, usa context si no se proporciona */
  onDeviceChange?: (deviceId: string) => void
  /** Estado online/offline calculado en Dashboard */
  isOnline?: boolean
  /** Texto auxiliar (p.ej. "Hace 2 min") */
  statusHint?: string
}

export const Header: React.FC<HeaderProps> = ({
  toggleSidebar,
  darkMode,
  toggleDarkMode,
  deviceId,
  availableDevices,
  onDeviceChange,
  isOnline = false,
  statusHint,
}) => {
  const { logout, username, role, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [dropdownOpen, setDropdownOpen] = React.useState(false)
  const [showAddModal, setShowAddModal] = React.useState(false)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  // Usar DeviceContext si no se pasan props (para las páginas que no son Dashboard)
  const contextDevice = useDevice()
  const finalDeviceId = deviceId !== undefined ? deviceId : contextDevice.selectedDeviceId
  const finalAvailableDevices = availableDevices !== undefined ? availableDevices : contextDevice.availableDevices
  const finalOnDeviceChange = onDeviceChange || contextDevice.setSelectedDeviceId

  const [statusLoading, setStatusLoading] = React.useState(false)
  const [displayOnline, setDisplayOnline] = React.useState<boolean | undefined>(isOnline)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleDeviceAdded = async (newDevice: Device) => {
    // Recargar la lista de dispositivos desde el contexto
    if (contextDevice.reloadDevices) {
      await contextDevice.reloadDevices()
    }
    console.log('[Header] Dispositivo agregado:', newDevice)
    // Seleccionar automáticamente el nuevo dispositivo
    finalOnDeviceChange(newDevice.id)
    // Cerrar el dropdown
    setDropdownOpen(false)
  }

  // Obtener nombres del dispositivo actual
  const currentDeviceName = finalAvailableDevices.find((d) => d.id === finalDeviceId)?.name || finalDeviceId

  // Cerrar dropdown al hacer clic fuera
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [dropdownOpen])

  // Mostrar un pequeño loading al cambiar de página/estado antes de mostrar online/offline
  React.useEffect(() => {
    if (isOnline === undefined) {
      setDisplayOnline(undefined)
      setStatusLoading(false)
      return
    }

    setStatusLoading(true)
    const id = window.setTimeout(() => {
      setDisplayOnline(isOnline)
      setStatusLoading(false)
    }, 500)

    return () => window.clearTimeout(id)
  }, [isOnline])

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm z-10 transition-colors duration-200">
      <div className="px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2 sm:gap-4">
          <div className="flex items-center min-w-0 flex-1">
            <button
              onClick={toggleSidebar}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-green-500 lg:hidden"
              aria-label="Abrir menú lateral"
            >
              <MenuIcon className="h-6 w-6" />
            </button>

            <div className="flex-shrink-0 flex items-center ml-0 lg:ml-4 min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white truncate">
                Dashboard cultivo
              </h1>

              {/* Dropdown de dispositivos */}
              {finalAvailableDevices.length > 0 && (
                <div className="ml-2 sm:ml-4 relative hidden sm:block" ref={dropdownRef}>
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="ml-0 px-2 sm:px-4 py-2 rounded-full bg-green-600 text-white font-medium text-xs sm:text-sm hover:bg-green-700 transition-colors flex items-center gap-1 sm:gap-2 whitespace-nowrap"
                  >
                    <span className="truncate max-w-[120px] sm:max-w-none">{currentDeviceName}</span>
                    <ChevronDownIcon
                      className={`h-4 w-4 flex-shrink-0 transition-transform ${
                        dropdownOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {/* Dropdown Menu - Vertical */}
                  {dropdownOpen && (
                    <div className="absolute top-full mt-2 left-0 min-w-max bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                      {finalAvailableDevices.map((device) => (
                        <button
                          key={device.id}
                          onClick={() => {
                            finalOnDeviceChange(device.id)
                            setDropdownOpen(false)
                          }}
                          className={`w-full px-3 sm:px-4 py-2 text-left text-sm font-medium transition-colors first:rounded-t-lg last:rounded-b-lg ${
                            finalDeviceId === device.id
                              ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                          }`}
                        >
                          {device.name}
                        </button>
                      ))}
                      
                      {/* Separador y botón agregar - Solo para admins */}
                      {isAdmin && (
                        <>
                          <div className="border-t border-gray-200 dark:border-gray-600"></div>
                          <button
                            onClick={() => {
                              setShowAddModal(true)
                              setDropdownOpen(false)
                            }}
                            className="w-full px-4 py-2.5 text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors rounded-b-lg flex items-center gap-2"
                          >
                            <PlusIcon className="h-4 w-4" />
                            Agregar dispositivo
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Theme Toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-1.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200"
              aria-label="Cambiar tema"
            >
              {darkMode ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
            </button>

            {/* Estado Online/Offline dinámico - Solo mostrar si isOnline está definido */}
            {displayOnline !== undefined && (
              <div
                className={`flex items-center px-3 py-1 rounded-full transition-all duration-500 ${
                  displayOnline
                    ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200'
                    : 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200'
                }`}
                title={statusHint}
              >
                {statusLoading ? (
                  <Loader2Icon className="h-4 w-4 animate-spin text-gray-600 dark:text-gray-300 mr-2" />
                ) : (
                  <span
                    className={`h-2 w-2 rounded-full mr-2 transition-colors duration-500 ${
                      displayOnline ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  />
                )}
                <span className="text-sm font-medium">
                  {statusLoading ? 'Cargando…' : displayOnline ? 'Online' : 'Offline'}
                </span>
              </div>
            )}

            {/* menu de usuario con avatar y logout */}
            <UserMenu
              user={{ name: username || '', role: role || undefined }}
              onSignOut={handleLogout}
            />
          </div>
        </div>
      </div>

      {/* Modal para agregar dispositivo */}
      <AddDeviceModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onDeviceAdded={handleDeviceAdded}
      />
    </header>
  )
}
