import { UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import './AuthPlaceholder.css';

/** Registration placeholder — the full experience lands in Phase 4. */
export default function AuthPlaceholder() {
  return (
    <div className="auth-page">
      <div className="bg" aria-hidden="true">
        <span className="bg-streak" />
        <svg className="bg-noise" xmlns="http://www.w3.org/2000/svg">
          <filter id="auth-placeholder-noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#auth-placeholder-noise)" opacity="0.5" />
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
            <UserPlus size={26} strokeWidth={1.6} />
          </span>
          <h1 className="auth-card__title">Create your account</h1>
          <p className="auth-card__body">
            Registration arrives in the next phase of VN-Media. For now, sign
            in with the demo or explore the experience.
          </p>

          <div className="auth-card__actions">
            <Link to="/login" className="btn btn--primary">
              Back to sign in <span aria-hidden="true">→</span>
            </Link>
            <Link to="/discover" className="btn btn--ghost">
              Explore VN-Media
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
