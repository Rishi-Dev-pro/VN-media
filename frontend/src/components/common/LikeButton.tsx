import { Heart } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { formatCount } from '../../utils/format';
import './LikeButton.css';

interface LikeButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  liked: boolean;
  /** optional count shown next to the heart */
  count?: number;
  /** compact heart-only mode */
  iconOnly?: boolean;
  label?: string;
}

export function LikeButton({
  liked,
  count,
  iconOnly = false,
  label = 'Like',
  className = '',
  ...rest
}: LikeButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={liked}
      aria-label={liked ? `Unlike — ${label}` : `Like — ${label}`}
      title={liked ? 'Unlike' : 'Like'}
      className={`like-btn ${liked ? 'is-liked' : ''} ${iconOnly ? 'like-btn--icon' : ''} ${className}`}
      {...rest}
    >
      <span className="like-btn__icon">
        <Heart strokeWidth={2} aria-hidden="true" />
      </span>
      {!iconOnly && count !== undefined && (
        <span className="like-btn__count tabular">{formatCount(count)}</span>
      )}
    </button>
  );
}
