import { Droplets } from 'lucide-react';

import { cx } from '../utils/cx.js';
import { DEW_POINT_ZONES, formatTemp, fToC } from '../utils/wardrobeLogic.js';

// The gauge spans 30–80°F, which puts the zone boundaries at 50%, 70%, and 80%.
const SCALE_MIN_F = 30;
const SCALE_MAX_F = 80;

const ZONE_COLORS = {
  crisp: 'bg-sky-400',
  comfortable: 'bg-emerald-400',
  sticky: 'bg-amber-400',
  tropical: 'bg-rose-500',
};

const clampToScale = (tempF) => Math.min(Math.max(tempF, SCALE_MIN_F), SCALE_MAX_F);
const toPercent = (tempF) => ((clampToScale(tempF) - SCALE_MIN_F) / (SCALE_MAX_F - SCALE_MIN_F)) * 100;
const degrees = (tempF, unit) => Math.round(unit === 'C' ? fToC(tempF) : tempF);

function rangeLabel({ minF, maxF }, unit) {
  if (minF === -Infinity) return `Below ${formatTemp(maxF, unit)}`;
  if (maxF === Infinity) return `${formatTemp(minF, unit)} and up`;
  return `${degrees(minF, unit)}–${formatTemp(maxF - 1, unit)}`;
}

export default function DewPointBar({ dewPointF, zone, unit }) {
  const reading = formatTemp(dewPointF, unit);

  return (
    <section
      aria-labelledby="muggy-heading"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2
            id="muggy-heading"
            className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400"
          >
            <Droplets className="size-3.5" aria-hidden="true" />
            Muggy Meter
          </h2>
          <p className="mt-1.5 text-xl font-semibold tracking-tight">{zone.label}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-slate-500 dark:text-slate-400">Dew point</p>
          <p className="text-2xl font-bold tabular-nums">{reading}</p>
        </div>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-pretty text-slate-600 dark:text-slate-400">
        {zone.description}
        {zone.advice && <strong className="font-semibold text-slate-900 dark:text-white"> {zone.advice}</strong>}
      </p>

      <div
        role="meter"
        aria-label="Dew point comfort"
        aria-valuemin={degrees(SCALE_MIN_F, unit)}
        aria-valuemax={degrees(SCALE_MAX_F, unit)}
        aria-valuenow={degrees(clampToScale(dewPointF), unit)}
        aria-valuetext={`${reading}, ${zone.label}`}
        className="mt-6"
      >
        <div className="relative">
          <div className="flex h-3 gap-0.5 overflow-hidden rounded-full">
            {DEW_POINT_ZONES.map((band) => (
              <div
                key={band.id}
                className={cx(
                  'basis-0 transition-opacity duration-500',
                  ZONE_COLORS[band.id],
                  band.id !== zone.id && 'opacity-30',
                )}
                style={{ flexGrow: toPercent(band.maxF) - toPercent(band.minF) }}
              />
            ))}
          </div>
          <div
            className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-slate-900 shadow-md transition-[left] duration-500 dark:border-slate-900 dark:bg-white"
            style={{ left: `${toPercent(Math.round(dewPointF))}%` }}
          />
        </div>
        <div className="relative mt-2 hidden h-4 text-[11px] text-slate-400 tabular-nums sm:block" aria-hidden="true">
          {DEW_POINT_ZONES.slice(1).map((band) => (
            <span key={band.id} className="absolute -translate-x-1/2" style={{ left: `${toPercent(band.minF)}%` }}>
              {formatTemp(band.minF, unit)}
            </span>
          ))}
        </div>
      </div>

      <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {DEW_POINT_ZONES.map((band) => {
          const active = band.id === zone.id;
          return (
            <li
              key={band.id}
              aria-current={active ? 'true' : undefined}
              className={cx(
                'rounded-xl px-3 py-2',
                active ? 'bg-slate-100 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700' : 'opacity-60',
              )}
            >
              <span className="flex items-center gap-1.5 text-xs font-semibold">
                <span className={cx('size-2 shrink-0 rounded-full', ZONE_COLORS[band.id])} aria-hidden="true" />
                {band.label}
              </span>
              <span className="mt-0.5 block text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                {rangeLabel(band, unit)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
