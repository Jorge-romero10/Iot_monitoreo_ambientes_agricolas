import React, { useEffect, useMemo, useState } from 'react'
import Chart from 'chart.js/auto'
import 'jspdf-autotable'

export type Device = { id: string; name: string }

type Props = {
  open: boolean
  onClose: () => void
  devices: Device[]
  defaultDeviceId?: string | null
  onReportGenerated?: (fileName: string) => void
  reportData: {
    deviceName: string
    generatedAt: Date
    periodStart: Date
    periodEnd: Date
    statusHint: string | undefined
    isOnline?: boolean
    latest: {
      timestamp: Date | null
      temperature: number | null
      humidity: number | null
      co2: number | null
    }
    points: Array<{ timestamp: Date; t_air: number | null; h_air: number | null; co2: number | null }>
    events: Array<{ id: string; title: string; status: string; type: string; timeMs: number }>
    summary?: string
  }
}

function waitForJsPDF(): Promise<any> {
  return new Promise((resolve, reject) => {
    // @ts-ignore
    if (window.jspdf && window.jspdf.jsPDF) return resolve(window.jspdf)

    const existing = document.querySelector('script[data-library="jspdf"]')
    if (existing) {
      existing.addEventListener('load', () => {
        // @ts-ignore
        resolve(window.jspdf)
      })
      existing.addEventListener('error', () => reject(new Error('Failed to load jsPDF')))
      return
    }

    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'
    script.async = true
    script.setAttribute('data-library', 'jspdf')
    script.onload = () => {
      // @ts-ignore
      resolve(window.jspdf)
    }
    script.onerror = () => reject(new Error('Failed to load jsPDF'))
    document.body.appendChild(script)
  })
}

function formatDate(d: Date | null) {
  if (!d) return '—'
  return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}

export const ReportModal: React.FC<Props> = ({
  open,
  onClose,
  devices,
  defaultDeviceId,
  onReportGenerated,
  reportData,
}) => {
  const [deviceId, setDeviceId] = useState<string>(defaultDeviceId ?? devices[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setDeviceId(defaultDeviceId ?? devices[0]?.id ?? '')
    setError(null)
  }, [open, defaultDeviceId, devices])

  const selectedDeviceName = useMemo(() => {
    return devices.find((d) => d.id === deviceId)?.name ?? deviceId
  }, [devices, deviceId])

  const handleGenerate = async () => {
    setBusy(true)
    setError(null)

    try {
      const jspdf = await waitForJsPDF()
      const { jsPDF } = jspdf
      const doc = new jsPDF({ unit: 'pt', format: 'a4' })

      const now = new Date()
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()

      const periodStart = reportData.periodStart
      const periodEnd = reportData.periodEnd

      const tempValues = reportData.points
        .map((p) => p.t_air)
        .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
      const humValues = reportData.points
        .map((p) => p.h_air)
        .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
      const co2Values = reportData.points
        .map((p) => p.co2)
        .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))

      const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null)

      const avgTemp = avg(tempValues)
      const avgHum = avg(humValues)
      const avgCO2 = avg(co2Values)

      const uptimePercentage = (() => {
        if (reportData.points.length < 2) return 0
        const spanMs = periodEnd.getTime() - periodStart.getTime()
        const expectedPoints = Math.max(1, Math.round(spanMs / (10 * 60 * 1000)))
        const value = Math.min(100, (reportData.points.length / expectedPoints) * 100)
        return Math.round(value * 10) / 10
      })()

      const criticalEvents = reportData.events.filter((e) => e.type === 'warning' || e.type === 'error')
      const listaAlertas = criticalEvents.length
        ? `${criticalEvents.length} alertas: ${criticalEvents
            .slice(0, 5)
            .map((e) => e.title)
            .join(', ')}${criticalEvents.length > 5 ? ', ...' : ''}`
        : 'No se detectaron alertas críticas.'

      // PAGE 1
      doc.setFillColor(33, 150, 243)
      doc.rect(0, 0, pageWidth, 80, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(28)
      doc.text('REPORTE DE TELEMETRÍA', pageWidth / 2, 40, { align: 'center' })
      doc.setFontSize(10)
      doc.text(`Generado: ${formatDate(now)}`, pageWidth / 2, 63, { align: 'center' })

      let currentY = 100
      doc.setTextColor(0, 0, 0)
      doc.setFont(undefined, 'bold')
      doc.setFontSize(11)
      doc.text('DATOS DEL PERIODO', 40, currentY)
      currentY += 16
      doc.setFont(undefined, 'normal')
      doc.setFontSize(10)

      const periodLines = [
        `Dispositivo: ${selectedDeviceName}`,
        `Periodo: ${formatDate(periodStart)} a ${formatDate(periodEnd)}`,
        `Valores Promedio: Temp: ${avgTemp !== null ? avgTemp.toFixed(1) : 'N/A'}°C, Humedad: ${
          avgHum !== null ? avgHum.toFixed(1) : 'N/A'
        }%, CO2: ${avgCO2 !== null ? avgCO2.toFixed(0) : 'N/A'} ppm`,
        `Eventos Críticos: ${listaAlertas}`,
        `Uptime del Sistema: ${uptimePercentage}%`,
      ]

      periodLines.forEach((line) => {
        doc.text(line, 40, currentY)
        currentY += 16
      })

      currentY += 20

      const resumen = (() => {
        const conditions = [] as string[]
        if (avgTemp !== null && (avgTemp < 18 || avgTemp > 28)) {
          conditions.push('desbalance térmico')
        }
        if (avgHum !== null && (avgHum < 50 || avgHum > 85)) {
          conditions.push('higroestrés')
        }
        if (!conditions.length)
          return 'Las condiciones generales fueron favorables para el cultivo con parámetros dentro de rangos aceptables.'
        return `Se detectó ${conditions.join(' y ')} durante el periodo, lo que puede impactar en el desarrollo de estomas y fotosíntesis.`
      })()

      doc.setFont(undefined, 'bold')
      doc.setFontSize(11)
      doc.text('RESUMEN DE SITUACIÓN', 40, currentY)
      currentY += 14
      doc.setFont(undefined, 'normal')
      doc.setFontSize(10)
      const resumenLines = doc.splitTextToSize(resumen, pageWidth - 80)
      doc.text(resumenLines, 40, currentY)
      currentY += resumenLines.length * 10 + 18

      // ===== ANÁLISIS VPD =====
      const vpdAnalysis = (() => {
        if (avgTemp === null || avgHum === null) return 'Datos insuficientes para evaluar VPD.'
        const highHumidity = avgHum > 85
        const lowTemperature = avgTemp < 20
        if (highHumidity && lowTemperature) {
          return 'La combinación de humedad alta y temperatura baja incrementa el riesgo de condensación y desarrollo de patógenos (mohos, botritis), afectando el intercambio gaseoso y manteniendo el punto de rocío cercano al ambiente.'
        }
        if (highHumidity) {
          return 'La humedad elevada reduce el VPD, limitando transpiración y favoreciendo estrés abiótico por falta de intercambio gaseoso.'
        }
        if (avgTemp > 28) {
          return 'Temperaturas altas elevan el VPD, lo que puede producir cierre de estomas para conservar agua y reducir la tasa fotosintética.'
        }
        return 'La interacción entre humedad y temperatura se mantiene en un rango relativamente estable, apoyando un VPD moderado.'
      })()

      doc.setFont(undefined, 'bold')
      doc.setFontSize(11)
      doc.text('ANÁLISIS HUMEDAD-TEMPERATURA (VPD)', 40, currentY)
      currentY += 14
      doc.setFont(undefined, 'normal')
      doc.setFontSize(10)
      const vpdLines = doc.splitTextToSize(vpdAnalysis, pageWidth - 80)
      doc.text(vpdLines, 40, currentY)
      currentY += vpdLines.length * 10 + 18

      // ===== EVALUACIÓN CO2 =====
      const co2Analysis = (() => {
        if (avgCO2 === null) return 'No hay datos suficientes de CO2 para análisis.'
        if (avgCO2 < 350) return 'Los niveles de CO2 son bajos y pueden limitar la fotosíntesis; se recomienda mejorar la ventilación o aporte de CO2.'
        if (avgCO2 > 1200) return 'Los niveles de CO2 son altos; revisar recirculación y evitar acumulación que pueda afectar el intercambio gaseoso.'
        return 'Los niveles de CO2 son adecuados para mantener una tasa fotosintética eficiente en condiciones de cultivo cerrado.'
      })()

      doc.setFont(undefined, 'bold')
      doc.setFontSize(11)
      doc.text('EVALUACIÓN DE CARBONO (CO2)', 40, currentY)
      currentY += 14
      doc.setFont(undefined, 'normal')
      doc.setFontSize(10)
      const co2Lines = doc.splitTextToSize(co2Analysis, pageWidth - 80)
      doc.text(co2Lines, 40, currentY)
      currentY += co2Lines.length * 10 + 18

      // ===== DIAGNÓSTICO ALERTAS =====
      const alertAnalysis = criticalEvents.length
        ? `Se registraron ${criticalEvents.length} eventos críticos (ej. ${criticalEvents
            .slice(0, 3)
            .map((e) => e.title)
            .join(', ')}). Estos incidentes pueden ser indicio de estrés térmico, cierre de estomas o fallas en el control climático.`
        : 'No se registraron alertas críticas durante el periodo.'

      doc.setFont(undefined, 'bold')
      doc.setFontSize(11)
      doc.text('DIAGNÓSTICO DE ALERTAS', 40, currentY)
      currentY += 14
      doc.setFont(undefined, 'normal')
      doc.setFontSize(10)
      const alertLines = doc.splitTextToSize(alertAnalysis, pageWidth - 80)
      doc.text(alertLines, 40, currentY)
      currentY += alertLines.length * 10 + 18

      // ===== PLAN DE ACCIÓN =====
      const actionLines = [
        '1) Ajustar gestión climática: optimizar ventilación y control de humedad para mantener VPD estable y evitar condensación.',
        '2) Implementar estrategias de ahorro energético: usar ciclos de ventiladores y deshumidificadores únicamente en picos de estrés, monitorizando estomas y punto de rocío.',
        '3) Revisar y calibrar sensores: garantiza mediciones confiables de temperatura, humedad y CO2 para anticipar estrés abiótico y ajustar setpoints.',
      ]

      doc.setFont(undefined, 'bold')
      doc.setFontSize(11)
      doc.text('PLAN DE ACCIÓN SUGERIDO', 40, currentY)
      currentY += 14
      doc.setFont(undefined, 'normal')
      doc.setFontSize(10)
      actionLines.forEach((line) => {
        const wrapped = doc.splitTextToSize(line, pageWidth - 80)
        doc.text(wrapped, 40, currentY)
        currentY += wrapped.length * 10 + 8
      })

      // ===== PIE DE PÁGINA =====
      const footerY = pageHeight - 40
      doc.setDrawColor(33, 150, 243)
      doc.line(40, footerY, pageWidth - 40, footerY)
      doc.setFontSize(8)
      doc.setTextColor(100, 100, 100)
      doc.text('Reporte de Telemetría IoT', pageWidth / 2, footerY + 12, { align: 'center' })
      doc.text('Página 1', pageWidth / 2, pageHeight - 15, { align: 'center' })

      // ==== AGREGAR GRÁFICAS =====
      let tempCanvas: HTMLCanvasElement | null = null
      let humCanvas: HTMLCanvasElement | null = null
      let co2Canvas: HTMLCanvasElement | null = null

      try {
        // Calcular estadísticas
        const getStats = (values: number[]) => {
          if (values.length === 0) return { min: 0, max: 0, avg: 0, range: 0 }
          const min = Math.min(...values)
          const max = Math.max(...values)
          const avg = values.reduce((a, b) => a + b, 0) / values.length
          return { min, max, avg, range: max - min }
        }

        const tempStats = getStats(tempValues)
        const humStats = getStats(humValues)
        const co2Stats = getStats(co2Values)

        // Generar análisis descriptivo
        const generateTempAnalysis = () => {
          const firstVal = tempValues[0] ?? tempStats.avg
          const lastVal = tempValues[tempValues.length - 1] ?? tempStats.avg
          const trend = lastVal < firstVal ? 'a la baja' : lastVal > firstVal ? 'al alza' : 'estable'
          const changeNum = Math.abs(lastVal - firstVal)
          const change = changeNum.toFixed(1)
          
          return `Durante el período se observó una tendencia ${trend}, iniciando en ${firstVal.toFixed(1)}°C y ${lastVal < firstVal ? 'descendiendo' : 'ascendiendo'} a ${lastVal.toFixed(1)}°C. La variación total fue de ${change}°C, con un rango observado entre ${tempStats.min.toFixed(1)}°C (mínima) y ${tempStats.max.toFixed(1)}°C (máxima). El promedio general se mantuvo en ${tempStats.avg.toFixed(1)}°C. ${changeNum > 5 ? 'Se detectó una variación significativa, revisar calibración del sistema.' : 'El control del sistema climático se mantuvo dentro de parámetros aceptables.'}`
        }

        const generateHumAnalysis = () => {
          const firstVal = humValues[0] ?? humStats.avg
          const lastVal = humValues[humValues.length - 1] ?? humStats.avg
          const trend = lastVal < firstVal ? 'a la baja' : lastVal > firstVal ? 'al alza' : 'estable'
          const changeNum = Math.abs(lastVal - firstVal)
          const change = changeNum.toFixed(1)
          
          return `La humedad relativa mostró una tendencia ${trend}, progresando de ${firstVal.toFixed(1)}% a ${lastVal.toFixed(1)}%. Este patrón registró una variación de ${change}%, manteniéndose entre ${humStats.min.toFixed(1)}% (mínima) y ${humStats.max.toFixed(1)}% (máxima), con un promedio de ${humStats.avg.toFixed(1)}%. ${humStats.avg > 80 ? 'Se detectó alto nivel de humedad, existe riesgo de condensación y enfermedades fúngicas.' : humStats.avg < 40 ? 'La humedad es baja, puede afectar la turgencia de las plantas.' : 'Se mantuvo dentro del rango aceptable para cultivos.'}`
        }

        const generateCO2Analysis = () => {
          const firstVal = co2Values[0] ?? co2Stats.avg
          const lastVal = co2Values[co2Values.length - 1] ?? co2Stats.avg
          const trend = lastVal < firstVal ? 'a la baja' : lastVal > firstVal ? 'al alza' : 'estable'
          const changeNum = Math.abs(lastVal - firstVal)
          const change = changeNum.toFixed(0)
          
          return `La concentración de CO2 mostró una tendencia ${trend}, variando de ${firstVal.toFixed(0)} ppm a ${lastVal.toFixed(0)} ppm. La variación registrada fue de ${change} ppm, con niveles entre ${co2Stats.min.toFixed(0)} ppm (mínima) y ${co2Stats.max.toFixed(0)} ppm (máxima), promediando ${co2Stats.avg.toFixed(0)} ppm. ${co2Stats.avg > 600 ? 'Los niveles de CO2 son óptimos para el crecimiento de plantas.' : co2Stats.avg < 300 ? 'Los niveles de CO2 son bajos, considere mejorar la ventilación.' : 'Los niveles se encuentran dentro del rango normal.'}`
        }

        const tempAnalysis = generateTempAnalysis()
        const humAnalysis = generateHumAnalysis()
        const co2Analysis = generateCO2Analysis()

        // Crear contenedor para canvas (invisible pero en el DOM)
        const canvasContainer = document.createElement('div')
        canvasContainer.style.position = 'fixed'
        canvasContainer.style.top = '-10000px'
        canvasContainer.style.left = '0'
        canvasContainer.style.width = '800px'
        canvasContainer.style.visibility = 'visible'
        document.body.appendChild(canvasContainer)

        // Crear canvas dinámicos
        tempCanvas = document.createElement('canvas')
        tempCanvas.width = 800
        tempCanvas.height = 400
        tempCanvas.style.display = 'block'
        canvasContainer.appendChild(tempCanvas)

        humCanvas = document.createElement('canvas')
        humCanvas.width = 800
        humCanvas.height = 400
        humCanvas.style.display = 'block'
        canvasContainer.appendChild(humCanvas)

        co2Canvas = document.createElement('canvas')
        co2Canvas.width = 800
        co2Canvas.height = 400
        co2Canvas.style.display = 'block'
        canvasContainer.appendChild(co2Canvas)

        // Crear charts en canvas dinámicos SECUENCIALMENTE
        let tempChart: Chart | null = null
        if (tempCanvas) {
          tempChart = new Chart(tempCanvas, {
            type: 'line',
            data: {
              labels: reportData.points.map((p) =>
                new Date(p.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
              ),
              datasets: [
                {
                  label: 'Temperatura (°C)',
                  data: reportData.points.map((p) => p.t_air),
                  borderColor: '#ef4444',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  borderWidth: 2,
                  tension: 0.4,
                  fill: true,
                  pointRadius: 0,
                  pointHoverRadius: 5,
                },
              ],
            },
            options: {
              responsive: false,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: true },
              },
              scales: {
                y: { beginAtZero: false },
                x: { display: true, ticks: { maxTicksLimit: 6 } },
              },
            },
          })
        }
        
        // Esperar a que se renderice el primer chart
        await new Promise((resolve) => setTimeout(resolve, 1500))

        let humChart: Chart | null = null
        if (humCanvas) {
          humChart = new Chart(humCanvas, {
            type: 'line',
            data: {
              labels: reportData.points.map((p) =>
                new Date(p.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
              ),
              datasets: [
                {
                  label: 'Humedad Relativa (%)',
                  data: reportData.points.map((p) => p.h_air),
                  borderColor: '#3b82f6',
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  borderWidth: 2,
                  tension: 0.4,
                  fill: true,
                  pointRadius: 0,
                  pointHoverRadius: 5,
                },
              ],
            },
            options: {
              responsive: false,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: true },
              },
              scales: {
                y: { beginAtZero: false },
                x: { display: true, ticks: { maxTicksLimit: 6 } },
              },
            },
          })
        }

        // Esperar a que se renderice el segundo chart
        await new Promise((resolve) => setTimeout(resolve, 1500))

        let co2Chart: Chart | null = null
        if (co2Canvas) {
          co2Chart = new Chart(co2Canvas, {
            type: 'line',
            data: {
              labels: reportData.points.map((p) =>
                new Date(p.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
              ),
              datasets: [
                {
                  label: 'Concentración de CO2 (ppm)',
                  data: reportData.points.map((p) => p.co2),
                  borderColor: '#10b981',
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  borderWidth: 2,
                  tension: 0.4,
                  fill: true,
                  pointRadius: 0,
                  pointHoverRadius: 5,
                },
              ],
            },
            options: {
              responsive: false,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: true },
              },
              scales: {
                y: { beginAtZero: false },
                x: { display: true, ticks: { maxTicksLimit: 6 } },
              },
            },
          })
        }

        // Esperar a que se renderice el tercer chart
        await new Promise((resolve) => setTimeout(resolve, 1500))

        // Esperar renderizado final
        await new Promise((resolve) => setTimeout(resolve, 1200))

        const imgWidth = pageWidth - 80
        const imgHeight = 200
        let currentGraphY = 60

        // ===== PÁGINA 1: TODAS LAS GRÁFICAS CONSECUTIVAS =====
        doc.addPage('a4')
        doc.setFillColor(33, 150, 243)
        doc.rect(0, 0, pageWidth, 40, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(14)
        doc.text('Análisis de Gráficas', 40, 25, { align: 'left' })

        currentGraphY = 60

        // ===== TEMPERATURA =====
        doc.setTextColor(239, 68, 68)
        doc.setFontSize(12)
        doc.setFont(undefined, 'bold')
        doc.text('Temperatura (°C)', 40, currentGraphY)
        currentGraphY += 8

        if (tempCanvas) {
          const tempImg = tempCanvas.toDataURL('image/png')
          doc.addImage(tempImg, 'PNG', 40, currentGraphY, imgWidth, imgHeight)
          currentGraphY += imgHeight + 8
          
          // Análisis descriptivo
          doc.setTextColor(0, 0, 0)
          doc.setFontSize(10)
          doc.setFont(undefined, 'normal')
          doc.text(tempAnalysis, 40, currentGraphY, { maxWidth: pageWidth - 80, align: 'justify' })
          
          // Calcular altura del texto
          const tempHeight = doc.getTextDimensions(tempAnalysis, { maxWidth: pageWidth - 80 }).h
          currentGraphY += tempHeight + 25
        }

        // ===== HUMEDAD =====
        doc.setTextColor(59, 130, 246)
        doc.setFontSize(12)
        doc.setFont(undefined, 'bold')
        doc.text('Humedad Relativa (%)', 40, currentGraphY)
        currentGraphY += 8

        if (humCanvas) {
          const humImg = humCanvas.toDataURL('image/png')
          doc.addImage(humImg, 'PNG', 40, currentGraphY, imgWidth, imgHeight)
          currentGraphY += imgHeight + 8
          
          // Análisis descriptivo
          doc.setTextColor(0, 0, 0)
          doc.setFontSize(10)
          doc.setFont(undefined, 'normal')
          doc.text(humAnalysis, 40, currentGraphY, { maxWidth: pageWidth - 80, align: 'justify' })
          
          // Calcular altura del texto
          const humHeight = doc.getTextDimensions(humAnalysis, { maxWidth: pageWidth - 80 }).h
          currentGraphY += humHeight + 25
        }

        // ===== CO2 =====
        // Verificar si hay espacio suficiente, si no, agregar nueva página
        const co2SpaceNeeded = 15 + imgHeight + 30 // título + gráfica + análisis aproximado
        const pageHeight = 270 // altura disponible en página A4
        
        if (currentGraphY + co2SpaceNeeded > pageHeight) {
          // No cabe en página actual, crear nueva página
          doc.addPage('a4')
          doc.setFillColor(33, 150, 243)
          doc.rect(0, 0, pageWidth, 40, 'F')
          doc.setTextColor(255, 255, 255)
          doc.setFontSize(14)
          doc.text('Análisis de Gráficas (Cont.)', 40, 25, { align: 'left' })
          currentGraphY = 60
        }
        
        doc.setTextColor(16, 185, 129)
        doc.setFontSize(12)
        doc.setFont(undefined, 'bold')
        doc.text('Concentración de CO2 (ppm)', 40, currentGraphY)
        currentGraphY += 8

        if (co2Canvas) {
          const co2Img = co2Canvas.toDataURL('image/png')
          doc.addImage(co2Img, 'PNG', 40, currentGraphY, imgWidth, imgHeight)
          currentGraphY += imgHeight + 8
          
          // Análisis descriptivo
          doc.setTextColor(0, 0, 0)
          doc.setFontSize(10)
          doc.setFont(undefined, 'normal')
          doc.text(co2Analysis, 40, currentGraphY, { maxWidth: pageWidth - 80, align: 'justify' })
        }

        // Destruir charts y limpiar elementos del DOM
        if (tempChart) tempChart.destroy()
        if (humChart) humChart.destroy()
        if (co2Chart) co2Chart.destroy()
        
        // Remover canvas dinámicos y contenedor del DOM
        if (tempCanvas && tempCanvas.parentNode) {
          const container = tempCanvas.parentNode
          container.removeChild(tempCanvas)
          if (container.parentNode) container.parentNode.removeChild(container)
        }
        if (humCanvas && humCanvas.parentNode) humCanvas.parentNode.removeChild(humCanvas)
        if (co2Canvas && co2Canvas.parentNode) co2Canvas.parentNode.removeChild(co2Canvas)
      } catch (chartError) {
        console.warn('Error en gráficas:', chartError)
      }

      const fileName = `reporte_${selectedDeviceName.replace(/\s+/g, '_')}_${now.toISOString().slice(0, 19).replace(/[:T]/g, '-')}.pdf`
      doc.save(fileName)

      onReportGenerated?.(fileName)
      onClose()
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Error desconocido'
      setError(`Error: ${errorMsg}`)
      console.error('Error:', e)
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Generar reporte en PDF</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Crear reporte detallado de telemetría con análisis completo.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Dispositivo</label>
              <select
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm focus:border-green-500 focus:ring-green-500"
              >
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            {error ? <div className="text-sm text-red-600 dark:text-red-300">{error}</div> : null}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-md border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                disabled={busy}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                className="px-4 py-2 rounded-md bg-green-600 text-white text-sm hover:bg-green-700 disabled:opacity-60"
                disabled={busy}
              >
                {busy ? 'Generando...' : 'Generar reporte'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Canvas para capturar gráficas no incluidos aquí - se crean dinámicamente en handleGenerate */}
    </>
  )
}
