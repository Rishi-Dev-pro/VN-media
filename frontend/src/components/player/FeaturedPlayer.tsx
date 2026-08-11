import { MessageCircle, Radio } from 'lucide-react';
import type { VoiceNote } from '../../data/types';
import { getCreator } from '../../data/mockCreators';
import { usePlayer } from '../../state/PlayerContext';
import { formatCount, formatReleaseDate } from '../../utils/format';
import { Avatar } from '../common/Avatar';
import { Equalizer } from '../common/Equalizer';
import { LikeButton } from '../common/LikeButton';
import { PlayerControls } from './PlayerControls';
import './FeaturedPlayer.css';

interface FeaturedPlayerProps {
  note: VoiceNote;
}

/** The premium "now playing" panel — the visual focal point. */
export function FeaturedPlayer({ note }: FeaturedPlayerProps) {
  const { current, isPlaying, toggleLike, isLiked } = usePlayer();
  const creator = getCreator(note.creatorId);

  const isCurrent = current?.id === note.id;
  const playing = isCurrent && isPlaying;
  const liked = isLiked(note.id);

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
            count={note.likes}
            onClick={() => toggleLike(note.id)}
            label={note.title}
          />
          <span className="featured-player__stat" title={`${formatCount(note.comments)} comments`}>
            <MessageCircle size={15} aria-hidden="true" />
            <span className="tabular">{formatCount(note.comments)}</span>
          </span>
          <span className="featured-player__date tabular">{formatReleaseDate(note.releasedAt)}</span>
          <Avatar src={creator.avatar} alt={creator.name} size={30} className="featured-player__avatar" />
        </div>
      </div>
    </section>
  );
}
