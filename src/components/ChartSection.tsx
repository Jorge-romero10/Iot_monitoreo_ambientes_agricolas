import React from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

type Range = '1h' | '6h' | '12h' | '24h'

type Props = {
  title: string
  selectedTimeRange: Range
  setSelectedTimeRange: (r: Range) => void
  /** Array de puntos del rango ACTUAL (no el objeto por rango) */
  data: any[]
  /** 'temperature' | 'environmental' | 'humidity' | 'co2' */
  type: 'temperature' | 'environmental' | 'humidity' | 'co2'
  darkMode?: boolean
}

export const ChartSection: React.FC<Props> = ({
  title,
  selectedTimeRange,
  setSelectedTimeRange,
  data,
  type,
  darkMode,
}) => {
  const timeRanges: { label: string; value: Range }[] = [
    { label: '1h', value: '1h' },
    { label: '6h', value: '6h' },
    { label: '12h', value: '12h' },
    { label: '24h', value: '24h' },
  ]

  // --- Detección de la clave X ---
  const xKey: 'date' | 'timestamp' | 'time' = React.useMemo(() => {
    if (!data?.length) return 'date'
    const d = data[0]
    if ('date' in d) return 'date'
    if ('timestamp' in d) return 'timestamp'
    if ('time' in d) return 'time'
    return 'date'
  }, [data])

  // --- Config líneas (acepta nombres nuevos y viejos) ---
  const isTemp = type === 'temperature'
  const isHum = type === 'humidity'
  const isCO2 = type === 'co2'

  const lines = isTemp
    ? [
        {
          name: 'T° ambiente (°C)',
          color: '#3b82f6',
          // acepta air | airTemp | t_air
          accessor: (row: any) => row.air ?? row.airTemp ?? row.t_air ?? null,
        },
      ]
    : isHum
    ? [
        {
          name: 'Humedad (%)',
          color: '#8b5cf6',
          accessor: (row: any) => row.humidity ?? row.h_air ?? null,
        },
      ]
    : isCO2
    ? [
        {
          name: 'CO₂ (ppm)',
          color: '#14b8a6',
          accessor: (row: any) => row.co2 ?? row.co2_ppm ?? null,
        },
      ]
    : [
        {
          name: 'Humedad (%)',
          color: '#8b5cf6',
          accessor: (row: any) => row.humidity ?? row.h_air ?? null,
        },
        {
          name: 'CO₂ (ppm)',
          color: '#14b8a6',
          accessor: (row: any) => row.co2 ?? row.co2_ppm ?? null,
        },
      ]

  const yAxisLabel = isTemp ? 'Temperatura (°C)' : isHum ? 'Humedad (%)' : isCO2 ? 'CO₂ (ppm)' : 'Valor'

  // --- Formatters eje X / tooltip ---
  const fmtDate = (v: any) => {
    // v puede ser ISO string, Date o HH:mm string
    const dt =
      v instanceof Date ? v : typeof v === 'string' ? new Date(v) : new Date(String(v))
    if (Number.isNaN(+dt)) return String(v ?? '')
    if (selectedTimeRange === '24h') {
      return dt.toLocaleTimeString(undefined, {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
      })
    }
    return dt.toLocaleDateString(undefined, { day: 'numeric', month: 'numeric' })
  }

  const gridColor = darkMode ? '#374151' : '#f1f1f1'
  const tickColor = darkMode ? '#9ca3af' : '#64748b'
  const tooltipBg = darkMode ? '#1f2937' : '#ffffff'
  const tooltipBorder = darkMode ? '1px solid #374151' : '1px solid #e5e7eb'
  const textColor = darkMode ? '#f9fafb' : '#111827'

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-6 transition-colors duration-200">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-4">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white">{title}</h2>
        <div className="w-full sm:w-auto flex space-x-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-md overflow-x-auto">
          {timeRanges.map((range) => (
            <button
              key={range.value}
              className={`px-2 sm:px-3 py-1 text-xs sm:text-sm rounded-md transition-colors whitespace-nowrap ${
                selectedTimeRange === range.value
                  ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-800 dark:text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
              onClick={() => setSelectedTimeRange(range.value)}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-64 sm:h-80 overflow-x-auto -mx-4 sm:-mx-6 px-4 sm:px-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={300}>
          <LineChart
            data={Array.isArray(data) ? data : []}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis
              dataKey={xKey}
              tick={{ fontSize: 12, fill: tickColor }}
              tickFormatter={fmtDate}
              minTickGap={20}
            />
            <YAxis
              label={{
                value: yAxisLabel,
                angle: -90,
                position: 'insideLeft',
                style: { textAnchor: 'middle', fontSize: 12, fill: tickColor },
              }}
              tick={{ fontSize: 12, fill: tickColor }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: tooltipBg,
                borderRadius: '0.375rem',
                border: tooltipBorder,
                boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1)',
                color: textColor,
              }}
              labelStyle={{ fontWeight: 'bold', marginBottom: '0.25rem', color: textColor }}
              itemStyle={{ color: textColor }}
              labelFormatter={fmtDate}
            />
            <Legend wrapperStyle={{ paddingTop: '0.75rem', fontSize: '0.875rem' }} />
            {lines.map((ln) => (
              <Line
                key={ln.name}
                type="monotone"
                dataKey={ln.accessor} // ← permite air|airTemp|t_air, etc.
                stroke={ln.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6 }}
                name={ln.name}
                isAnimationActive={true}
                animationDuration={800}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
