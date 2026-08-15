import { Check, Plus } from 'lucide-react';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { FollowingCreator } from '../../services/followingRepository';
import { usePlayer } from '../../state/PlayerContext';
import { formatCount } from '../../utils/format';
import './CreatorRail.css';

interface CreatorRailProps {
  creators: FollowingCreator[];
  followingIds: Set<string>;
  onToggleFollow: (id: string) => void;
}

/** Horizontal rail of followed creators — click opens the profile. */
export function CreatorRail({ creators, followingIds, onToggleFollow }: CreatorRailProps) {
  const { current, isPlaying } = usePlayer();

  return (
    <div className="creator-rail no-scrollbar" role="list" aria-label="People you follow">
      {creators.map((creator) => {
        const followed = followingIds.has(creator.id);
        const live = isPlaying && current?.creatorId === creator.id;

        return (
          <CreatorCell
            key={creator.id}
            creator={creator}
            followed={followed}
            live={live}
            onToggleFollow={onToggleFollow}
          />
        );
      })}
    </div>
  );
}

function CreatorCell({
  creator,
  followed,
  live,
  onToggleFollow,
}: {
  creator: FollowingCreator;
  followed: boolean;
  live: boolean;
  onToggleFollow: (id: string) => void;
}) {
  const navigate = useNavigate();
  const open = useCallback(() => {
    navigate(`/creators/${creator.handle}`);
  }, [creator.handle, navigate]);

  return (
    <div className="creator-cell" role="listitem">
      <button
        type="button"
        className="creator-cell__main"
        aria-label={`View profile of ${creator.name} — @${creator.handle}`}
        onClick={open}
      >
        <span
          className={`creator-cell__avatar ${followed ? 'is-followed' : ''} ${live ? 'is-live' : ''}`}
          style={{ ['--tint' as string]: creator.tint }}
        >
          <img src={creator.avatar || '/images/portrait-7.jpg'} alt="" loading="lazy" width={52} height={52} />
          <span className="creator-cell__live" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </span>
        <span className="creator-cell__name">@{creator.handle}</span>
        <span className="creator-cell__meta">{formatCount(creator.followers)} followers</span>
      </button>

      <button
        type="button"
        className={`follow-pill ${followed ? 'is-following' : ''}`}
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
    </div>
  );
}
