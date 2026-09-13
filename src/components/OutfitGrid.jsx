import { cx } from '../utils/cx.js';
import { formatHour, THRESHOLDS } from '../utils/wardrobeLogic.js';
import { getVisual, TONE_CLASSES } from './outfitVisuals.js';

const CARDS = [
  { category: 'top', title: 'Top' },
  { category: 'outerwear', title: 'Outerwear' },
  { category: 'bottoms', title: 'Bottoms' },
  { category: 'umbrella', title: 'Umbrella' },
];

export default function OutfitGrid({ outfit, hourly, unit }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {CARDS.map(({ category, title }) => {
        const result = outfit[category];
        return (
          <OutfitCard key={category} title={title} result={result} {...getVisual(category, result)}>
            {category === 'umbrella' && <RainOutlook hourly={hourly} unit={unit} />}
          </OutfitCard>
        );
      })}
    </div>
  );
}

function OutfitCard({ title, result, Icon, tone, children }) {
  return (
    <article className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">{title}</h2>
          <p className="mt-1.5 text-xl font-semibold tracking-tight text-balance">{result.label}</p>
        </div>
        <span className={cx('grid size-11 shrink-0 place-items-center rounded-2xl', TONE_CLASSES[tone])}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-pretty text-slate-600 dark:text-slate-400">{result.reason}</p>
      {children}
    </article>
  );
}

function RainOutlook({ hourly, unit }) {
  const hours = hourly.slice(0, THRESHOLDS.rainWindowHours);
  if (hours.length === 0) return null;
  const cutoff = THRESHOLDS.umbrellaRainChance;

  return (
    <div className="mt-auto pt-5">
      <ol className="grid grid-cols-4 gap-2">
        {hours.map((hour, index) => {
          const chance = hour.precipitationProbability;
          const known = Number.isFinite(chance);
          const likely = known && chance >= cutoff;
          const when = index === 0 ? 'Now' : formatHour(hour.time, unit);
          return (
            <li key={hour.time} className="flex flex-col items-center gap-1.5">
              <span className="sr-only">
                {when}: {known ? `${chance}% chance of rain` : 'rain chance unavailable'}
              </span>
              <span
                aria-hidden="true"
                className={cx(
                  'text-xs font-semibold tabular-nums',
                  likely ? 'text-blue-700 dark:text-blue-300' : 'text-slate-600 dark:text-slate-400',
                )}
              >
                {known ? `${chance}%` : '–'}
              </span>
              <span
                aria-hidden="true"
                className="relative h-14 w-full overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800"
              >
                <span
                  className={cx(
                    'absolute inset-x-0 bottom-0 transition-[height] duration-500',
                    likely ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600',
                  )}
                  style={{ height: `${known && chance > 0 ? Math.max(chance, 4) : 0}%` }}
                />
                <span
                  className="absolute inset-x-0 border-t border-dashed border-blue-500/60"
                  style={{ bottom: `${cutoff}%` }}
                />
              </span>
              <span aria-hidden="true" className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {when}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
        Rain chance by hour. The dashed line marks the {cutoff}% umbrella cutoff.
      </p>
    </div>
  );
}
