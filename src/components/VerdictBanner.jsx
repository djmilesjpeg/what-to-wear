import { MapPin, RefreshCw, TriangleAlert } from 'lucide-react';

import { cx } from '../utils/cx.js';
import { formatTemp, formatTempShift, formatWind, TOLERANCES } from '../utils/wardrobeLogic.js';
import { getVisual } from './outfitVisuals.js';

// Every stop is dark enough for white text to stay readable.
const TONES = {
  hot: 'from-orange-700 via-red-700 to-rose-800',
  warm: 'from-amber-700 via-orange-700 to-orange-800',
  mild: 'from-teal-700 via-teal-700 to-emerald-800',
  cool: 'from-sky-700 via-sky-800 to-cyan-900',
  cold: 'from-indigo-700 via-indigo-800 to-blue-900',
};

const TONE_BY_TOP = { tshirt: 'warm', longsleeve: 'mild', sweater: 'cool', thermal: 'cold' };

// Reads the way you'd say it: "T-shirt, pants, no jacket, leave the umbrella."
const CHIP_ORDER = ['top', 'bottoms', 'outerwear', 'umbrella'];

const clock = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

function formatCoordinates(latitude, longitude) {
  const lat = `${Math.abs(latitude).toFixed(2)}°${latitude >= 0 ? 'N' : 'S'}`;
  const lon = `${Math.abs(longitude).toFixed(2)}°${longitude >= 0 ? 'E' : 'W'}`;
  return `${lat}, ${lon}`;
}

export default function VerdictBanner({ location, conditions, outfit, unit, fetchedAt, loading, error, onRefresh }) {
  const hot = outfit.top.id === 'tshirt' && Math.round(conditions.feelsLikeF) >= 85;
  const tone = hot ? 'hot' : TONE_BY_TOP[outfit.top.id];
  const detail =
    location.source === 'geo' ? formatCoordinates(location.latitude, location.longitude) : location.region;
  const { label: toleranceLabel, shiftF } = TOLERANCES[outfit.tolerance];

  return (
    <section
      aria-labelledby="verdict-heading"
      className={cx(
        'relative isolate overflow-hidden rounded-3xl bg-linear-to-br p-5 text-white shadow-xl shadow-slate-900/10 sm:p-7',
        TONES[tone],
      )}
    >
      <div aria-hidden="true" className="absolute -top-28 -right-20 -z-10 size-80 rounded-full bg-white/10 blur-3xl" />

      <div className="flex items-center justify-between gap-3">
        <p className="flex min-w-0 items-center gap-1.5 text-sm">
          <MapPin className="size-4 shrink-0" aria-hidden="true" />
          <span className="truncate">
            <span className="font-semibold">{location.name}</span>
            {detail && <span className="text-white/75"> · {detail}</span>}
          </span>
        </p>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium ring-1 ring-white/20 transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-default"
        >
          <RefreshCw className={cx('size-3.5', loading && 'animate-spin')} aria-hidden="true" />
          <span className="sr-only">Refresh forecast. </span>
          {loading ? 'Updating…' : `Updated ${clock.format(fetchedAt)}`}
        </button>
      </div>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
        <div>
          <h2 id="verdict-heading" className="text-xs font-semibold tracking-[0.2em] text-white/75 uppercase">
            Feels like
          </h2>
          <p className="mt-1 text-6xl leading-none font-bold tracking-tight tabular-nums sm:text-7xl">
            {formatTemp(conditions.feelsLikeF, unit)}
          </p>
        </div>
        <dl className="flex gap-6 text-sm">
          <Stat label="Actual" value={formatTemp(conditions.temperatureF, unit)} />
          <Stat label="Wind" value={formatWind(conditions.windMph, unit)} />
          {conditions.humidity != null && <Stat label="Humidity" value={`${conditions.humidity}%`} />}
        </dl>
      </div>

      <ul aria-label="Outfit verdict" className="mt-6 flex flex-wrap gap-2">
        {CHIP_ORDER.map((category) => {
          const result = outfit[category];
          const { Icon } = getVisual(category, result);
          const standOut = category === 'umbrella' && result.id === 'bring';
          return (
            <li
              key={category}
              className={cx(
                'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold',
                standOut ? 'bg-white text-blue-800 shadow-md' : 'bg-white/15 ring-1 ring-white/25',
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {result.chip}
            </li>
          );
        })}
      </ul>

      {(shiftF !== 0 || error) && (
        <div className="mt-5 space-y-1 text-xs text-white/80">
          {shiftF !== 0 && (
            <p>
              Tuned for someone who {toleranceLabel.toLowerCase()}: every temperature threshold{' '}
              {formatTempShift(shiftF, unit)}.
            </p>
          )}
          {error && (
            <p className="flex items-center gap-1.5" title={error}>
              <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
              Couldn't refresh just now, so this is the last successful update.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <dt className="text-white/70">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
