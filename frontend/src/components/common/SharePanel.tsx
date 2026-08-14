import { Check, Link2, UserRound } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import './SharePanel.css';

interface SharePanelProps {
  /** absolute URL is not available in mock — the app-relative profile route is shared */
  url: string;
  username: string;
  onClose: () => void;
}

/** Glass share popover: copy the profile link or the plain username.
 *  Clipboard writes are best-effort with a safe fallback; nothing
 *  private is ever copied. */
export function SharePanel({ url, username, onClose }: SharePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);
  const [copied, setCopied] = useState<'link' | 'username' | null>(null);

  useEffect(() => {
    const first = panelRef.current?.querySelector<HTMLButtonElement>('button');
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onDown = (e: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [onClose]);

  const copy = useCallback(async (value: string, kind: 'link' | 'username') => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // fallback when the clipboard API is unavailable
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch {
        /* mock-friendly: nothing to do */
      }
      document.body.removeChild(ta);
    }
    setCopied(kind);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setCopied(null), 1800);
  }, []);

  const items = [
    { kind: 'link' as const, label: 'COPY PROFILE LINK', value: url, toast: 'PROFILE LINK COPIED', icon: Link2 },
    { kind: 'username' as const, label: 'COPY USERNAME', value: `@${username}`, toast: 'USERNAME COPIED', icon: UserRound },
  ];

  return (
    <div className="share-panel" ref={panelRef} role="dialog" aria-label="Share profile">
      <p className="share-panel__title micro">Share this room</p>
      <div className="share-panel__list">
        {items.map(({ kind, label, value, toast, icon: Icon }) => (
          <button
            key={kind}
            type="button"
            className="share-panel__item"
            onClick={() => void copy(value, kind)}
          >
            <span className="share-panel__icon" aria-hidden="true">
              {copied === kind ? <Check size={14} /> : <Icon size={14} />}
            </span>
            <span className="share-panel__label">
              {copied === kind ? toast : label}
            </span>
          </button>
        ))}
      </div>
      <p className="share-panel__hint micro" aria-live="polite">
        {copied ? 'Copied to clipboard.' : 'Nothing private leaves this device.'}
      </p>
    </div>
  );
}
