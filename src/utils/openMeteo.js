/**
 * Open-Meteo client shared by the dashboard and the Telegram alert.
 * Only uses `fetch`, so it runs unchanged in browsers and Node 18+. No API key needed.
 */
import { cToF, kmhToMph } from './wardrobeLogic.js';

const FORECAST_ENDPOINT = 'https://api.open-meteo.com/v1/forecast';
const GEOCODING_ENDPOINT = 'https://geocoding-api.open-meteo.com/v1/search';

const CURRENT_FIELDS =
  'temperature_2m,apparent_temperature,dew_point_2m,relative_humidity_2m,precipitation,rain,wind_speed_10m';
const HOURLY_FIELDS = 'precipitation_probability,temperature_2m,dew_point_2m';

/** `timezone=auto` returns hourly timestamps in the location's local time ("rain peaks around 9 AM"). */
export function buildForecastUrl(latitude, longitude) {
  return (
    `${FORECAST_ENDPOINT}?latitude=${latitude}&longitude=${longitude}` +
    `&current=${CURRENT_FIELDS}&hourly=${HOURLY_FIELDS}&forecast_hours=4&timezone=auto`
  );
}

export function buildGeocodingUrl(query, count = 5) {
  return `${GEOCODING_ENDPOINT}?name=${encodeURIComponent(query)}&count=${count}`;
}

async function getJson(url, signal) {
  const response = await fetch(url, { signal });
  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    // Not JSON (e.g. a proxy error page); reported below.
  }
  if (!response.ok || !body || body.error) {
    const error = new Error(`Open-Meteo request failed: ${body?.reason ?? `HTTP ${response.status}`}`);
    error.status = response.status;
    throw error;
  }
  return body;
}

/**
 * Current conditions plus the current hour and next three, normalized to °F and mph.
 * @returns {Promise<import('./wardrobeLogic.js').Conditions & object>}
 */
export async function fetchForecast(latitude, longitude, { signal } = {}) {
  return parseForecast(await getJson(buildForecastUrl(latitude, longitude), signal));
}

/** Converts a raw (metric) Open-Meteo forecast response into the shape `evaluateOutfit` expects. */
export function parseForecast(data) {
  const { current, hourly } = data ?? {};
  const required = ['temperature_2m', 'apparent_temperature', 'dew_point_2m', 'wind_speed_10m'];
  if (!current || required.some((field) => !Number.isFinite(current[field]))) {
    throw new Error('Open-Meteo response is missing current conditions.');
  }
  const toF = (celsius) => (Number.isFinite(celsius) ? cToF(celsius) : null);

  return {
    time: current.time,
    timezone: data.timezone,
    temperatureF: cToF(current.temperature_2m),
    feelsLikeF: cToF(current.apparent_temperature),
    dewPointF: cToF(current.dew_point_2m),
    humidity: current.relative_humidity_2m ?? null,
    windMph: kmhToMph(current.wind_speed_10m),
    precipitationMm: current.precipitation ?? 0,
    rainMm: current.rain ?? 0,
    hourly: (hourly?.time ?? []).map((time, i) => ({
      time,
      precipitationProbability: hourly.precipitation_probability?.[i] ?? null,
      temperatureF: toF(hourly.temperature_2m?.[i]),
      dewPointF: toF(hourly.dew_point_2m?.[i]),
    })),
  };
}

/** Place search for the location picker. Open-Meteo needs at least 2 characters. */
export async function searchPlaces(query, { signal, count = 5 } = {}) {
  const name = query.trim();
  if (name.length < 2) return [];
  const data = await getJson(buildGeocodingUrl(name, count), signal);
  return (data.results ?? []).map((place) => ({
    id: place.id,
    name: place.name,
    region: [place.admin1, place.country].filter(Boolean).join(', '),
    latitude: place.latitude,
    longitude: place.longitude,
  }));
}
