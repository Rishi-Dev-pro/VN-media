import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import { Field } from './Field';

interface PasswordFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  valid?: boolean;
  /** accessible labels for the visibility toggle (e.g. confirm field) */
  showLabel?: string;
  hideLabel?: string;
}

export function PasswordField({
  id,
  label,
  value,
  onChange,
  error,
  valid,
  showLabel = 'Show password',
  hideLabel = 'Hide password',
  ...rest
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <Field
      id={id}
      label={label}
      type={visible ? 'text' : 'password'}
      value={value}
      onChange={onChange}
      error={error}
      valid={valid}
      trailing={
        <button
          type="button"
          className="field__toggle"
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      }
      {...rest}
    />
  );
}
