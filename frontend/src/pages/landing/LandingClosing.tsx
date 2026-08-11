import { Link } from 'react-router-dom';
import './landing.css';

export default function LandingClosing() {
  return (
    <>
      <section className="land-cta" id="cta">
        <img
          className="land-cta__bg"
          src="/images/cta-studio.jpg"
          alt=""
          aria-hidden="true"
          loading="lazy"
        />
        <span className="land-cta__scrim" aria-hidden="true" />
        <span className="land-cta__glow" aria-hidden="true" />

        <div className="land-cta__content">
          <p className="land-cta__eyebrow micro land-rise">One last thing</p>
          <h2 className="land-cta__title">
            YOUR NEXT
            <br />
            FAVORITE VOICE
            <br />
            <span className="land-cta__ghost">IS OUT THERE.</span>
          </h2>
          <Link to="/discover" className="btn btn--primary btn--lg land-cta__btn">
            Start listening <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      <footer className="land-footer">
        <div className="land-footer__inner">
          <div className="land-footer__brand">
            <span className="land-nav__mark" aria-hidden="true">✦</span>
            <span className="land-nav__name">VN-MEDIA</span>
            <p className="land-footer__tag">Sound, without limits.</p>
          </div>

          <nav className="land-footer__links" aria-label="Footer">
            <Link to="/discover">Discover</Link>
            <a href="#voice">Creators</a>
            <a href="#listen">Listening</a>
            <a href="#social">Social</a>
          </nav>

          <div className="land-footer__legal">
            <span>© 2026 VN-Media</span>
            <span aria-hidden="true">·</span>
            <span>Privacy</span>
            <span aria-hidden="true">·</span>
            <span>Terms</span>
          </div>
        </div>
      </footer>
    </>
  );
}
