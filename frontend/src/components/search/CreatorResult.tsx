import { Check, Plus } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { Creator } from '../../data/types';
import { notesByCreator } from '../../data/mockFollowing';
import { useFollows } from '../../state/FollowContext';
import { formatCount } from '../../utils/format';
import { Avatar } from '../common/Avatar';
import { highlight } from './HighlightText';
import './CreatorResult.css';

interface CreatorResultProps {
  creator: Creator;
  query: string;
}

export function CreatorResult({ creator, query }: CreatorResultProps) {
  const { isFollowing, toggleFollow } = useFollows();
  const followed = isFollowing(creator.id);
  const noteCount = useMemo(() => notesByCreator(creator.id).length, [creator.id]);

  return (
    <div className="creator-result">
      <Link
        to={`/creators/${creator.handle}`}
        className="creator-result__link"
        aria-label={`View profile of ${creator.name}`}
      >
        <Avatar src={creator.avatar} alt={creator.name} size={48} />
        <span className="creator-result__meta">
          <span className="creator-result__handle">
            {highlight(`@${creator.handle}`, query)}
          </span>
          <span className="creator-result__name">{creator.name}</span>
          <span className="creator-result__bio">{creator.bio}</span>
        </span>
      </Link>
      <div className="creator-result__stats micro tabular">
        <span>{formatCount(creator.followers)} followers</span>
        <span>·</span>
        <span>{noteCount} VoiceNotes</span>
      </div>
      <button
        type="button"
        className={`follow-pill ${followed ? 'is-following' : ''}`}
        aria-pressed={followed}
        aria-label={followed ? `Unfollow ${creator.name}` : `Follow ${creator.name}`}
        onClick={() => toggleFollow(creator.id)}
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
