import { LoaderCircle, MapPin, RefreshCw, TriangleAlert } from 'lucide-react';

const GEO_HELP = {
  denied:
    'Location access is blocked for this site. Search for a city above, or allow location access in your browser and try again.',
  unavailable: "We couldn't pin down your location. Search for a city above, or try again.",
  unsupported: "This browser can't share your location. Search for a city above.",
};

export function LocationPrompt({ geoStatus, onLocate }) {
  const failed = Object.hasOwn(GEO_HELP, geoStatus);

  return (
    <section
      aria-live="polite"
      className="rounded-3xl border border-dashed border-slate-300 bg-white/70 px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900/60"
    >
      {failed ? (
        <MapPin className="mx-auto size-8 text-slate-400" aria-hidden="true" />
      ) : (
        <LoaderCircle className="mx-auto size-8 animate-spin text-sky-600" aria-hidden="true" />
      )}
      <h2 className="mt-4 text-lg font-semibold">{failed ? 'Where are you right now?' : 'Finding your location…'}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-pretty text-slate-600 dark:text-slate-400">
        {failed ? GEO_HELP[geoStatus] : 'Allow location access when your browser asks, or search for a city above.'}
      </p>
      {failed && geoStatus !== 'unsupported' && (
        <button
          type="button"
          onClick={onLocate}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
        >
          <MapPin className="size-4" aria-hidden="true" />
          Try my location again
        </button>
      )}
    </section>
  );
}

export function LoadingState() {
  return (
    <div className="flex flex-col gap-4 sm:gap-5" aria-busy="true">
      <p role="status" className="sr-only">
        Loading the forecast…
      </p>
      <div className="h-72 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800" />
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="h-44 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
        ))}
      </div>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <section
      role="alert"
      className="flex items-start gap-3 rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-100"
    >
      <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div>
        <h2 className="font-semibold">Couldn't load the forecast</h2>
        <p className="mt-1 text-sm text-rose-800 dark:text-rose-200">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          Try again
        </button>
      </div>
    </section>
  );
}
