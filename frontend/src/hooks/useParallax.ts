import { useEffect, useRef } from 'react';

/**
 * Subtle cursor-responsive parallax. Writes `--mx` / `--my` custom
 * properties (in px) on the returned ref's element; children can then
 * apply `translate(calc(var(--mx) * n), calc(var(--my) * n))`.
 * Disabled on coarse pointers and for reduced-motion users.
 */
export function useParallax<T extends HTMLElement>(xScale = 16, yScale = 12) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let raf = 0;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty('--mx', `${(x * xScale).toFixed(2)}px`);
        el.style.setProperty('--my', `${(y * yScale).toFixed(2)}px`);
      });
    };
    el.addEventListener('pointermove', onMove);
    return () => {
      el.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
    };
  }, [xScale, yScale]);

  return ref;
}
