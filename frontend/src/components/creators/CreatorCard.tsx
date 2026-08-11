import { Check, Plus } from 'lucide-react';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CreatorProfile } from '../../services/creatorRepository';
import { useFollows } from '../../state/FollowContext';
import { formatCount } from '../../utils/format';
import './CreatorCard.css';

interface CreatorCardProps {
  creator: CreatorProfile;
  index?: number;
  compact?: boolean;
}

/** Creator grid card — opens the profile, or toggles follow directly. */
export function CreatorCard({ creator, index = 0, compact = false }: CreatorCardProps) {
  const navigate = useNavigate();
  const { isFollowing, toggleFollow } = useFollows();
  const followed = isFollowing(creator.id);

  const open = useCallback(() => {
    navigate(`/creators/${creator.handle}`);
  }, [creator.handle, navigate]);

  return (
    <article
      className={`creator-card ${compact ? 'creator-card--compact' : ''}`}
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
      aria-label={`${creator.name} — @${creator.handle}, open profile`}
      style={{ animationDelay: `${Math.min(index, 8) * 55}ms` }}
    >
      <span className="creator-card__portrait">
        <img
          src={creator.heroImage ?? creator.avatar}
          alt=""
          loading={index < 3 ? 'eager' : 'lazy'}
          width={320}
          height={320}
        />
        <span className="creator-card__scrim" aria-hidden="true" />
        <span
          className="creator-card__avatar"
          style={{ ['--tint' as string]: creator.tint }}
          aria-hidden="true"
        >
          <img src={creator.avatar} alt="" width={52} height={52} />
        </span>
        {creator.featured && (
          <span className="creator-card__badge micro">Featured</span>
        )}
      </span>

      <span className="creator-card__meta">
        <span className="creator-card__name">{creator.name}</span>
        <span className="creator-card__handle">@{creator.handle}</span>
        <span className="creator-card__bio">{creator.bio}</span>
        <span className="creator-card__stats micro tabular">
          {formatCount(creator.followers)} followers · {creator.voiceNoteCount} VoiceNotes ·{' '}
          {creator.albumCount} {creator.albumCount === 1 ? 'Album' : 'Albums'}
        </span>
      </span>

      <button
        type="button"
        className={`follow-pill creator-card__follow ${followed ? 'is-following' : ''}`}
        aria-pressed={followed}
        aria-label={followed ? `Unfollow ${creator.name}` : `Follow ${creator.name}`}
        onClick={(e) => {
          e.stopPropagation();
          toggleFollow(creator.id);
        }}
      >
        {followed ? (
          <>
            <Check size={12} aria-hidden="true" /> Following
          </>
        ) : (
          <>
            <Plus size={12} aria-hidden="true" /> Follow
          </>
        )}
      </button>
    </article>
  );
}
