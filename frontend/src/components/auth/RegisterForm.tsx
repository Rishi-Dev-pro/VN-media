import { Check, CircleAlert } from 'lucide-react';
import { useState, type CSSProperties, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Field } from './Field';
import { PasswordField } from './PasswordField';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9._-]+$/;

const delay = (d: string) => ({ '--d': d } as CSSProperties);

/* ---------- password strength ---------- */

type Strength = 0 | 1 | 2 | 3;

function scorePassword(pw: string): Strength {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 6) score += 1;
  if (pw.length >= 10) score += 1;
  if (/[0-9]/.test(pw)) score += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  if (score >= 4) return 3;
  if (score >= 2) return 2;
  return 1;
}

const STRENGTH_LABEL: Record<Strength, string> = {
  0: '',
  1: 'Weak',
  2: 'Fair',
  3: 'Strong',
};

function StrengthMeter({ password }: { password: string }) {
  const level = scorePassword(password);
  if (level === 0) return null;

  return (
    <div className={`reg-strength reg-strength--${STRENGTH_LABEL[level].toLowerCase()}`}>
      <div className="reg-strength__track" aria-hidden="true">
        <span className={level >= 1 ? 'is-on' : ''} />
        <span className={level >= 2 ? 'is-on' : ''} />
        <span className={level >= 3 ? 'is-on' : ''} />
      </div>
      <span className="reg-strength__label">
        Password strength · {STRENGTH_LABEL[level]}
      </span>
    </div>
  );
}

/* ---------- form ---------- */

export default function RegisterForm() {
  const navigate = useNavigate();
  const { status, error: serverError, register } = useAuth();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [terms, setTerms] = useState(false);
  const [termsNote, setTermsNote] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const usernameError =
    touched.username && username.trim() === ''
      ? 'Username is required.'
      : touched.username && username.trim().length < 3
        ? 'Choose a username with at least 3 characters.'
        : touched.username && username.trim().length > 20
          ? 'Keep your username under 20 characters.'
          : touched.username && !USERNAME_RE.test(username.trim())
            ? 'Usernames can contain letters, numbers, dots, dashes and underscores.'
            : null;
  const emailError =
    touched.email && email.trim() === ''
      ? 'Please enter your email address.'
      : touched.email && !EMAIL_RE.test(email.trim())
        ? 'Please enter a valid email address.'
        : null;
  const passwordError =
    touched.password && password === ''
      ? 'Please create a password.'
      : touched.password && password.length < 6
        ? 'Your password must be at least 6 characters.'
        : null;
  const confirmError =
    touched.confirm && confirm === ''
      ? 'Please repeat your password.'
      : touched.confirm && confirm !== password
        ? 'Passwords do not match.'
        : null;

  const submitting = status === 'submitting';
  const success = status === 'success';
  const canSubmit =
    usernameError === null &&
    emailError === null &&
    passwordError === null &&
    confirmError === null &&
    terms;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched({ username: true, email: true, password: true, confirm: true });
    if (!canSubmit) return;

    const ok = await register({ username: username.trim(), email: email.trim(), password });
    if (ok) {
      window.setTimeout(() => navigate('/discover'), 1400);
    }
  };

  const openNote = () => setTermsNote((v) => !v);

  return (
    <form className="reg-form" onSubmit={submit} noValidate>
      <div className="auth-form__heading land-rise" style={delay('0.08s')}>
        <p className="auth-form__eyebrow micro">✦&nbsp; Create your account</p>
        <h1 className="auth-form__title">
          CREATE
          <br />
          <span className="text-ghost">YOUR SPACE.</span>
        </h1>
        <p className="auth-form__lead">
          Find your voice — start discovering voices worth hearing.
        </p>
      </div>

      {status === 'error' && (
        <div className="auth-banner auth-banner--error land-rise" role="alert">
          <CircleAlert size={16} aria-hidden="true" />
          {serverError}
        </div>
      )}
      {success && (
        <div className="auth-banner auth-banner--success land-rise" role="status">
          <Check size={16} aria-hidden="true" /> You&rsquo;re in — your VN-Media experience is ready.
        </div>
      )}

      <div className="reg-form__fields land-rise" style={delay('0.14s')}>
        <Field
          id="reg-username"
          label="Username"
          autoComplete="username"
          placeholder="choose a username"
          value={username}
          onChange={setUsername}
          onBlur={() => setTouched((t) => ({ ...t, username: true }))}
          error={usernameError}
          valid={touched.username && !usernameError && username.trim() !== ''}
          disabled={submitting}
        />
        <Field
          id="reg-email"
          label="Email address"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={setEmail}
          onBlur={() => setTouched((t) => ({ ...t, email: true }))}
          error={emailError}
          valid={touched.email && !emailError && email.trim() !== ''}
          disabled={submitting}
        />

        <div className="reg-form__row2">
          <div className="reg-form__cell">
            <PasswordField
              id="reg-password"
              label="Password"
              autoComplete="new-password"
              placeholder="Create a password"
              value={password}
              onChange={setPassword}
              onBlur={() => setTouched((t) => ({ ...t, password: true }))}
              error={passwordError}
              valid={touched.password && !passwordError && password.length > 0}
              disabled={submitting}
            />
            <StrengthMeter password={password} />
          </div>
          <div className="reg-form__cell">
            <PasswordField
              id="reg-confirm"
              label="Confirm password"
              autoComplete="new-password"
              placeholder="Repeat your password"
              value={confirm}
              onChange={setConfirm}
              onBlur={() => setTouched((t) => ({ ...t, confirm: true }))}
              error={confirmError}
              valid={touched.confirm && !confirmError && confirm.length > 0}
              disabled={submitting}
              showLabel="Show confirm password"
              hideLabel="Hide confirm password"
            />
          </div>
        </div>
      </div>

      <div className="reg-terms land-rise" style={delay('0.28s')}>
        <label className="auth-check reg-terms__check">
          <input
            type="checkbox"
            checked={terms}
            onChange={(e) => setTerms(e.target.checked)}
            disabled={submitting}
          />
          <span className="auth-check__box" aria-hidden="true" />
        </label>
        <p className="reg-terms__text">
          I agree to the{' '}
          <button type="button" className="reg-terms__link" onClick={openNote}>
            Terms
          </button>{' '}
          and{' '}
          <button type="button" className="reg-terms__link" onClick={openNote}>
            Privacy Policy
          </button>
        </p>
      </div>
      {termsNote && (
        <div className="auth-form__forgot-note land-rise" role="status">
          Terms &amp; privacy documents arrive with the backend phase.
        </div>
      )}

      <button
        type="submit"
        className="btn btn--primary reg-form__submit land-rise"
        style={delay('0.36s')}
        disabled={!canSubmit || submitting || success}
      >
        {submitting ? (
          <>
            Creating account… <span className="spinner" aria-hidden="true" />
          </>
        ) : success ? (
          <>
            <Check size={16} aria-hidden="true" /> You&rsquo;re in
          </>
        ) : (
          <>
            Create account <span aria-hidden="true">→</span>
          </>
        )}
      </button>

      <p className="auth-form__alt land-rise" style={delay('0.44s')}>
        Already have an account? <Link to="/login">Sign in</Link>
      </p>

      <Link to="/discover" className="auth-form__explore land-rise" style={delay('0.5s')}>
        Explore without signing in <span aria-hidden="true">→</span>
      </Link>

      <p className="auth-form__demo tabular">
        Demo — any details work · username <code>taken</code> shows the error state
      </p>
    </form>
  );
}
