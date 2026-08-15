import { useEffect } from 'react';
import { usePlayer } from '../state/PlayerContext';

/* ============================================================
   Player keyboard shortcuts (global).

   Space → play / pause
   ← / → → seek back / forward 10s
   N / P → next / previous

   Shortcuts only fire when the user isn't typing or operating a
   control — never inside inputs, textareas, contenteditable
   surfaces, or while a slider/button owns focus.
   ============================================================ */

const SEEK_STEP = 10;

/** typing surfaces are never hijacked */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/** global shortcuts only when focus sits on neutral page chrome */
function isNeutralTarget(target: EventTarget | null): boolean {
  if (target === document.body || target === document.documentElement) return true;
  if (target instanceof HTMLElement) {
    return !target.closest(
      'input, textarea, select, [contenteditable="true"], [role="slider"], [role="textbox"], a',
    );
  }
  return false;
}

export function useKeyboardShortcuts(): void {
  const { current, elapsed, toggle, next, prev, seek } = usePlayer();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      if (!isNeutralTarget(e.target)) return;
      if (!current) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          toggle();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seek(Math.max(0, elapsed - SEEK_STEP));
          break;
        case 'ArrowRight':
          e.preventDefault();
          seek(Math.min(current.duration, elapsed + SEEK_STEP));
          break;
        case 'KeyN':
          e.preventDefault();
          next();
          break;
        case 'KeyP':
          e.preventDefault();
          prev();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, elapsed, toggle, next, prev, seek]);
}
