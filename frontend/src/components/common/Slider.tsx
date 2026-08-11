import { useCallback, useRef } from 'react';
import './Slider.css';

interface SliderProps {
  /** 0..1 fraction */
  value: number;
  onChange: (fraction: number) => void;
  label: string;
  className?: string;
}

/**
 * A minimal, accessible slider (pointer drag + arrow keys).
 * `value` is a 0..1 fraction; the consumer maps it to seconds / volume.
 */
export function Slider({ value, onChange, label, className = '' }: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const fractionFromEvent = useCallback((clientX: number): number => {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return 0;
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  }, []);

  const apply = useCallback(
    (clientX: number) => onChange(fractionFromEvent(clientX)),
    [fractionFromEvent, onChange],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    apply(e.clientX);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (dragging.current) apply(e.clientX);
  };

  const endDrag = () => {
    dragging.current = false;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 0.1 : 0.02;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      onChange(Math.min(1, value + step));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      onChange(Math.max(0, value - step));
    } else if (e.key === 'Home') {
      e.preventDefault();
      onChange(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      onChange(1);
    }
  };

  const pct = Math.min(1, Math.max(0, value)) * 100;

  return (
    <div
      ref={trackRef}
      className={`slider ${className}`}
      role="slider"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
    >
      <div className="slider__track">
        <div className="slider__fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="slider__thumb" style={{ left: `${pct}%` }} aria-hidden="true" />
    </div>
  );
}
