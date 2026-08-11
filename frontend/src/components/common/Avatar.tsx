import './Avatar.css';

interface AvatarProps {
  src: string;
  alt: string;
  size?: number;
  /** renders an accent ring around the avatar */
  ring?: boolean;
  className?: string;
}

export function Avatar({ src, alt, size = 36, ring = false, className = '' }: AvatarProps) {
  return (
    <span
      className={`avatar ${ring ? 'avatar--ring' : ''} ${className}`}
      style={{ width: size, height: size }}
    >
      <img src={src} alt={alt} loading="lazy" width={size} height={size} />
    </span>
  );
}
