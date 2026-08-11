import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const LINKS = [
  { label: 'Discover', to: '/discover' },
  { label: 'Creators', to: '#voice' },
  { label: 'Listening', to: '#listen' },
  { label: 'Social', to: '#social' },
];

const smooth = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

export default function LandingNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const go = (target: string) => {
    setOpen(false);
    if (target.startsWith('#')) {
      const el = document.querySelector(target);
      el?.scrollIntoView({ behavior: smooth() });
    }
  };

  return (
    <header className={`land-nav ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="land-nav__inner">
        <Link to="/" className="land-nav__brand" aria-label="VN-Media home">
          <span className="land-nav__mark" aria-hidden="true">✦</span>
          <span className="land-nav__name">VN-MEDIA</span>
        </Link>

        <nav className="land-nav__links" aria-label="Landing">
          {LINKS.map((l) => (
            <button key={l.label} type="button" onClick={() => go(l.to)}>
              {l.label}
            </button>
          ))}
        </nav>

        <div className="land-nav__actions">
          <Link to="/login" className="land-nav__signin">
            Sign in
          </Link>
          <Link to="/register" className="btn btn--primary land-nav__cta">
            Create account
          </Link>
          <button
            type="button"
            className="land-nav__burger"
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <Menu size={20} />
          </button>
        </div>
      </div>

      {open && (
        <div className="land-menu" role="dialog" aria-modal="true" aria-label="VN-Media menu">
          <div className="land-menu__bar">
            <Link to="/" className="land-nav__brand" onClick={() => setOpen(false)}>
              <span className="land-nav__mark" aria-hidden="true">✦</span>
              <span className="land-nav__name">VN-MEDIA</span>
            </Link>
            <button
              type="button"
              className="land-menu__close"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
            >
              <X size={22} />
            </button>
          </div>

          <nav className="land-menu__nav" aria-label="Menu">
            <Link to="/discover" className="land-menu__link" onClick={() => setOpen(false)}>
              Discover
            </Link>
            {LINKS.filter((l) => l.to.startsWith('#')).map((l) => (
              <button key={l.label} type="button" className="land-menu__link" onClick={() => go(l.to)}>
                {l.label}
              </button>
            ))}
          </nav>

          <div className="land-menu__actions">
            <Link to="/login" className="btn btn--ghost" onClick={() => setOpen(false)}>
              Sign in
            </Link>
            <Link to="/register" className="btn btn--primary" onClick={() => setOpen(false)}>
              Create account
            </Link>
          </div>

          <p className="land-menu__tag micro">VoiceNotes · the social audio network</p>
        </div>
      )}
    </header>
  );
}
