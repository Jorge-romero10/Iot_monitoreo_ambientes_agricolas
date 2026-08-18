import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Configuración de Firebase (reemplaza con tu configuración)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCvjf5E1v5Z5e5Z5e5Z",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "iot-para-cultivos.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "iot-para-cultivos",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "iot-para-cultivos.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123456789:web:abcdef",
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Exportar instancias para usar en la app
export const db = getFirestore(app);
export const auth = getAuth(app);

export default app;
