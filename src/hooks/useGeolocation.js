import { useCallback, useState } from 'react';

// Two decimals is about 1 km: plenty for weather, and kinder to privacy.
const roundCoordinate = (value) => Math.round(value * 100) / 100;

/**
 * Browser geolocation as a promise. `locate()` resolves to { latitude, longitude } or null.
 * status: 'idle' | 'locating' | 'denied' | 'unavailable' | 'unsupported'
 */
export function useGeolocation() {
  const [status, setStatus] = useState('idle');

  const locate = useCallback(
    () =>
      new Promise((resolve) => {
        if (!('geolocation' in navigator)) {
          setStatus('unsupported');
          resolve(null);
          return;
        }
        setStatus('locating');
        navigator.geolocation.getCurrentPosition(
          ({ coords }) => {
            setStatus('idle');
            resolve({ latitude: roundCoordinate(coords.latitude), longitude: roundCoordinate(coords.longitude) });
          },
          (error) => {
            setStatus(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable');
            resolve(null);
          },
          { enableHighAccuracy: false, timeout: 15_000, maximumAge: 10 * 60_000 },
        );
      }),
    [],
  );

  const reset = useCallback(() => setStatus('idle'), []);

  return { status, locate, reset };
}
