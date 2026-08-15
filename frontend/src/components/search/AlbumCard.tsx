import { Disc3, Play } from 'lucide-react';
import { useMemo } from 'react';
import type { Album } from '../../data/types';
import { getCreatorSafe as getCreator } from '../../services/api/identity';
import { voiceNotesById } from '../../data/mockVoiceNotes';
import { usePlayer } from '../../state/PlayerContext';
import { highlight } from './HighlightText';
import './AlbumCard.css';

interface AlbumCardProps {
  album: Album;
  query: string;
}

export function AlbumCard({ album, query }: AlbumCardProps) {
  const { play } = usePlayer();
  const creator = getCreator(album.creatorId);

  const tracks = useMemo(
    () => album.voiceNoteIds.map((id) => voiceNotesById[id]).filter(Boolean),
    [album.voiceNoteIds],
  );

  const activate = () => {
    if (tracks.length > 0) play(tracks[0], tracks);
  };

  return (
    <article
      className="album-card"
      role="button"
      tabIndex={0}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activate();
        }
      }}
      aria-label={`${album.title} — play first track`}
    >
      <span className="album-card__art">
        <img src={album.cover} alt="" loading="lazy" width={160} height={160} />
        <span className="album-card__hint" aria-hidden="true">
          <Play size={18} fill="currentColor" />
        </span>
        <span className="album-card__count micro">
          <Disc3 size={11} aria-hidden="true" /> {tracks.length} tracks
        </span>
      </span>

      <span className="album-card__title">{highlight(album.title, query)}</span>
      <span className="album-card__creator">@{creator.handle} · {album.year}</span>
      <span className="album-card__desc">{album.description}</span>
    </article>
  );
}
