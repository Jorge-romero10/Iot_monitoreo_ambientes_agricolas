# Mejoras en Generación de Reportes PDF

## Cambios Realizados

### 1. **Instalación de html2canvas**
Se instaló la librería `html2canvas` para capturar las gráficas Recharts como imágenes PNG.

```bash
npm install html2canvas
```

### 2. **Mejoras en el componente ReportModal.tsx**

#### Antes:
- PDF de una sola página con solo texto
- Sin gráficas de métricas
- Organización básica

#### Después:
- **PDF de 4 páginas** bien organizadas
- **Gráficas incluidas** (Temperatura, Humedad, CO2)
- **Mejor estructura visual** y fácil de leer

### 3. **Estructura del Nuevo PDF**

#### **Página 1: Portada y Resumen**
- Título profesional con diseño azul
- Rango de fechas del reporte
- Resumen de métricas clave:
  - Temperatura (promedio, mín, máx)
  - Humedad (promedio, mín, máx)
  - CO2 (promedio, mín, máx)
- Estado del sistema (eventos, uptime)

#### **Página 2: Análisis Detallado**
- Resumen de situación
- Análisis de Humedad-Temperatura (VPD)
- Evaluación de CO2
- Recomendaciones específicas

#### **Página 3: Gráfica de Temperatura**
- Gráfica de línea mostrando temperaturas en el tiempo
- Escala completa para mejor visualización
- Rojo (#ef4444)

#### **Página 4: Gráficas de Humedad y CO2**
- Gráfica de humedad relativa (Azul #3b82f6)
- Gráfica de concentración de CO2 (Verde #10b981)
- Ambas en una sola página

### 4. **Características Incluidas**

✅ **Métricas Visuales**
- Mínimos y máximos de cada parámetro
- Promedios calculados automáticamente

✅ **Gráficas Interactivas Capturadas**
- Usan los mismos datos del dashboard
- Resolución alta (escala 2x)
- Fondo blanco para mejor impresión

✅ **Análisis Automático**
- Detecta desbalances térmicos
- Identifica condiciones de riesgo
- Proporciona recomendaciones de acción

✅ **Formato Profesional**
- Encabezado de portada con branding
- Paginación automática
- Pie de página en todas las páginas
- Línea divisoria con color corporativo (azul #2196F3)

### 5. **Proceso de Generación Mejorado**

```typescript
1. Usuario abre el modal de reporte
2. Selecciona el dispositivo
3. Presiona "Generar reporte"
4. Sistema renderiza gráficas ocultas
5. html2canvas captura cada gráfica
6. jsPDF inserta gráficas en páginas correspondientes
7. Añade análisis de texto
8. Descarga PDF automáticamente
```

## Uso

1. En cualquier página del dashboard, busca el botón "Generar reporte"
2. Selecciona el dispositivo del cual quieres el reporte
3. Haz clic en "Generar reporte"
4. El PDF se descargará automáticamente con el nombre:
   - `reporte_[nombre_dispositivo]_[fecha-hora].pdf`

## Ejemplo de Nombre de Archivo
```
reporte_Invernadero_1_2026-03-16-15-30-45.pdf
```

## ventajas

- 📊 **Visualización clara** de datos con gráficas
- 📋 **Múltiples páginas** organizadas por tema
- 🎨 **Diseño profesional** y limpio
- 📈 **Análisis automático** de condiciones
- 👥 **Fácil de compartir** entre usuarios
- 🖨️ **Optimizado para impresión**

## Archivos Modificados

- [ReportModal.tsx](src/components/ReportModal.tsx) - Componente principal del modal de reporte

## Dependencias Añadidas

- `html2canvas@^1.4.1` - Para capturar las gráficas Recharts como imágenes
