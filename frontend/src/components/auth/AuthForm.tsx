import { Check, CircleAlert } from 'lucide-react';
import { useState, type CSSProperties, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Field } from './Field';
import { PasswordField } from './PasswordField';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const delay = (d: string) => ({ '--d': d } as CSSProperties);

export default function AuthForm() {
  const navigate = useNavigate();
  const { status, error: serverError, signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({});

  const emailError =
    touched.email && email.trim() === ''
      ? 'Please enter your email address.'
      : touched.email && !EMAIL_RE.test(email.trim())
        ? 'Please enter a valid email address.'
        : null;
  const passwordError =
    touched.password && password === ''
      ? 'Please enter your password.'
      : touched.password && password.length < 6
        ? 'Your password must be at least 6 characters.'
        : null;

  const submitting = status === 'submitting';
  const success = status === 'success';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (emailError || passwordError) return;

    const ok = await signIn(email, password);
    if (ok) {
      // brief success pause before entering the app
      window.setTimeout(() => navigate('/discover'), 1200);
    }
  };

  return (
    <form className="auth-form" onSubmit={submit} noValidate>
      <div className="auth-form__heading land-rise" style={delay('0.08s')}>
        <p className="auth-form__eyebrow micro">✦&nbsp; Sign in</p>
        <h1 className="auth-form__title">
          WELCOME
          <br />
          <span className="text-ghost">BACK.</span>
        </h1>
        <p className="auth-form__lead">Continue your listening experience.</p>
      </div>

      {status === 'error' && (
        <div className="auth-banner auth-banner--error land-rise" role="alert">
          <CircleAlert size={16} aria-hidden="true" />
          {serverError}
        </div>
      )}
      {success && (
        <div className="auth-banner auth-banner--success land-rise" role="status">
          <Check size={16} aria-hidden="true" />
          Welcome back
        </div>
      )}

      <div className="auth-form__fields land-rise" style={delay('0.18s')}>
        <Field
          id="login-email"
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
        <PasswordField
          id="login-password"
          label="Password"
          autoComplete="current-password"
          placeholder="Enter your password"
          value={password}
          onChange={setPassword}
          onBlur={() => setTouched((t) => ({ ...t, password: true }))}
          error={passwordError}
          valid={touched.password && !passwordError && password.length > 0}
          disabled={submitting}
        />
      </div>

      <div className="auth-form__row land-rise" style={delay('0.28s')}>
        <label className="auth-check">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            disabled={submitting}
          />
          <span className="auth-check__box" aria-hidden="true" />
          <span>Remember me</span>
        </label>
        <button
          type="button"
          className="auth-form__forgot"
          aria-expanded={forgotOpen}
          onClick={() => setForgotOpen((v) => !v)}
        >
          Forgot password?
        </button>
      </div>

      {forgotOpen && (
        <div className="auth-form__forgot-note land-rise" role="status">
          Password reset arrives with the backend phase — for now any valid
          email and password opens the demo.
        </div>
      )}

      <button
        type="submit"
        className="btn btn--primary auth-form__submit land-rise"
        style={delay('0.36s')}
        disabled={submitting || success}
      >
        {submitting ? (
          <>
            Signing in… <span className="spinner" aria-hidden="true" />
          </>
        ) : success ? (
          <>
            <Check size={16} aria-hidden="true" /> Welcome back
          </>
        ) : (
          <>
            Sign in <span aria-hidden="true">→</span>
          </>
        )}
      </button>

      <p className="auth-form__alt land-rise" style={delay('0.44s')}>
        Don&rsquo;t have an account? <Link to="/register">Create one</Link>
      </p>

      <Link to="/discover" className="auth-form__explore land-rise" style={delay('0.5s')}>
        Explore without signing in <span aria-hidden="true">→</span>
      </Link>

      <p className="auth-form__demo tabular">
        Demo — any email &amp; password · <code>demo@error.com</code> shows the error state
      </p>
    </form>
  );
}
