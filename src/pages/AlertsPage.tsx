import React, { useEffect, useMemo, useState } from 'react'
import { Layout } from '../components/Layout'
import { AlertTriangleIcon, AlertCircleIcon, CheckCircleIcon, BellIcon, ClockIcon, ChevronRightIcon, ThermometerIcon, DropletIcon, SunIcon } from 'lucide-react'

import { db } from '../firebase'
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore'
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore'
import { useDevice } from '../contexts/DeviceContext'

const ALERTS_PAGE_STORE_KEY = 'alerts_page_v1'

type AlertRow = {
  id: string
  title: string
  message: string
  timestamp: Date
  type: 'temperature' | 'humidity' | 'co2' | 'system'
  severity: 'critical' | 'warning' | 'info'
  status: 'active' | 'resolved'
}

export const AlertsPage: React.FC = () => {
  const { selectedDeviceId } = useDevice()
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'resolved'>('all')
  const [selectedSeverity, setSelectedSeverity] = useState<'all' | 'critical' | 'warning' | 'info'>('all')
  const [selectedType, setSelectedType] = useState<'all' | 'temperature' | 'humidity' | 'co2' | 'system'>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [alerts, setAlerts] = useState<AlertRow[]>([])

  // Restaurar datos desde localStorage primero
  useEffect(() => {
    if (!selectedDeviceId) return
    
    try {
      const raw = localStorage.getItem(ALERTS_PAGE_STORE_KEY)
      if (raw) {
        const s = JSON.parse(raw)
        if (Array.isArray(s?.alerts) && s.alerts.length > 0) {
          setAlerts(s.alerts.map((a: any) => ({
            ...a,
            timestamp: new Date(a.timestamp)
          })))
          setIsLoading(false)
        }
      }
    } catch (e) {
      console.error('Error restaurando alertas:', e)
    }

    // Timeout: si no se conecta a Firestore en 5 segundos, terminar carga
    const timeoutId = setTimeout(() => {
      setIsLoading(false)
    }, 5000)

    // Suscribirse a alertas en tiempo real (últimas 100)
    const colRef = collection(db, `devices/${selectedDeviceId}/eventos`)
    let s1: QueryDocumentSnapshot<DocumentData>[] = []

    const recompute = () => {
      const rows: AlertRow[] = []
      s1.forEach((d) => {
        const v: any = d.data()
        function parseDate(val: any): Date | null {
          if (!val) return null
          if (typeof val === 'object' && typeof val.toDate === 'function') return val.toDate()
          if (typeof val === 'number') return new Date(val > 1e12 ? val : val * 1000)
          return null
        }
        const t = parseDate(v.ts_server) ?? parseDate(v.ts) ?? parseDate(v.timestamp) ?? parseDate(v.ts_device)
        if (!t) return
        
        // Map event data to alert format
        const eventType = v.type || v.event_type || 'system'
        const severity = v.severity || determineSeverity(eventType)
        
        rows.push({
          id: d.id,
          title: v.title || v.event_title || getDefaultTitle(eventType),
          message: v.message || v.description || 'Sin detalles',
          timestamp: t,
          type: mapEventType(eventType),
          severity: severity as 'critical' | 'warning' | 'info',
          status: v.status || 'active'
        })
      })
      rows.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      setAlerts(rows)
      setIsLoading(false)
      hasResolved = true
      clearTimeout(timeoutId)
      try {
        localStorage.setItem(ALERTS_PAGE_STORE_KEY, JSON.stringify({ alerts: rows }))
      } catch {}
    }

    const unsub = onSnapshot(
      query(colRef, orderBy('ts_server', 'desc'), limit(100)),
      (snap) => { s1 = snap.docs; recompute() },
      (err) => {
        console.error('[FS] alerts error:', err)
        if (!hasResolved) {
          setIsLoading(false)
          hasResolved = true
          clearTimeout(timeoutId)
        }
      }
    )

    return () => {
      unsub()
      clearTimeout(timeoutId)
    }
  }, [selectedDeviceId])

  const filteredAlerts = useMemo(() => {
    return alerts.filter(alert => {
      if (activeTab !== 'all' && alert.status !== activeTab) return false
      if (selectedSeverity !== 'all' && alert.severity !== selectedSeverity) return false
      if (selectedType !== 'all' && alert.type !== selectedType) return false
      return true
    })
  }, [alerts, activeTab, selectedSeverity, selectedType])

  const stats = useMemo(() => {
    const activeAlerts = alerts.filter(a => a.status === 'active')
    const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical')
    const warningAlerts = activeAlerts.filter(a => a.severity === 'warning')
    const resolvedAlerts = alerts.filter(a => a.status === 'resolved')
    return {
      active: activeAlerts.length,
      critical: criticalAlerts.length,
      warning: warningAlerts.length,
      resolved: resolvedAlerts.length
    }
  }, [alerts])

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  const getAlertIcon = (type: string, severity: string) => {
    switch (type) {
      case 'temperature':
        return <ThermometerIcon className={`h-5 w-5 ${getSeverityColor(severity, 'text')}`} />
      case 'humidity':
        return <DropletIcon className={`h-5 w-5 ${getSeverityColor(severity, 'text')}`} />
      case 'co2':
        return <SunIcon className={`h-5 w-5 ${getSeverityColor(severity, 'text')}`} />
      case 'system':
        if (severity === 'critical') {
          return <AlertCircleIcon className="h-5 w-5 text-red-500" />
        }
        return <AlertTriangleIcon className={`h-5 w-5 ${getSeverityColor(severity, 'text')}`} />
      default:
        if (severity === 'info') {
          return <CheckCircleIcon className="h-5 w-5 text-green-500" />
        }
        return <AlertTriangleIcon className={`h-5 w-5 ${getSeverityColor(severity, 'text')}`} />
    }
  }

  const getSeverityColor = (severity: string, type: 'bg' | 'text' = 'bg') => {
    switch (severity) {
      case 'critical':
        return type === 'bg' ? 'bg-red-100' : 'text-red-500'
      case 'warning':
        return type === 'bg' ? 'bg-amber-100' : 'text-amber-500'
      case 'info':
        return type === 'bg' ? 'bg-green-100' : 'text-green-500'
      default:
        return type === 'bg' ? 'bg-gray-100' : 'text-gray-500'
    }
  }

  const getSeverityTextColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-800'
      case 'warning':
        return 'text-amber-800'
      case 'info':
        return 'text-green-800'
      default:
        return 'text-gray-800'
    }
  }

  const getSeverityBadgeText = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'Crítico'
      case 'warning':
        return 'Advertencia'
      case 'info':
        return 'Información'
      default:
        return 'Desconocido'
    }
  }

  return (
    <Layout>
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-2 sm:gap-3">
          <AlertTriangleIcon className="h-6 sm:h-8 w-6 sm:w-8 text-amber-500 flex-shrink-0" />
          <h1 className="text-lg sm:text-2xl font-bold text-gray-800 dark:text-white">Sistema de Alertas</h1>
        </div>
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-2">Gestión y seguimiento de alertas del sistema de monitoreo</p>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 sm:h-24 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            ))}
          </div>
          <div className="h-64 sm:h-96 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        </div>
      ) : (
        <>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-3 sm:p-4 transition-colors duration-200">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Alertas Activas</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white mt-1">{stats.active}</p>
            </div>
            <div className="p-2 sm:p-3 bg-red-100 dark:bg-red-900/40 rounded-lg flex-shrink-0">
              <AlertCircleIcon className="h-5 sm:h-6 w-5 sm:w-6 text-red-500" />
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-3 sm:p-4 transition-colors duration-200">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Críticas</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white mt-1">{stats.critical}</p>
            </div>
            <div className="p-2 sm:p-3 bg-red-100 dark:bg-red-900/40 rounded-lg flex-shrink-0">
              <AlertCircleIcon className="h-5 sm:h-6 w-5 sm:w-6 text-red-500" />
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-3 sm:p-4 transition-colors duration-200">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Advertencias</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white mt-1">{stats.warning}</p>
            </div>
            <div className="p-2 sm:p-3 bg-amber-100 dark:bg-amber-900/40 rounded-lg flex-shrink-0">
              <AlertTriangleIcon className="h-5 sm:h-6 w-5 sm:w-6 text-amber-500" />
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-3 sm:p-4 transition-colors duration-200">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Resueltas</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white mt-1">{stats.resolved}</p>
            </div>
            <div className="p-2 sm:p-3 bg-green-100 dark:bg-green-900/40 rounded-lg flex-shrink-0">
              <CheckCircleIcon className="h-6 w-6 text-green-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Alert List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors duration-200">
        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
          <nav className="flex -mb-px" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('all')}
              className={`py-3 sm:py-4 px-3 sm:px-6 font-medium text-xs sm:text-sm border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'all'
                  ? 'border-green-500 text-green-600 dark:text-green-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setActiveTab('active')}
              className={`py-3 sm:py-4 px-3 sm:px-6 font-medium text-xs sm:text-sm border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'active'
                  ? 'border-green-500 text-green-600 dark:text-green-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              Activas
            </button>
            <button
              onClick={() => setActiveTab('resolved')}
              className={`py-3 sm:py-4 px-3 sm:px-6 font-medium text-xs sm:text-sm border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'resolved'
                  ? 'border-green-500 text-green-600 dark:text-green-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              Resueltas
            </button>
          </nav>
        </div>

        {/* Filters */}
        <div className="bg-gray-50 dark:bg-gray-700 p-3 sm:p-4 border-b border-gray-200 dark:border-gray-600 flex flex-col sm:flex-row gap-3 sm:gap-4 transition-colors duration-200">
          <div className="flex-1 min-w-0">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Severidad</label>
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value as any)}
              className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm focus:border-green-500 focus:ring-green-500 text-xs sm:text-sm py-2 pl-3 pr-10 transition-colors duration-200"
            >
              <option value="all">Todas</option>
              <option value="critical">Críticas</option>
              <option value="warning">Advertencias</option>
              <option value="info">Información</option>
            </select>
          </div>
          <div className="flex-1 min-w-0">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as any)}
              className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm focus:border-green-500 focus:ring-green-500 text-xs sm:text-sm py-2 pl-3 pr-10 transition-colors duration-200"
            >
              <option value="all">Todos</option>
              <option value="temperature">Temperatura</option>
              <option value="humidity">Humedad</option>
              <option value="co2">CO₂</option>
              <option value="system">Sistema</option>
            </select>
          </div>
        </div>

        {/* Alert Items */}
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {filteredAlerts.length > 0 ? (
            filteredAlerts.map((alert) => (
              <div key={alert.id} className="p-3 sm:p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <div className="flex items-start gap-2 sm:gap-3">
                  <div className={`p-2 rounded-lg ${getSeverityColor(alert.severity, 'bg')} flex-shrink-0`}>
                    {getAlertIcon(alert.type, alert.severity)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h3 className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">{alert.title}</h3>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(
                          alert.severity,
                          'bg'
                        )} ${getSeverityTextColor(alert.severity)}`}
                      >
                        {getSeverityBadgeText(alert.severity)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs sm:text-sm text-gray-600 dark:text-gray-400">{alert.message}</p>
                    <div className="mt-2 flex items-center flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1 whitespace-nowrap">
                        <ClockIcon className="h-3 sm:h-4 w-3 sm:w-4" />
                        {formatDate(alert.timestamp)}
                      </span>
                      {alert.status === 'active' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200">
                          Activa
                        </span>
                      )}
                      {alert.status === 'resolved' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200">
                          Resuelta
                        </span>
                      )}
                    </div>
                  </div>
                  <button className="ml-2 sm:ml-4 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex-shrink-0">
                    <ChevronRightIcon className="h-4 sm:h-5 w-4 sm:w-5 text-gray-400 dark:text-gray-500" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="p-6 sm:p-8 text-center">
              <div className="mx-auto h-10 sm:h-12 w-10 sm:w-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <BellIcon className="h-5 sm:h-6 w-5 sm:w-6 text-gray-400" />
              </div>
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No hay alertas</h3>
              <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                No se encontraron alertas que coincidan con los filtros seleccionados.
              </p>
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-600 sm:px-6 transition-colors duration-200">
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Mostrando <span className="font-medium">1</span> a{' '}
                <span className="font-medium">{filteredAlerts.length}</span> de{' '}
                <span className="font-medium">{filteredAlerts.length}</span> resultados
              </p>
            </div>
          </div>
        </div>
      </div>
        </>
      )}
    </Layout>
  )
}

function mapEventType(eventType: string): 'temperature' | 'humidity' | 'co2' | 'system' {
  const t = eventType.toLowerCase()
  if (t.includes('temp')) return 'temperature'
  if (t.includes('humid') || t.includes('hum')) return 'humidity'
  if (t.includes('co2') || t.includes('co₂')) return 'co2'
  return 'system'
}

function determineSeverity(eventType: string): 'critical' | 'warning' | 'info' {
  const t = eventType.toLowerCase()
  if (t.includes('error') || t.includes('critical') || t.includes('fail')) return 'critical'
  if (t.includes('warn') || t.includes('low') || t.includes('high')) return 'warning'
  return 'info'
}

function getDefaultTitle(eventType: string): string {
  const t = eventType.toLowerCase()
  if (t.includes('temp')) return 'Alerta de Temperatura'
  if (t.includes('humid') || t.includes('hum')) return 'Alerta de Humedad'
  if (t.includes('co2') || t.includes('co₂')) return 'Alerta de CO₂'
  return 'Alerta del Sistema'
}
