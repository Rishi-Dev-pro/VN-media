import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface AuthShellProps {
  children: ReactNode;
}

export default function AuthShell({ children }: AuthShellProps) {
  return (
    <div className="auth-shell">
      <div className="bg" aria-hidden="true">
        <span className="bg-streak" />
        <svg className="bg-noise" xmlns="http://www.w3.org/2000/svg">
          <filter id="auth-shell-noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#auth-shell-noise)" opacity="0.5" />
        </svg>
        <span className="bg-vignette" />
      </div>

      <header className="auth-nav">
        <div className="auth-nav__inner">
          <Link to="/" className="auth-nav__brand" aria-label="VN-Media home">
            <span className="auth-nav__mark" aria-hidden="true">✦</span>
            <span className="auth-nav__name">VN-MEDIA</span>
          </Link>
          <Link to="/discover" className="auth-nav__back">
            Back to experience <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </header>

      <main className="auth-main">
        <div className="auth-layout">{children}</div>
      </main>
    </div>
  );
}
