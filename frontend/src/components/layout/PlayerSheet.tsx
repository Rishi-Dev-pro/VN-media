import { ChevronDown, MessageCircle } from 'lucide-react';
import { useEffect } from 'react';
import { getCreator } from '../../data/mockCreators';
import { usePlayer } from '../../state/PlayerContext';
import { formatCount, formatReleaseDate } from '../../utils/format';
import { Avatar } from '../common/Avatar';
import { Equalizer } from '../common/Equalizer';
import { LikeButton } from '../common/LikeButton';
import { PlayerControls } from '../player/PlayerControls';
import './PlayerSheet.css';

interface PlayerSheetProps {
  open: boolean;
  onClose: () => void;
}

export function PlayerSheet({ open, onClose }: PlayerSheetProps) {
  const { current, isPlaying, toggleLike, isLiked } = usePlayer();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !current) return null;

  const creator = getCreator(current.creatorId);
  const liked = isLiked(current.id);

  return (
    <div
      className="player-sheet"
      role="dialog"
      aria-modal="true"
      aria-label={`Now playing: ${current.title}`}
    >
      <div className="player-sheet__backdrop" onClick={onClose} aria-hidden="true" />

      <div className="player-sheet__panel">
        <div className="player-sheet__grabber" aria-hidden="true" />

        <div className="player-sheet__head">
          <button type="button" className="player-sheet__close" onClick={onClose} aria-label="Close player">
            <ChevronDown size={22} />
          </button>
          <span className="player-sheet__head-label micro">Now playing</span>
          <span className="player-sheet__head-spacer" aria-hidden="true" />
        </div>

        <div className="player-sheet__art">
          <img key={current.id} src={current.cover} alt={`Artwork for ${current.title}`} />
          <div className="player-sheet__eq">
            <Equalizer playing={isPlaying} bars={5} />
          </div>
        </div>

        <div className="player-sheet__meta">
          <span className="player-sheet__chip micro">{current.category}</span>
          <h2 className="player-sheet__title">{current.title}</h2>
          <div className="player-sheet__creator">
            <Avatar src={creator.avatar} alt={creator.name} size={26} />
            <span>@{creator.handle}</span>
            <span className="player-sheet__plays tabular">· {formatCount(current.plays)} plays</span>
          </div>
        </div>

        <PlayerControls size="lg" />

        <div className="player-sheet__foot">
          <LikeButton
            liked={liked}
            count={current.likes}
            onClick={() => toggleLike(current.id)}
            label={current.title}
          />
          <span className="player-sheet__stat" title={`${formatCount(current.comments)} comments`}>
            <MessageCircle size={16} aria-hidden="true" />
            <span className="tabular">{formatCount(current.comments)}</span>
          </span>
          <span className="player-sheet__date tabular">{formatReleaseDate(current.releasedAt)}</span>
        </div>
      </div>
    </div>
  );
}
