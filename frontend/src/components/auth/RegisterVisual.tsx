import { useParallax } from '../../hooks/useParallax';

export default function RegisterVisual() {
  const visualRef = useParallax<HTMLDivElement>();

  return (
    <div className="auth-visual reg-visual" ref={visualRef} aria-hidden="true">
      <span className="auth-visual__glow" />
      <span className="auth-visual__glow reg-visual__glow" />

      <figure className="auth-visual__frame reg-visual__frame">
        <img src="/images/reg-mic.jpg" alt="" loading="eager" />
        <span className="auth-visual__notch" />
        <span className="auth-visual__scrim" />
        <figcaption className="auth-visual__chip reg-visual__chip">
          <span className="reg-visual__dot" /> Recording
        </figcaption>
      </figure>

      <div className="auth-card-flt reg-visual__ready">
        <div className="auth-card-flt__inner">
          <span className="auth-card-flt__title">New creator</span>
          <span className="reg-visual__ready-label micro">●&nbsp; Ready</span>
        </div>
      </div>

      <div className="auth-card-flt reg-visual__voice">
        <div className="auth-card-flt__inner">
          <span className="auth-eq" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className="auth-card-flt__title">Your voice is worth hearing</span>
        </div>
      </div>
    </div>
  );
}
