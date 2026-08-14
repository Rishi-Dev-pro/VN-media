import { MessageCircle, Radio } from 'lucide-react';
import type { VoiceNote } from '../../data/types';
import { getCreator } from '../../data/mockCreators';
import { useCommentCount } from '../../hooks/useCommentCount';
import { useEngagement } from '../../hooks/useEngagement';
import { usePlayer } from '../../state/PlayerContext';
import { formatCount, formatReleaseDate } from '../../utils/format';
import { Avatar } from '../common/Avatar';
import { Equalizer } from '../common/Equalizer';
import { LikeButton } from '../common/LikeButton';
import { PlayerControls } from './PlayerControls';
import './FeaturedPlayer.css';

interface FeaturedPlayerProps {
  note: VoiceNote;
  /** open the comments UI for this note (optional — pages opt in) */
  onOpenComments?: (note: VoiceNote) => void;
}

/** The premium "now playing" panel — the visual focal point. */
export function FeaturedPlayer({ note, onOpenComments }: FeaturedPlayerProps) {
  const { current, isPlaying } = usePlayer();
  const { liked, likeCount, busy: likeBusy, toggle: toggleLike } = useEngagement(note);
  const commentCount = useCommentCount(note.id, note.comments);
  const creator = getCreator(note.creatorId);

  const isCurrent = current?.id === note.id;
  const playing = isCurrent && isPlaying;

  return (
    <section className="featured-player" aria-label="Now playing">
      <div className="featured-player__art">
        <img
          key={note.id}
          src={note.cover}
          alt={`Artwork for ${note.title}`}
          className={playing ? 'is-playing' : ''}
        />
        <div className="featured-player__art-scrim" aria-hidden="true" />
        <span className="featured-player__chip micro">
          <Radio size={10} aria-hidden="true" />
          Featured · {note.category}
        </span>
        <div className="featured-player__eq">
          <Equalizer playing={playing} />
        </div>
      </div>

      <div className="featured-player__body">
        <h2 className="featured-player__title">{note.title}</h2>
        <p className="featured-player__handle">@{creator.handle}</p>

        <PlayerControls size="md" />

        <div className="featured-player__foot">
          <LikeButton
            liked={liked}
            count={likeCount}
            busy={likeBusy}
            onClick={() => void toggleLike()}
            label={note.title}
          />
          {onOpenComments ? (
            <button
              type="button"
              className="featured-player__stat"
              title={`${formatCount(commentCount)} comments`}
              aria-label={`${commentCount} comments on ${note.title}`}
              onClick={() => onOpenComments(note)}
            >
              <MessageCircle size={15} aria-hidden="true" />
              <span className="tabular">{formatCount(commentCount)}</span>
            </button>
          ) : (
            <span className="featured-player__stat" title={`${formatCount(commentCount)} comments`}>
              <MessageCircle size={15} aria-hidden="true" />
              <span className="tabular">{formatCount(commentCount)}</span>
            </span>
          )}
          <span className="featured-player__date tabular">{formatReleaseDate(note.releasedAt)}</span>
          <Avatar src={creator.avatar} alt={creator.name} size={30} className="featured-player__avatar" />
        </div>
      </div>
    </section>
  );
}
