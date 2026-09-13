import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchForecast } from '../utils/openMeteo.js';

// Open-Meteo updates current conditions every 15 minutes.
const REFRESH_AFTER_MS = 15 * 60_000;
const STALE_CHECK_MS = 60_000;

const IDLE = { key: null, data: null, error: null, loading: false, fetchedAt: null };

function describeError(error) {
  return error instanceof TypeError
    ? "Couldn't reach Open-Meteo. Check your connection and try again."
    : error.message || 'Something went wrong while loading the forecast.';
}

/**
 * Live conditions for a coordinate. Refetches when the coordinate changes and quietly refreshes
 * once the data is 15 minutes old (checked every minute and whenever the tab becomes visible).
 */
export function useWeather(latitude, longitude) {
  const key = Number.isFinite(latitude) && Number.isFinite(longitude) ? `${latitude},${longitude}` : null;
  const [state, setState] = useState(IDLE);
  const [refreshCount, setRefreshCount] = useState(0);
  const lastAttemptRef = useRef(0);

  const refresh = useCallback(() => setRefreshCount((count) => count + 1), []);

  useEffect(() => {
    if (!key) return undefined;
    const controller = new AbortController();
    lastAttemptRef.current = Date.now();
    // Keep showing the old data while refreshing the same place; clear it when the place changes.
    setState((previous) =>
      previous.key === key ? { ...previous, loading: true, error: null } : { ...IDLE, key, loading: true },
    );

    fetchForecast(latitude, longitude, { signal: controller.signal })
      .then((data) => setState({ key, data, error: null, loading: false, fetchedAt: Date.now() }))
      .catch((error) => {
        if (controller.signal.aborted) return;
        setState((previous) => ({ ...previous, loading: false, error: describeError(error) }));
      });

    return () => controller.abort();
    // `key` already encodes latitude and longitude.
  }, [key, refreshCount]);

  useEffect(() => {
    if (!key) return undefined;
    const refreshIfStale = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastAttemptRef.current >= REFRESH_AFTER_MS) {
        refresh();
      }
    };
    const timer = setInterval(refreshIfStale, STALE_CHECK_MS);
    document.addEventListener('visibilitychange', refreshIfStale);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshIfStale);
    };
  }, [key, refresh]);

  const current = state.key === key ? state : { ...IDLE, key, loading: Boolean(key) };
  return { data: current.data, error: current.error, loading: current.loading, fetchedAt: current.fetchedAt, refresh };
}
