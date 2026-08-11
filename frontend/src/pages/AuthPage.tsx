import { ArrowLeft, LogIn, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import './AuthPage.css';

interface AuthPageProps {
  mode: 'login' | 'register';
}

/** Public pre-auth pages. Full authentication ships in a later phase. */
export default function AuthPage({ mode }: AuthPageProps) {
  const isLogin = mode === 'login';
  const Icon = isLogin ? LogIn : UserPlus;

  return (
    <div className="auth-page">
      <div className="bg" aria-hidden="true">
        <span className="bg-streak" />
        <svg className="bg-noise" xmlns="http://www.w3.org/2000/svg">
          <filter id="auth-noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#auth-noise)" opacity="0.5" />
        </svg>
        <span className="bg-vignette" />
      </div>

      <header className="auth-page__nav">
        <Link to="/" className="auth-page__brand">
          <span className="auth-page__mark" aria-hidden="true">✦</span>
          <span className="auth-page__name">VN-MEDIA</span>
        </Link>
      </header>

      <main className="auth-page__main">
        <div className="auth-card">
          <span className="auth-card__orb" aria-hidden="true">
            <Icon size={26} strokeWidth={1.6} />
          </span>
          <h1 className="auth-card__title">{isLogin ? 'Welcome back' : 'Create your account'}</h1>
          <p className="auth-card__body">
            {isLogin
              ? 'Sign-in arrives in the next phase of VN-Media. For now, explore the experience below.'
              : 'Registration arrives in the next phase of VN-Media. For now, explore the experience below.'}
          </p>

          <div className="auth-card__field" aria-hidden="true">
            <span className="auth-card__field-label micro">
              {isLogin ? 'Email' : 'Username'}
            </span>
            <span className="auth-card__field-box" />
          </div>
          <div className="auth-card__field" aria-hidden="true">
            <span className="auth-card__field-label micro">
              {isLogin ? 'Password' : 'Password'}
            </span>
            <span className="auth-card__field-box" />
          </div>

          <div className="auth-card__actions">
            <Link to="/discover" className="btn btn--primary">
              Explore VN-Media <span aria-hidden="true">→</span>
            </Link>
            <Link to="/" className="btn btn--ghost">
              <ArrowLeft size={15} aria-hidden="true" /> Back to home
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
