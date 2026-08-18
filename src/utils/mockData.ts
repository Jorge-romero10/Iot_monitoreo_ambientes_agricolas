// src/utils/mockData.ts (versión segura)
export const mockData = {
  currentReadings: {
    airTemperature: {
      value: null,          // antes 0 o 23.xx → null para que MetricCards muestre "—"
      unit: '°C',
      change: 0,
      sparkline: [] as number[], // sin chispas falsas
    },
    soilTemperature: {
      value: null,
      unit: '°C',
      change: 0,
      sparkline: [] as number[],
    },
    humidity: {
      value: null,
      unit: '%',
      change: 0,
      sparkline: [] as number[],
    },
    light: {
      value: null,
      unit: '%',
      change: 0,
      sparkline: [] as number[],
    },
  },

  // Para ChartSection: arrays vacíos (el componente ya tolera esto)
  temperatureData: [] as Array<{
    // ChartSection acepta varias claves: air|airTemp|t_air, soil|soilTemp|t_soil
    time?: string
    date?: string
    airTemp?: number | null
    soilTemp?: number | null
    air?: number | null
    soil?: number | null
  }>,

  environmentalData: [] as Array<{
    time?: string
    timestamp?: string
    humidity?: number | null
    light?: number | null
    co2?: number | null
  }>,

  // Ejemplos de eventos (opcional)
  events: [
    // { title: 'Sin conexión', time: '—', status: 'Sin datos', type: 'warning' as const },
  ],
}
