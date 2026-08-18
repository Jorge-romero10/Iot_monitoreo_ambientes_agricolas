import React, { useEffect, useRef, useState } from 'react'
import {
  ChevronDownIcon,
  LogOutIcon,
} from 'lucide-react'

type UserInfo = {
  name?: string
  email?: string
  role?: string
  avatar?: string
}

type UserMenuProps = {
  user?: UserInfo
  onSignOut?: () => void
}

const MOCK_USER: UserInfo = {
  name: 'Jorge Romero',
  email: 'carlos.rodriguez@agrisense.com',
  role: 'Ingeniero Electronico',
  avatar:
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
}

export const UserMenu: React.FC<UserMenuProps> = ({
  user = MOCK_USER,
  onSignOut,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const firstItemRef = useRef<HTMLButtonElement | null>(null)

  // Cerrar al hacer clic fuera
  useEffect(() => {
    if (typeof document === 'undefined') return
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Cerrar con ESC y enfocar primer item al abrir
  useEffect(() => {
    if (typeof document === 'undefined') return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (isOpen) {
      // pequeño timeout para que el DOM pinte
      setTimeout(() => firstItemRef.current?.focus(), 0)
    }
  }, [isOpen])

  const toggleMenu = () => setIsOpen((v) => !v)

  const avatar =
    user?.avatar ||
    `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(
      user?.name || 'User'
    )}`

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={toggleMenu}
        className="flex items-center space-x-3 focus:outline-none"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <img
          className="h-8 w-8 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700"
          src={avatar}
          alt={user?.name || 'Usuario'}
        />
        <div className="hidden md:block text-left">
          <p className="text-sm font-medium text-gray-800 dark:text-white">
            {user?.name || 'Usuario'}
          </p>
          {user?.role && (
            <p className="text-xs text-gray-500 dark:text-gray-400">{user.role}</p>
          )}
        </div>
        <ChevronDownIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 border border-gray-200 dark:border-gray-700 z-50"
          role="menu"
          aria-label="Menú de usuario"
        >
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <p className="text-sm font-medium text-gray-800 dark:text-white">
              {user?.name || 'Usuario'}
            </p>
            {user?.email && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {user.email}
              </p>
            )}
          </div>


          <button
            ref={firstItemRef}
            onClick={onSignOut}
            role="menuitem"
            className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center focus:outline-none"
          >
            <LogOutIcon className="h-4 w-4 mr-3 text-red-500 dark:text-red-400" />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}
