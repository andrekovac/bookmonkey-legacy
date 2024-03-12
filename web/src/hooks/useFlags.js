import { useEffect, useState } from 'react';
import api from '../api/client';

// Feature flags from GET /api/v1/flags, loaded once per page load.
//   const flags = useFlags();
//   if (flags.ENABLE_REPORTS) ...
// While loading every flag is undefined (= off).
let cached = null;
let pending = null;

export function loadFlags() {
  if (cached) return Promise.resolve(cached);
  if (!pending) {
    pending = api.get('/flags')
      .then(data => {
        cached = data || {};
        return cached;
      })
      .catch(() => {
        // API down or old API without flags: everything off
        pending = null;
        return {};
      });
  }
  return pending;
}

// after a change in the admin
export function reloadFlags() {
  cached = null;
  pending = null;
  return loadFlags();
}

export default function useFlags() {
  const [flags, setFlags] = useState(cached || {});
  useEffect(() => {
    let alive = true;
    loadFlags().then(f => {
      if (alive) setFlags(f);
    });
    return () => {
      alive = false;
    };
  }, []);
  return flags;
}
