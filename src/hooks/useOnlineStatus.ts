import { useState, useEffect } from 'react'

/**
 * Hook para controlar cuándo mostrar el badge de online/offline.
 * Solo retorna true cuando Firestore ha traído datos reales (no localStorage).
 */
export function useFirestoreReady(hasDataPoints: boolean): boolean {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    // Solo marcar como ready cuando tengamos puntos de datos
    if (hasDataPoints && !isReady) {
      setIsReady(true)
    }

    // Resetear si perdemos datos
    if (!hasDataPoints && isReady) {
      setIsReady(false)
    }
  }, [hasDataPoints, isReady])

  return isReady
}
