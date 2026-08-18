# IoT Monitoreo de Ambientes Agrícolas

Aplicación web para la monitorización y gestión de variables ambientales en cultivos mediante sensores IoT. El sistema permite visualizar datos de temperatura, humedad, CO₂, alertas y ubicaciones de dispositivos, con una interfaz pensada para administrativos y usuarios operativos del cultivo.

## Descripción del proyecto

Este proyecto consiste en un dashboard web desarrollado con React + TypeScript + Vite, conectado a Firebase para autenticación y almacenamiento de información. Está orientado a facilitar la supervisión en tiempo real de condiciones críticas en ambientes agrícolas y apoyar la toma de decisiones sobre riego, ventilación, clima y manejo del cultivo.

### Funcionalidades principales

- Dashboard principal con métricas resumidas
- Visualización de datos por variable:
  - Temperatura
  - Humedad
  - CO₂
  - Alertas
- Mapa de dispositivos o ubicaciones
- Registro de eventos del sistema
- Gestión de dispositivos
- Autenticación con Firebase
- Generación de reportes PDF
- Diseño responsivo con Tailwind CSS
- Navegación protegida por roles y autenticación

## Stack tecnológico

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Firebase Authentication
- Firestore
- Recharts
- Chart.js
- html2canvas + jsPDF
- React Router DOM

## Estructura del proyecto

```bash
.
├── backend/                 # Lógica o servicios del backend
├── public/                  # Archivos públicos estáticos
├── src/
│   ├── components/          # Componentes reutilizables
│   ├── contexts/            # Contextos de autenticación y estado global
│   ├── hooks/               # Hooks personalizados
│   ├── pages/               # Páginas principales de la app
│   ├── services/            # Servicios de conexión
│   ├── utils/               # Utilidades y datos mock
│   ├── App.tsx              # Componente raíz
│   ├── AppRouter.tsx        # Definición de rutas
│   ├── firebase.ts          # Inicialización de Firebase
│   ├── index.css            # Estilos globales
│   └── index.tsx            # Punto de entrada
├── .env                     # Variables de entorno locales (no subir a Git)
├── .firebaserc              # Configuración de Firebase
├── firebase.json            # Configuración de despliegue Firebase
├── package.json             # Dependencias y scripts
├── tailwind.config.js       # Configuración de Tailwind
├── tsconfig.json            # Configuración de TypeScript
├── vite.config.ts           # Configuración de Vite
├── MANUAL_DE_USUARIO.pdf    # Manual del sistema
├── CAMBIOS_REPORTE_PDF.md   # Documentación de cambios o reportes
└── README.md
```

## Requisitos previos

Antes de ejecutar el proyecto asegúrate de tener instalado:

- Node.js 18 o superior
- npm
- Cuenta de Firebase configurada

## Instalación

1. Clona el repositorio:

```bash
git clone https://github.com/Jorge-romero10/Iot_monitoreo_ambientes_agricolas.git
cd IoT_monitoreo_ambientes_agricolas
```

2. Instala dependencias:

```bash
npm install
```

3. Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

```bash
VITE_FIREBASE_API_KEY=tu_api_key
VITE_FIREBASE_AUTH_DOMAIN=tu_auth_domain
VITE_FIREBASE_PROJECT_ID=tu_project_id
VITE_FIREBASE_STORAGE_BUCKET=tu_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=tu_sender_id
VITE_FIREBASE_APP_ID=tu_app_id
```

> Estas credenciales deben corresponder a tu proyecto en Firebase. El archivo `.env` no debe subirse al repositorio.

## Ejecución local

Inicia el servidor de desarrollo:

```bash
npm run dev
```

Luego abre la URL que te indique Vite, normalmente:

```bash
http://localhost:5173
```

## Compilación para producción

```bash
npm run build
```

La carpeta `dist/` será generada para desplegar la aplicación.

## Lint

```bash
npm run lint
```

## Despliegue

El proyecto incluye configuración para Firebase, por lo que puede desplegarse con:

```bash
firebase deploy
```

Asegúrate de haber iniciado sesión en Firebase CLI y de tener tu proyecto configurado correctamente.

## Variables de entorno

El proyecto utiliza variables de entorno para conectar la app con Firebase. Si no existen o no están configuradas, la aplicación podría usar valores por defecto incompletos o fallar al iniciar sesión y consultar datos.

## Seguridad

- No subas archivos sensibles como `.env`, credenciales de Firebase o claves privadas.
- El proyecto ya incluye protección con `.gitignore` para evitar publicar información sensible.

## Contribución

Las contribuciones son bienvenidas. Si deseas colaborar:

1. Haz un fork del proyecto
2. Crea una rama para tu cambio
3. Realiza tus modificaciones
4. Abre un pull request describiendo el cambio

## Licencia

Este proyecto se distribuye bajo fines académicos o de desarrollo interno. Revisa la licencia del repositorio si aplica un uso comercial o institucional.

## Contacto

Proyecto desarrollado para monitorización de ambientes agrícolas con enfoque IoT y visualización de datos. Si deseas más información o colaboración, puedes contactar con el responsable del repositorio.

## Documentación adicional

- [MANUAL_DE_USUARIO.pdf](MANUAL_DE_USUARIO.pdf)
- [CAMBIOS_REPORTE_PDF.md](CAMBIOS_REPORTE_PDF.md)
