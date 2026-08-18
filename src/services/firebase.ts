import { db } from '../firebase';
import { collection, getDocs, orderBy, query, doc, setDoc, deleteDoc } from 'firebase/firestore';

export async function getHistoricalData(type: string) {
  const q = query(collection(db, type), orderBy('timestamp', 'asc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    ...doc.data(),
    timestamp: doc.data().timestamp?.seconds ? doc.data().timestamp.seconds * 1000 : Date.now(),
    value: doc.data().value
  }));
}

export type Device = {
  id: string;
  name: string;
};

/**
 * Obtiene la lista de dispositivos disponibles desde la colección metadata_devices
 */
export async function getAvailableDevices(): Promise<Device[]> {
  try {
    console.log('[Firebase] Consultando colección: metadata_devices')
    
    // Primero intentamos sin orderBy para evitar problemas de índices
    const q = query(collection(db, 'metadata_devices'))
    const querySnapshot = await getDocs(q)
    
    console.log(`[Firebase] Encontrados ${querySnapshot.docs.length} dispositivos`)
    
    if (querySnapshot.docs.length === 0) {
      console.warn('[Firebase] ⚠️ La colección metadata_devices está vacía o no existe')
      return []
    }
    
    const devices = querySnapshot.docs.map(doc => {
      const data = doc.data()
      console.log(`[Firebase] Documento ${doc.id}:`, data)
      
      const device = { 
        id: doc.id, 
        name: data.name || doc.id 
      }
      console.log(`[Firebase] Dispositivo procesado: ${device.id} -> ${device.name}`)
      return device
    })
    
    // Ordenar por nombre en JavaScript si es necesario
    devices.sort((a, b) => a.name.localeCompare(b.name))
    
    return devices
  } catch (error) {
    console.error('[Firebase] ❌ Error obteniendo dispositivos:', error)
    if (error instanceof Error) {
      console.error('[Firebase] Mensaje de error:', error.message)
      console.error('[Firebase] Stack:', error.stack)
    }
    return []
  }
}

/**
 * Obtiene dispositivos sin registrar (que existen en devices/ pero no en metadata_devices)
 */
export async function getUnregisteredDevices(): Promise<Device[]> {
  try {
    console.log('[Firebase] Buscando dispositivos sin registrar...')
    
    // Obtener todos los dispositivos registrados
    const registeredDevices = await getAvailableDevices()
    const registeredIds = new Set(registeredDevices.map(d => d.id))
    
    // Obtener todos los documentos en la raíz de /devices
    const devicesRef = collection(db, 'devices')
    const allDocsSnapshot = await getDocs(devicesRef)
    
    const unregistered: Device[] = []
    
    for (const docSnap of allDocsSnapshot.docs) {
      const deviceId = docSnap.id
      // Si no está en metadata_devices pero tiene datos, lo agregamos
      if (!registeredIds.has(deviceId)) {
        unregistered.push({
          id: deviceId,
          name: deviceId // Nombre por defecto es el ID
        })
      }
    }
    
    console.log(`[Firebase] Encontrados ${unregistered.length} dispositivos sin registrar`)
    return unregistered
  } catch (error) {
    console.error('[Firebase] ❌ Error buscando dispositivos sin registrar:', error)
    return []
  }
}

/**
 * Registra un nuevo dispositivo en metadata_devices
 */
export async function registerDevice(deviceId: string, deviceName: string): Promise<boolean> {
  try {
    console.log(`[Firebase] Registrando dispositivo: ${deviceId} con nombre: ${deviceName}`)
    
    const docRef = doc(db, 'metadata_devices', deviceId)
    await setDoc(docRef, {
      id: deviceId,
      name: deviceName,
      createdAt: new Date().toISOString(),
      status: 'active'
    })
    
    console.log(`[Firebase] ✅ Dispositivo registrado: ${deviceId}`)
    return true
  } catch (error) {
    console.error('[Firebase] ❌ Error registrando dispositivo:', error)
    return false
  }
}

/**
 * Actualiza el nombre de un dispositivo en metadata_devices
 */
export async function updateDeviceName(deviceId: string, newName: string): Promise<boolean> {
  try {
    const docRef = doc(db, 'metadata_devices', deviceId)
    await setDoc(docRef, {
      name: newName
    }, { merge: true })
    console.log(`[Firebase] Nombre actualizado para ${deviceId}: ${newName}`)
    return true
  } catch (error) {
    console.error('[Firebase] ❌ Error actualizando nombre:', error)
    return false
  }
}

/**
 * Elimina el dispositivo de la colección metadata_devices.
 * No borra los datos de telemetría en /devices/{id}.
 */
export async function deleteDevice(deviceId: string): Promise<boolean> {
  try {
    const docRef = doc(db, 'metadata_devices', deviceId)
    await deleteDoc(docRef)
    console.log(`[Firebase] Dispositivo eliminado: ${deviceId}`)
    return true
  } catch (error) {
    console.error('[Firebase] ❌ Error eliminando dispositivo:', error)
    return false
  }
}
