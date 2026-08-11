import { Disc3, Lock, Play } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { voiceNotesById } from '../../data/mockVoiceNotes';
import type { AlbumSummary } from '../../services/albumRepository';
import { usePlayer } from '../../state/PlayerContext';
import { formatMinutes } from '../../utils/format';
import { MoreMenu } from '../common/MoreMenu';
import './AlbumCard.css';

interface AlbumCardProps {
  album: AlbumSummary;
  index?: number;
}

/** Album grid card — opens the album, or plays its first track directly. */
export function AlbumCard({ album, index = 0 }: AlbumCardProps) {
  const navigate = useNavigate();
  const { play } = usePlayer();

  const tracks = useMemo(
    () => album.voiceNoteIds.map((id) => voiceNotesById[id]).filter(Boolean),
    [album.voiceNoteIds],
  );

  const isPrivate = album.visibility === 'followers';

  const open = useCallback(() => {
    navigate(`/albums/${album.id}`);
  }, [album.id, navigate]);

  const playFirst = useCallback(() => {
    if (tracks.length > 0) play(tracks[0], tracks);
  }, [play, tracks]);

  return (
    <article
      className="album-card-v2"
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
      aria-label={`${album.title} by ${album.creatorName} — open album`}
      style={{ animationDelay: `${Math.min(index, 8) * 55}ms` }}
    >
      <span className="album-card-v2__art">
        <img
          src={album.cover}
          alt=""
          loading={index < 3 ? 'eager' : 'lazy'}
          width={320}
          height={320}
        />
        <span className="album-card-v2__notch" aria-hidden="true" />
        <span className="album-card-v2__scrim" aria-hidden="true" />
        {isPrivate && (
          <span className="album-card-v2__private micro">
            <Lock size={10} aria-hidden="true" /> Private
          </span>
        )}
        <span className="album-card-v2__count micro">
          <Disc3 size={11} aria-hidden="true" />
          {album.trackCount} {album.trackCount === 1 ? 'track' : 'tracks'} · {formatMinutes(album.totalDuration)}
        </span>
        <button
          type="button"
          className="album-card-v2__play"
          aria-label={`Play ${album.title}`}
          onClick={(e) => {
            e.stopPropagation();
            playFirst();
          }}
        >
          <Play size={16} fill="currentColor" aria-hidden="true" />
        </button>
      </span>

      <span className="album-card-v2__more" onClick={(e) => e.stopPropagation()}>
        <MoreMenu itemLabel={album.title} align="right" />
      </span>

      <span className="album-card-v2__meta">
        <span className="album-card-v2__title">{album.title}</span>
        <span className="album-card-v2__creator">
          @{album.creatorHandle} · {album.year}
        </span>
      </span>
    </article>
  );
}
