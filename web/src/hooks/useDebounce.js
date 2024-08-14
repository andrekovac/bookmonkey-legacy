import { useCallback, useRef } from 'react';

// Returns a function that calls fn only after `delay` ms without another call.
//   const debouncedSearch = useDebounce(search, 300);
//   <input onChange={e => debouncedSearch(e.target.value)} />
export default function useDebounce(fn, delay) {
  const timer = useRef(null);
  return useCallback(
    function (...args) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(function () {
        timer.current = null;
        fn(...args);
      }, delay);
    },
    [fn, delay]
  );
}
