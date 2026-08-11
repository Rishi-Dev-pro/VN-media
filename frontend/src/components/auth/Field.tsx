import type { InputHTMLAttributes, ReactNode } from 'react';

interface FieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  /** show a subtle "valid" tint (touched + no error + non-empty) */
  valid?: boolean;
  /** element rendered inside the input box (e.g. password toggle) */
  trailing?: ReactNode;
}

/** Shared text field used by the auth pages. */
export function Field({
  id,
  label,
  value,
  onChange,
  error,
  valid = false,
  trailing,
  className = '',
  ...rest
}: FieldProps) {
  const stateClass = error ? 'is-invalid' : valid ? 'is-valid' : '';
  return (
    <div className={`field ${stateClass} ${className}`}>
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <div className="field__box">
        <input
          id={id}
          className="field__input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          {...rest}
        />
        {trailing}
      </div>
      {error && (
        <p id={`${id}-error`} className="field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
