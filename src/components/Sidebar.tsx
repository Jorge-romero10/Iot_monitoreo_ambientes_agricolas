import React from 'react'
import {
  BarChart2Icon,
  ThermometerIcon,
  DropletIcon,
  WindIcon,            // CO₂
  MapIcon,
  SettingsIcon,
} from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

type SidebarProps = {
  isOpen: boolean
  toggleSidebar: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, toggleSidebar }) => {
  const location = useLocation()
  const { role } = useAuth()

  // base siempre disponible
  const baseItems = [
    { name: 'Dashboard', icon: <BarChart2Icon className="h-5 w-5" />, path: '/dashboard' },
    { name: 'Mapa', icon: <MapIcon className="h-5 w-5" />, path: '/map' },
  ] as const

  // solo para admins
  const adminItems = [
    { name: 'Temperatura', icon: <ThermometerIcon className="h-5 w-5" />, path: '/temperature' },
    { name: 'Humedad',     icon: <DropletIcon className="h-5 w-5" />,     path: '/humidity' },
    { name: 'CO₂',         icon: <WindIcon className="h-5 w-5" />,        path: '/co2' },
    //{ name: 'Alertas',      icon: <AlertTriangleIcon className="h-5 w-5" />, path: '/alerts' },
    { name: 'Configuración', icon: <SettingsIcon className="h-5 w-5" />, path: '/device-config' },
  ] as const

  const menuItems = role === 'admin' ? [...baseItems, ...adminItems] : baseItems

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)

  const handleLinkClick = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      toggleSidebar()
    }
  }

  return (
    <>
      {/* Overlay móvil */}
      <div
        className={`fixed inset-0 bg-gray-600 bg-opacity-75 z-20 transition-opacity lg:hidden ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={toggleSidebar}
      />

      {/* Panel */}
      <div
        className={`fixed inset-y-0 left-0 w-64 bg-white dark:bg-gray-800 shadow-lg transform transition-transform z-30 lg:translate-x-0 lg:static lg:inset-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="bg-green-600 py-3 sm:py-4 px-4 sm:px-6">
            <h2 className="text-sm sm:text-lg font-medium text-white truncate">
              Sistema de monitoreo
            </h2>
          </div>

          {/* Nav */}
          <nav className="flex-1 pt-2 overflow-y-auto">
            <div className="space-y-1 px-2">
              {menuItems.map((item) => {
                const active = isActive(item.path)
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    onClick={handleLinkClick}
                    className={[
                      'flex items-center px-4 py-3 text-xs sm:text-sm font-medium rounded-md group border-l-4 transition-colors',
                      active
                        ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-600'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border-transparent',
                    ].join(' ')}
                    aria-current={active ? 'page' : undefined}
                  >
                    <span className={`mr-3 flex-shrink-0 ${active ? 'text-green-600' : 'text-gray-500 dark:text-gray-400'}`}>
                      {item.icon}
                    </span>
                    <span className="truncate">{item.name}</span>
                  </Link>
                )
              })}
            </div>
          </nav>

          {/* Footer */}
          <div className="p-3 sm:p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center min-w-0">
              <img 
                src="/unillanos-logo.png" 
                alt="Universidad de Los Llanos"
                className="h-8 w-8 flex-shrink-0 object-contain"
              />
              <div className="ml-2 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                  Proyecto de Grado
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">IoT para Cultivos</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
