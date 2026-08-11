import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './IconButton.css';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'ghost' | 'solid' | 'accent';
  active?: boolean;
}

export function IconButton({
  label,
  children,
  size = 'md',
  variant = 'ghost',
  active = false,
  className = '',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`icon-btn icon-btn--${size} icon-btn--${variant} ${active ? 'is-active' : ''} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
