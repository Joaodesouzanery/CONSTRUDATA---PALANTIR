import { useState, useEffect } from 'react'

/**
 * Reactive hook that tracks a CSS media query match.
 * Updates when viewport changes (resize, orientation).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  )

  useEffect(() => {
    const mql = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])

  return matches
}

/** True when viewport is < 768px (Tailwind `md` breakpoint). */
export function useIsMobile() {
  return useMediaQuery('(max-width: 767px)')
}

/** True when viewport is < 640px (Tailwind `sm` breakpoint). */
export function useIsSmall() {
  return useMediaQuery('(max-width: 639px)')
}
