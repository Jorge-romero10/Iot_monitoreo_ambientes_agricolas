import { MapPage } from './pages/MapPage.tsx'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { Dashboard } from './components/Dashboard' 
import { TemperaturePage } from './pages/TemperaturePage'
import { HumidityPage } from './pages/HumidityPage'
import { CO2Page } from './pages/CO2Page'
import { AlertsPage } from './pages/AlertsPage'
import { LoginPage } from './pages/LoginPage'
import { DeviceConfigPage } from './pages/DeviceConfigPage'

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { isAuthenticated, isInitializing } = useAuth()
  
  // Mientras se verifica la sesión, mostrar un loader
  if (isInitializing) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-200 dark:border-gray-700 border-t-green-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Verificando sesión...</p>
        </div>
      </div>
    )
  }
  
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

// sólo administradores pueden acceder; invita redirige al dashboard
const AdminRoute = ({ children }: { children: JSX.Element }) => {
  const { isAdmin, isInitializing } = useAuth()
  
  // Mientras se verifica la sesión, no hacer nada
  if (isInitializing) {
    return children // Dejar que ProtectedRoute maneje el loader
  }
  
  return isAdmin ? children : <Navigate to="/dashboard" replace />
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* / → /dashboard */}
        <Route
          path="/map"
          element={
            <ProtectedRoute>
              <MapPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Navigate to="/dashboard" replace />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/temperature"
          element={
            <ProtectedRoute>
              <AdminRoute>
                <TemperaturePage />
              </AdminRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/humidity"
          element={
            <ProtectedRoute>
              <AdminRoute>
                <HumidityPage />
              </AdminRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/co2"
          element={
            <ProtectedRoute>
              <AdminRoute>
                <CO2Page />
              </AdminRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/alerts"
          element={
            <ProtectedRoute>
              <AdminRoute>
                <AlertsPage />
              </AdminRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/device-config"
          element={
            <ProtectedRoute>
              <AdminRoute>
                <DeviceConfigPage />
              </AdminRoute>
            </ProtectedRoute>
          }
        />

        {/* 404 → /dashboard */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
