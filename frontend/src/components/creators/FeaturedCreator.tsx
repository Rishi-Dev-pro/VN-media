import { ArrowRight, Check, Mic2, Plus, Users } from 'lucide-react';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CreatorProfile } from '../../services/creatorRepository';
import { useFollows } from '../../state/FollowContext';
import { formatCount } from '../../utils/format';
import './FeaturedCreator.css';

interface FeaturedCreatorProps {
  creator: CreatorProfile;
}

/** The cinematic featured creator — portrait sleeve + floating identity. */
export function FeaturedCreator({ creator }: FeaturedCreatorProps) {
  const navigate = useNavigate();
  const { isFollowing, toggleFollow } = useFollows();
  const followed = isFollowing(creator.id);
  const followers = creator.followers + (followed ? 1 : 0);

  const open = useCallback(() => {
    navigate(`/creators/${creator.handle}`);
  }, [creator.handle, navigate]);

  return (
    <section className="featured-creator" aria-label={`Featured creator: ${creator.name}`}>
      <div className="featured-creator__media">
        <div className="featured-creator__glow" aria-hidden="true" />
        <div className="featured-creator__frame">
          <img
            src={creator.heroImage ?? creator.avatar}
            alt={`Portrait of ${creator.name}`}
            width={560}
            height={700}
          />
          <span className="featured-creator__notch" aria-hidden="true" />
          <span className="featured-creator__scrim" aria-hidden="true" />
          <span className="featured-creator__chip micro">
            <Mic2 size={11} aria-hidden="true" />
            Featured creator
          </span>
        </div>

        <div className="featured-creator__float featured-creator__float--followers">
          <Users size={14} aria-hidden="true" />
          <span>
            <strong className="tabular">{formatCount(followers)}</strong> followers
          </span>
        </div>
        <div className="featured-creator__float featured-creator__float--notes">
          <span className="featured-creator__pulse" aria-hidden="true" />
          {creator.voiceNoteCount} VoiceNotes
        </div>
      </div>

      <div className="featured-creator__body">
        <p className="featured-creator__kicker micro">✦&nbsp; The voice behind the stories</p>
        <h2 className="featured-creator__title">{creator.name}</h2>
        <p className="featured-creator__handle">@{creator.handle}</p>
        <p className="featured-creator__bio">{creator.bio}</p>

        <div className="featured-creator__stats micro tabular">
          <span>{formatCount(followers)} followers</span>
          <span>{creator.voiceNoteCount} VoiceNotes</span>
          <span>{creator.albumCount} {creator.albumCount === 1 ? 'Album' : 'Albums'}</span>
        </div>

        <div className="featured-creator__actions">
          <button
            type="button"
            className={`btn btn--primary featured-creator__follow ${followed ? 'is-following' : ''}`}
            aria-pressed={followed}
            onClick={() => toggleFollow(creator.id)}
          >
            {followed ? (
              <>
                <Check size={15} aria-hidden="true" /> Following
              </>
            ) : (
              <>
                <Plus size={15} aria-hidden="true" /> Follow
              </>
            )}
          </button>
          <button type="button" className="btn btn--ghost featured-creator__view" onClick={open}>
            View profile <ArrowRight size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}
