import { Check, Plus } from 'lucide-react';
import type { FollowingCreator } from '../../services/followingRepository';
import { usePlayer } from '../../state/PlayerContext';
import { formatCount } from '../../utils/format';
import './CreatorRail.css';

interface CreatorRailProps {
  creators: FollowingCreator[];
  followingIds: Set<string>;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onToggleFollow: (id: string) => void;
}

export function CreatorRail({
  creators,
  followingIds,
  selected,
  onSelect,
  onToggleFollow,
}: CreatorRailProps) {
  const { current, isPlaying } = usePlayer();

  return (
    <div className="creator-rail no-scrollbar" role="list" aria-label="People you follow">
      {creators.map((creator) => {
        const followed = followingIds.has(creator.id);
        const isSelected = selected === creator.id;
        const live = isPlaying && current?.creatorId === creator.id;

        return (
          <div key={creator.id} className={`creator-cell ${isSelected ? 'is-selected' : ''}`} role="listitem">
            <button
              type="button"
              className="creator-cell__main"
              aria-pressed={isSelected}
              aria-label={`Filter feed by ${creator.name} — @${creator.handle}`}
              onClick={() => onSelect(isSelected ? null : creator.id)}
            >
              <span
                className={`creator-cell__avatar ${followed ? 'is-followed' : ''} ${live ? 'is-live' : ''}`}
                style={followed ? { ['--tint' as string]: creator.tint } : undefined}
              >
                <img src={creator.avatar} alt="" loading="lazy" width={52} height={52} />
                <span className="creator-cell__live" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              </span>
              <span className="creator-cell__name">@{creator.handle}</span>
              <span className="creator-cell__meta">
                {formatCount(creator.followers)} followers
              </span>
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
      })}
    </div>
  );
}
