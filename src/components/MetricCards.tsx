import React from 'react'
import {
  ThermometerIcon,
  DropletIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  WindIcon, // CO₂
} from 'lucide-react'
import { ResponsiveContainer, AreaChart, Area, Tooltip } from 'recharts'

type MetricDatum = {
  value: number | null
  change: number
  sparkline: number[]
  times?: string[]
  danger?: boolean
}

type MetricCardsData = {
  airTemperature: MetricDatum
  humidity: MetricDatum
  co2: MetricDatum
}

type Props = { data: MetricCardsData }

/** true = card roja sólida cuando danger; false = sólo aro rojo */
const DANGER_SOLID_CARD = true

const palette = {
  blue:  { stroke: '#3b82f6', fill: '#3b82f6' },  // aire
  purple:{ stroke: '#8b5cf6', fill: '#8b5cf6' },  // humedad
  teal:  { stroke: '#14b8a6', fill: '#14b8a6' },  // CO2
  red:   { stroke: '#ef4444', fill: '#ef4444' },
}

type SeriesPoint = { i: number; y: number; t?: string }
const toSeries = (arr: number[], times?: string[]): SeriesPoint[] =>
  !arr?.length ? [{ i: 0, y: 0, t: '' }] : arr.map((y, i) => ({ i, y, t: times?.[i] }))

export const MetricCards: React.FC<Props> = ({ data }) => {
  const metrics = [
    {
      key: 'air',
      title: 'T° aire',
      value: data.airTemperature.value,
      unit: '°C',
      icon: <ThermometerIcon className="h-6 w-6 text-blue-500" />,
      change: data.airTemperature.change,
      color: palette.blue,
      danger: !!data.airTemperature.danger,
      series: toSeries(data.airTemperature.sparkline, data.airTemperature.times),
    },
    {
      key: 'hum',
      title: 'Humedad',
      value: data.humidity.value,
      unit: '%',
      icon: <DropletIcon className="h-6 w-6 text-purple-500" />,
      change: data.humidity.change,
      color: palette.purple,
      danger: !!data.humidity.danger,
      series: toSeries(data.humidity.sparkline, data.humidity.times),
    },
    {
      key: 'co2',
      title: 'CO₂',
      value: data.co2.value,
      unit: 'ppm',
      icon: <WindIcon className="h-6 w-6 text-teal-500" />,
      change: data.co2.change,
      color: data.co2.danger ? palette.red : palette.teal,
      danger: !!data.co2.danger,
      series: toSeries(data.co2.sparkline, data.co2.times),
    },
  ] as const

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      {metrics.map((m) => {
        const showChange = Number.isFinite(m.change) && m.change !== 0
        const isNum = Number.isFinite(m.value as number)
        const valueClass = m.danger ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-white'
        const baseCardClass = m.danger && DANGER_SOLID_CARD
          ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800'
          : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700'

        return (
          <div
            key={m.key}
            className={`${baseCardClass} rounded-lg shadow-sm p-6 transition-all hover:shadow-md ${
              m.danger && !DANGER_SOLID_CARD ? 'ring-1 ring-red-300/60 dark:ring-red-800/50' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <div className={`p-2 rounded-md ${m.danger && DANGER_SOLID_CARD ? 'bg-red-100 dark:bg-red-900/50' : 'bg-gray-50 dark:bg-gray-700'}`}>
                  {m.icon}
                </div>
                <h3 className={`ml-3 text-sm font-medium ${
                  m.danger && DANGER_SOLID_CARD ? 'text-red-700 dark:text-red-200' : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {m.title}
                </h3>
                {m.danger && (
                  <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200">
                    ALTA
                  </span>
                )}
              </div>

              {showChange && (
                <div className={`flex items-center text-xs font-medium ${
                  m.change > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {m.change > 0 ? <ArrowUpIcon className="h-3 w-3 mr-1" /> : <ArrowDownIcon className="h-3 w-3 mr-1" />}
                  {Math.abs(m.change)}%
                </div>
              )}
            </div>

            <div className="flex items-end">
              <span className={`text-3xl font-bold ${valueClass}`}>{formatValue(m.value)}</span>
              {isNum && (
                <span className={`ml-1 text-lg ${
                  m.danger && DANGER_SOLID_CARD ? 'text-red-700/80 dark:text-red-200/80' : 'text-gray-500 dark:text-gray-400'
                }`}>{m.unit}</span>
              )}
            </div>

            <div className="mt-4 h-12">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={m.series}>
                  <defs>
                    <linearGradient id={`grad-${m.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"  stopColor={m.color.fill} stopOpacity={0.35}/>
                      <stop offset="100%" stopColor={m.color.fill} stopOpacity={0.05}/>
                    </linearGradient>
                  </defs>
                  <Tooltip
                    cursor={{ stroke: m.color.stroke, strokeOpacity: 0.35, strokeWidth: 1 }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const p = payload[0].payload as SeriesPoint
                      return (
                        <div className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs shadow-sm dark:border-gray-700 dark:bg-gray-800">
                          <div className="font-medium text-gray-800 dark:text-gray-200">
                            {formatValue(p.y)} {Number.isFinite(p.y) ? m.unit : ''}
                          </div>
                          {p.t && <div className="text-gray-500 dark:text-gray-400">{p.t}</div>}
                        </div>
                      )
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="y"
                    stroke={m.color.stroke}
                    strokeWidth={2}
                    fill={`url(#grad-${m.key})`}
                    isAnimationActive={false}
                    dot={false}
                    activeDot={{ r: 3 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function formatValue(v: number | null): string {
  if (!Number.isFinite(v as number)) return 'N/D'
  const n = v as number
  return Math.abs(n) >= 10 ? n.toFixed(1) : n.toFixed(2)
}
