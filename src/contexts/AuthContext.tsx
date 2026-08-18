import React, { useEffect, useState, createContext, useContext } from 'react'

interface AuthContextType {
  isAuthenticated: boolean
  isInitializing: boolean
  role: 'admin' | 'guest' | null
  username: string | null
  login: (username: string, password?: string) => Promise<boolean>
  loginAsGuest: () => void
  logout: () => void
  /** true cuando el usuario está conectado y es admin */
  isAdmin: boolean
  /** true cuando el usuario está conectado como invitado */
  isGuest: boolean
}
const AuthContext = createContext<AuthContextType | undefined>(undefined)
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)
  const [role, setRole] = useState<'admin' | 'guest' | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  
  // URL del servidor backend (configurable)
  // En desarrollo: http://localhost:3001
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
  
  // Check for stored session on mount
  useEffect(() => {
    const storedRole = sessionStorage.getItem('auth_role')
    const storedUser = sessionStorage.getItem('auth_user')
    if (storedRole && storedUser) {
      setIsAuthenticated(true)
      setRole(storedRole as 'admin' | 'guest')
      setUsername(storedUser)
    }
    // Marcar que la verificación inicial terminó
    setIsInitializing(false)
  }, [])
  
  const login = async (user: string, pass?: string) => {
    try {
      // Credenciales desde variables de entorno
      const ADMIN_USERNAME = import.meta.env.VITE_ADMIN_USERNAME
      const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD
      
      // Validar credenciales localmente
      if (user === ADMIN_USERNAME && pass === ADMIN_PASSWORD) {
        setIsAuthenticated(true)
        setRole('admin')
        setUsername('Administrador')
        sessionStorage.setItem('auth_role', 'admin')
        sessionStorage.setItem('auth_user', 'Administrador')
        return true
      } else {
        return false
      }
    } catch (error: any) {
      console.error('Login error:', error)
      return false
    }
  }
  
  const loginAsGuest = () => {
    setIsAuthenticated(true)
    setRole('guest')
    setUsername('Invitado')
    sessionStorage.setItem('auth_role', 'guest')
    sessionStorage.setItem('auth_user', 'Invitado')
    // No hay token para invitados
  }
  
  const logout = () => {
    setIsAuthenticated(false)
    setRole(null)
    setUsername(null)
    sessionStorage.removeItem('auth_role')
    sessionStorage.removeItem('auth_user')
    localStorage.removeItem('auth_role')
    localStorage.removeItem('auth_user')
  }
  
  const isAdmin = role === 'admin'
  const isGuest = role === 'guest'

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isInitializing,
        role,
        username,
        login,
        loginAsGuest,
        logout,
        isAdmin,
        isGuest,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
