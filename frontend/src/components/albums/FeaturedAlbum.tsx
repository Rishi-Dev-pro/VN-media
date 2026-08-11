import { Disc3, Play, Sparkles } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { voiceNotesById } from '../../data/mockVoiceNotes';
import type { AlbumSummary } from '../../services/albumRepository';
import { usePlayer } from '../../state/PlayerContext';
import { formatMinutes } from '../../utils/format';
import { Avatar } from '../common/Avatar';
import './FeaturedAlbum.css';

interface FeaturedAlbumProps {
  album: AlbumSummary;
}

/** The cinematic featured collection — sleeve artwork + floating glass chips. */
export function FeaturedAlbum({ album }: FeaturedAlbumProps) {
  const navigate = useNavigate();
  const { play } = usePlayer();

  const tracks = useMemo(
    () => album.voiceNoteIds.map((id) => voiceNotesById[id]).filter(Boolean),
    [album.voiceNoteIds],
  );

  const playAll = useCallback(() => {
    if (tracks.length > 0) play(tracks[0], tracks);
  }, [play, tracks]);

  const open = useCallback(() => {
    navigate(`/albums/${album.id}`);
  }, [album.id, navigate]);

  return (
    <section className="featured-album" aria-label={`Featured collection: ${album.title}`}>
      <div className="featured-album__media">
        <div className="featured-album__glow" aria-hidden="true" />
        <div className="featured-album__frame">
          <img src={album.cover} alt={`Artwork for ${album.title}`} width={560} height={700} />
          <span className="featured-album__notch" aria-hidden="true" />
          <span className="featured-album__scrim" aria-hidden="true" />
          <span className="featured-album__chip micro">
            <Sparkles size={11} aria-hidden="true" />
            Featured collection
          </span>
        </div>

        <div className="featured-album__float featured-album__float--tracks">
          <Disc3 size={14} aria-hidden="true" />
          <span>
            <strong className="tabular">{album.trackCount}</strong> tracks
          </span>
        </div>
        <div className="featured-album__float featured-album__float--time">
          <span className="featured-album__pulse" aria-hidden="true" />
          {formatMinutes(album.totalDuration)}
        </div>
      </div>

      <div className="featured-album__body">
        <p className="featured-album__kicker micro">✦&nbsp; Curated · {album.year}</p>
        <h2 className="featured-album__title">{album.title}</h2>
        <p className="featured-album__desc">{album.description}</p>

        <div className="featured-album__creator">
          <Avatar src={album.creatorAvatar} alt={album.creatorName} size={34} />
          <span className="featured-album__creator-meta">
            <span className="featured-album__creator-name">{album.creatorName}</span>
            <span className="featured-album__creator-handle">@{album.creatorHandle}</span>
          </span>
        </div>

        <div className="featured-album__stats micro tabular">
          <span>{album.trackCount} VoiceNotes</span>
          <span>{formatMinutes(album.totalDuration)}</span>
          <span>Public</span>
        </div>

        <div className="featured-album__actions">
          <button type="button" className="btn btn--primary featured-album__play" onClick={playAll}>
            <Play size={15} fill="currentColor" aria-hidden="true" />
            Play collection
          </button>
          <button type="button" className="btn btn--ghost featured-album__open" onClick={open}>
            Open album <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </section>
  );
}
