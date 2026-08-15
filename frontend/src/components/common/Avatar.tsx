import './Avatar.css';

interface AvatarProps {
  src?: string | null;
  alt: string;
  size?: number;
  /** renders an accent ring around the avatar */
  ring?: boolean;
  className?: string;
}

/** Real backend users may have no avatar yet — never emit an empty src. */
const FALLBACK_AVATAR = '/images/portrait-7.jpg';

export function Avatar({ src, alt, size = 36, ring = false, className = '' }: AvatarProps) {
  return (
    <span
      className={`avatar ${ring ? 'avatar--ring' : ''} ${className}`}
      style={{ width: size, height: size }}
    >
      <img src={src || FALLBACK_AVATAR} alt={alt} loading="lazy" width={size} height={size} />
    </span>
  );
}
