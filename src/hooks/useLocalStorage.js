import { useEffect, useState } from 'react';

const resolve = (value) => (typeof value === 'function' ? value() : value);

/**
 * useState that persists as JSON in localStorage. Falls back to `initialValue` when nothing is
 * stored, the stored JSON is corrupt, or it fails `validate` (e.g. left over from an older version).
 */
export function useLocalStorage(key, initialValue, validate = () => true) {
  const [value, setValue] = useState(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        if (validate(parsed)) return parsed;
      }
    } catch {
      // Storage blocked or JSON corrupt: use the default.
    }
    return resolve(initialValue);
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage blocked or full: the preference just won't survive a reload.
    }
  }, [key, value]);

  return [value, setValue];
}
