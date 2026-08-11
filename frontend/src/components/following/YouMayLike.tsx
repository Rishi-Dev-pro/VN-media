import { Check, Plus } from 'lucide-react';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { FollowingCreator } from '../../services/followingRepository';
import { formatCount } from '../../utils/format';
import './YouMayLike.css';

interface YouMayLikeProps {
  creators: FollowingCreator[];
  followingIds: Set<string>;
  onToggleFollow: (id: string) => void;
}

/** Creator recommendations — deterministic (popularity), frontend-only. */
export function YouMayLike({ creators, followingIds, onToggleFollow }: YouMayLikeProps) {
  return (
    <div className="you-may-like">
      {creators.map((creator, i) => {
        const followed = followingIds.has(creator.id);
        return (
          <RecommendationCell
            key={creator.id}
            creator={creator}
            followed={followed}
            index={i}
            onToggleFollow={onToggleFollow}
          />
        );
      })}
    </div>
  );
}

function RecommendationCell({
  creator,
  followed,
  index,
  onToggleFollow,
}: {
  creator: FollowingCreator;
  followed: boolean;
  index: number;
  onToggleFollow: (id: string) => void;
}) {
  const navigate = useNavigate();
  const open = useCallback(() => {
    navigate(`/creators/${creator.handle}`);
  }, [creator.handle, navigate]);

  return (
    <article
      className="you-may-like__cell"
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
      aria-label={`View profile of ${creator.name} — @${creator.handle}`}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <span className="you-may-like__avatar">
        <img src={creator.avatar} alt="" loading="lazy" width={56} height={56} />
      </span>
      <span className="you-may-like__meta">
        <span className="you-may-like__name">{creator.name}</span>
        <span className="you-may-like__handle">@{creator.handle}</span>
        <span className="you-may-like__bio">{creator.bio}</span>
        <span className="you-may-like__followers micro tabular">
          {formatCount(creator.followers)} followers
        </span>
      </span>
      <button
        type="button"
        className={`follow-pill you-may-like__follow ${followed ? 'is-following' : ''}`}
        aria-pressed={followed}
        aria-label={followed ? `Unfollow ${creator.name}` : `Follow ${creator.name}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggleFollow(creator.id);
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
