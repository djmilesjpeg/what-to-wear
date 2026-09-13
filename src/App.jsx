import { Flame, Snowflake, Umbrella } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import DewPointBar from './components/DewPointBar.jsx';
import LocationSearch from './components/LocationSearch.jsx';
import OutfitGrid from './components/OutfitGrid.jsx';
import SegmentedControl from './components/SegmentedControl.jsx';
import { ErrorState, LoadingState, LocationPrompt } from './components/StatusStates.jsx';
import VerdictBanner from './components/VerdictBanner.jsx';
import { useGeolocation } from './hooks/useGeolocation.js';
import { useLocalStorage } from './hooks/useLocalStorage.js';
import { useWeather } from './hooks/useWeather.js';
import { evaluateOutfit, formatTemp, formatTempShift, TOLERANCES } from './utils/wardrobeLogic.js';

const APP_NAME = 'What to Wear Right Now';

// Regions that think in °F. Everyone else starts in °C; either way it's one tap to switch.
const FAHRENHEIT_REGIONS = new Set(['US', 'PR', 'GU', 'VI', 'AS', 'MP', 'BS', 'BZ', 'KY', 'PW', 'FM', 'MH', 'LR']);

function guessUnit() {
  try {
    return FAHRENHEIT_REGIONS.has(new Intl.Locale(navigator.language).maximize().region) ? 'F' : 'C';
  } catch {
    return 'F';
  }
}

const isUnit = (value) => value === 'F' || value === 'C';
const isTolerance = (value) => typeof value === 'string' && Object.hasOwn(TOLERANCES, value);
const isLocation = (value) =>
  value === null ||
  (typeof value?.name === 'string' && Number.isFinite(value.latitude) && Number.isFinite(value.longitude));

const UNIT_OPTIONS = [
  { value: 'F', label: '°F', title: 'Fahrenheit' },
  { value: 'C', label: '°C', title: 'Celsius' },
];

const TOLERANCE_ICONS = { cold: Snowflake, warm: Flame };

export default function App() {
  const [location, setLocation] = useLocalStorage('wtw:location', null, isLocation);
  const [unit, setUnit] = useLocalStorage('wtw:unit', guessUnit, isUnit);
  const [tolerance, setTolerance] = useLocalStorage('wtw:tolerance', 'normal', isTolerance);
  const { status: geoStatus, locate, reset: resetGeo } = useGeolocation();
  const weather = useWeather(location?.latitude, location?.longitude);

  const outfit = useMemo(
    () => (weather.data ? evaluateOutfit(weather.data, { tolerance, unit }) : null),
    [weather.data, tolerance, unit],
  );

  const locateMe = useCallback(async () => {
    const coords = await locate();
    if (!coords) return;
    setLocation((previous) =>
      previous?.source === 'geo' && previous.latitude === coords.latitude && previous.longitude === coords.longitude
        ? previous
        : { name: 'Current location', source: 'geo', ...coords },
    );
  }, [locate, setLocation]);

  const selectPlace = useCallback(
    ({ name, region, latitude, longitude }) => {
      resetGeo(); // A hand-picked city makes any earlier "location blocked" notice moot.
      setLocation({ name, region, latitude, longitude, source: 'search' });
    },
    [resetGeo, setLocation],
  );

  // On load, find (or refresh) a GPS-based location, but respect a city someone picked by hand.
  const autoLocated = useRef(false);
  useEffect(() => {
    if (autoLocated.current) return;
    autoLocated.current = true;
    if (!location || location.source === 'geo') locateMe();
  }, [location, locateMe]);

  useEffect(() => {
    document.title =
      outfit && weather.data
        ? `${formatTemp(weather.data.feelsLikeF, unit)} · ${outfit.top.chip} + ${outfit.bottoms.chip} · ${APP_NAME}`
        : APP_NAME;
  }, [outfit, weather.data, unit]);

  const toleranceOptions = useMemo(
    () =>
      Object.entries(TOLERANCES).map(([value, { label, shiftF }]) => ({
        value,
        label,
        icon: TOLERANCE_ICONS[value],
        title:
          shiftF === 0
            ? 'Standard thresholds'
            : `${shiftF > 0 ? 'Warmer' : 'Lighter'} outfits: every temperature threshold ${formatTempShift(shiftF, unit)}`,
      })),
    [unit],
  );

  let content;
  if (!location) {
    content = <LocationPrompt geoStatus={geoStatus} onLocate={locateMe} />;
  } else if (!weather.data || !outfit) {
    content = weather.error ? <ErrorState message={weather.error} onRetry={weather.refresh} /> : <LoadingState />;
  } else {
    content = (
      <>
        <VerdictBanner
          location={location}
          conditions={weather.data}
          outfit={outfit}
          unit={unit}
          fetchedAt={weather.fetchedAt}
          loading={weather.loading}
          error={weather.error}
          onRefresh={weather.refresh}
        />
        <OutfitGrid outfit={outfit} hourly={weather.data.hourly} unit={unit} />
        <DewPointBar dewPointF={weather.data.dewPointF} zone={outfit.muggy} unit={unit} />
      </>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-sky-600 to-orange-600 text-white shadow-md">
            <Umbrella className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">{APP_NAME}</h1>
            <p className="text-sm text-pretty text-slate-600 dark:text-slate-400">
              Jacket, umbrella, shorts, or sweater? Decided by what it actually feels like outside.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
          <SegmentedControl label="Temperature unit" options={UNIT_OPTIONS} value={unit} onChange={setUnit} />
          <SegmentedControl
            label="Personal tolerance"
            options={toleranceOptions}
            value={tolerance}
            onChange={setTolerance}
          />
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-4 sm:gap-5">
        <LocationSearch
          onSelect={selectPlace}
          onLocate={locateMe}
          geoStatus={geoStatus}
          showGeoNotice={Boolean(location)}
        />
        {content}
      </main>

      <footer className="text-center text-xs text-slate-500 dark:text-slate-400">
        Weather data by{' '}
        <a
          href="https://open-meteo.com/"
          target="_blank"
          rel="noreferrer"
          className="font-medium underline underline-offset-2 hover:text-slate-900 dark:hover:text-white"
        >
          Open-Meteo.com
        </a>
        . The same thresholds power the morning Telegram alert.
      </footer>
    </div>
  );
}
