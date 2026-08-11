import LandingNav from './LandingNav';
import LandingHero from './LandingHero';
import LandingSections from './LandingSections';
import LandingSocial from './LandingSocial';
import LandingClosing from './LandingClosing';
import './landing.css';

export default function LandingPage() {
  return (
    <div className="landing">
      <div className="bg" aria-hidden="true">
        <span className="bg-streak" />
        <svg className="bg-noise" xmlns="http://www.w3.org/2000/svg">
          <filter id="land-noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#land-noise)" opacity="0.5" />
        </svg>
        <span className="bg-vignette" />
      </div>

      <LandingNav />

      <main>
        <LandingHero />
        <LandingSections />
        <LandingSocial />
        <LandingClosing />
      </main>
    </div>
  );
}
