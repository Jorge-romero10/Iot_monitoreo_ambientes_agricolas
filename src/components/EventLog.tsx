import React from 'react'
import {
  AlertCircleIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  ClockIcon,
} from 'lucide-react'
import { EventItem, EventType } from '../contexts/EventLogContext'

function formatEventTime(timeMs: number) {
  return new Date(timeMs).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}

type Props = {
  events: EventItem[]
  moreCount?: number          // cuántos eventos adicionales hay
  onViewAll?: () => void      // abre modal
  onClear?: () => void        // limpiar todos los eventos
}

export const EventLog: React.FC<Props> = ({ events, moreCount = 0, onViewAll, onClear }) => {
  const getEventIcon = (type: EventType) => {
    switch (type) {
      case 'error':
        return <AlertCircleIcon className="h-5 w-5 text-red-500" />
      case 'success':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />
      case 'warning':
        return <AlertTriangleIcon className="h-5 w-5 text-amber-500" />
      default:
        return <ClockIcon className="h-5 w-5 text-gray-400" />
    }
  }

  const badgeClass = (t: EventType) =>
    t === 'error'
      ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
      : t === 'success'
      ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
      : t === 'warning'
      ? 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200'
      : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-6 h-full transition-colors duration-200">
      <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2">
        <h2 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-white truncate">
          Últimos eventos
        </h2>
        <div className="flex items-center gap-2 flex-shrink-0">
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium px-2 py-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors whitespace-nowrap"
            >
              Borrar
            </button>
          )}
        </div>
      </div>

      {events.length === 0 ? (
        <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 py-6 text-center">
          No hay eventos recientes.
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {events.map((event, index) => (
            <div key={event.id ?? `${event.title}-${index}`} className="flex items-start gap-2">
              <div className="flex-shrink-0 mt-1">{getEventIcon(event.type)}</div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-800 dark:text-white break-words">
                  {event.title}
                </p>
                {event.deviceName ? (
                  <p className="text-xs text-gray-500 dark:text-gray-400">Dispositivo: {event.deviceName}</p>
                ) : null}
                {event.dataTimeMs ? (
                  <p className="text-xs text-gray-500 dark:text-gray-400">Último dato: {formatEventTime(event.dataTimeMs)}</p>
                ) : null}
                <div className="flex items-center mt-1 gap-1 flex-wrap">
                  <p className="text-xs text-gray-500 dark:text-gray-400">{formatEventTime(event.timeMs)}</p>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badgeClass(
                      event.type
                    )}`}
                  >
                    {event.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Botón solo si hay más de los que se muestran en la vista previa */}
      {moreCount > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
          <button
            type="button"
            onClick={onViewAll}
            className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
          >
            Ver todos los eventos ({moreCount})
          </button>
        </div>
      )}
    </div>
  )
}
