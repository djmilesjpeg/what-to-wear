import { LoaderCircle, LocateFixed, MapPin, Search, X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';

import { useDebouncedValue } from '../hooks/useDebouncedValue.js';
import { cx } from '../utils/cx.js';
import { searchPlaces } from '../utils/openMeteo.js';

const GEO_NOTICES = {
  denied: 'Location access is blocked for this site, so search for a city instead.',
  unavailable: "Couldn't pin down your location. Try again, or search for a city.",
  unsupported: "This browser can't share your location, so search for a city instead.",
};

export default function LocationSearch({ onSelect, onLocate, geoStatus, showGeoNotice }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [search, setSearch] = useState({ query: '', status: 'idle', results: [] });
  const debouncedQuery = useDebouncedValue(query.trim(), 300);
  const listboxId = useId();

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setSearch({ query: debouncedQuery, status: 'idle', results: [] });
      return undefined;
    }
    const controller = new AbortController();
    setSearch((previous) => ({ ...previous, status: 'loading' }));
    searchPlaces(debouncedQuery, { signal: controller.signal })
      .then((results) => {
        setSearch({ query: debouncedQuery, status: 'done', results });
        setActiveIndex(results.length > 0 ? 0 : -1);
      })
      .catch(() => {
        if (!controller.signal.aborted) setSearch({ query: debouncedQuery, status: 'error', results: [] });
      });
    return () => controller.abort();
  }, [debouncedQuery]);

  const trimmed = query.trim();
  const { results } = search;
  const settled = search.query === trimmed && search.status !== 'loading';
  const panelOpen = open && trimmed.length >= 2;
  const listOpen = panelOpen && results.length > 0;

  let notice = null;
  if (panelOpen && !listOpen) {
    if (!settled) notice = 'Searching…';
    else if (search.status === 'error') notice = 'City search is unavailable right now. Try again in a moment.';
    else notice = `No places match “${trimmed}”.`;
  }

  function choose(place) {
    onSelect(place);
    setQuery('');
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(event) {
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && results.length > 0) {
      event.preventDefault();
      const forward = event.key === 'ArrowDown';
      const last = results.length - 1;
      setOpen(true);
      setActiveIndex((index) => (forward ? (index >= last ? 0 : index + 1) : index <= 0 ? last : index - 1));
    } else if (event.key === 'Enter' && listOpen && results[activeIndex]) {
      event.preventDefault();
      choose(results[activeIndex]);
    } else if (event.key === 'Escape') {
      if (panelOpen) setOpen(false);
      else setQuery('');
    }
  }

  const locating = geoStatus === 'locating';

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="text"
            inputMode="search"
            enterKeyHint="search"
            role="combobox"
            aria-label="Search for a city"
            aria-autocomplete="list"
            aria-expanded={listOpen}
            aria-controls={listboxId}
            aria-activedescendant={listOpen && activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
            autoComplete="off"
            spellCheck={false}
            placeholder="Search for a city…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={handleKeyDown}
            className="h-12 w-full rounded-full border border-slate-200 bg-white pr-11 pl-11 text-base shadow-sm outline-hidden transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/15 sm:text-sm dark:border-slate-800 dark:bg-slate-900 dark:placeholder:text-slate-500 dark:focus:border-sky-400"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setQuery('')}
              className="absolute top-1/2 right-2.5 grid size-8 -translate-y-1/2 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onLocate}
          disabled={locating}
          className="inline-flex h-12 shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium shadow-sm transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 disabled:cursor-wait disabled:opacity-70 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
        >
          {locating ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <LocateFixed className="size-4" aria-hidden="true" />
          )}
          <span className="sr-only sm:not-sr-only">Use my location</span>
        </button>
      </div>

      {panelOpen && (
        <div
          className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-900"
          onMouseDown={(event) => event.preventDefault()}
        >
          {listOpen ? (
            <ul
              id={listboxId}
              role="listbox"
              aria-label="Matching places"
              className={cx('py-1 transition-opacity', !settled && 'opacity-60')}
            >
              {results.map((place, index) => (
                <li
                  key={place.id}
                  id={`${listboxId}-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  onClick={() => choose(place)}
                  onMouseMove={() => setActiveIndex(index)}
                  className={cx(
                    'flex cursor-pointer items-center gap-3 px-4 py-2.5',
                    index === activeIndex && 'bg-sky-50 dark:bg-slate-800',
                  )}
                >
                  <MapPin className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{place.name}</span>
                    {place.region && (
                      <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{place.region}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p role="status" className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
              {notice}
            </p>
          )}
        </div>
      )}

      {showGeoNotice && GEO_NOTICES[geoStatus] && (
        <p role="status" className="mt-2 px-4 text-xs text-slate-500 dark:text-slate-400">
          {GEO_NOTICES[geoStatus]}
        </p>
      )}
    </div>
  );
}
