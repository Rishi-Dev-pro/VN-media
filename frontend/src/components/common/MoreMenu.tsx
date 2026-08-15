import {
  Bookmark,
  Check,
  Download,
  Flag,
  ListMusic,
  ListPlus,
  MoreHorizontal,
  Share2,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { VoiceNote } from '../../data/types';
import { usePlayer } from '../../state/PlayerContext';
import { IconButton } from './IconButton';
import './MoreMenu.css';

interface MoreMenuProps {
  /** label of the item this menu belongs to */
  itemLabel: string;
  align?: 'left' | 'right';
  /** when provided, the menu gains real queue actions */
  note?: VoiceNote;
}

type MenuId = 'next' | 'queue' | 'album' | 'share' | 'download' | 'report';
type Feedback = 'next' | 'queue' | 'album' | 'share' | 'download' | null;

interface MenuItem {
  id: MenuId;
  label: string;
  icon: LucideIcon;
  danger?: boolean;
}

const BASE_ITEMS: MenuItem[] = [
  { id: 'album', label: 'Add to album', icon: Bookmark },
  { id: 'share', label: 'Share VoiceNote', icon: Share2 },
  { id: 'download', label: 'Download', icon: Download },
  { id: 'report', label: 'Report', icon: Flag, danger: true },
];

/** A small local mock menu — real actions arrive with the API. Queue
 *  actions are live: they mutate the single global player queue. */
export function MoreMenu({ itemLabel, align = 'right', note }: MoreMenuProps) {
  const { playNext, addToQueue } = usePlayer();
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const items: MenuItem[] = note
    ? [
        { id: 'next', label: 'Play next', icon: ListPlus },
        { id: 'queue', label: 'Add to queue', icon: ListMusic },
        ...BASE_ITEMS,
      ]
    : BASE_ITEMS;

  const act = (id: MenuId) => {
    if (id === 'next' && note) {
      playNext(note);
      setFeedback('next');
      window.setTimeout(() => setFeedback(null), 1400);
    } else if (id === 'queue' && note) {
      addToQueue(note);
      setFeedback('queue');
      window.setTimeout(() => setFeedback(null), 1400);
    } else if (id === 'album' || id === 'share' || id === 'download') {
      setFeedback(id);
      window.setTimeout(() => setFeedback(null), 1400);
    }
    setOpen(false);
  };

  const feedbackLabel: Record<Exclude<Feedback, null>, string> = {
    next: 'Play next — queued',
    queue: 'Added to queue',
    album: 'Saved to your library',
    share: 'Share link copied',
    download: 'Download starts soon',
  };

  return (
    <div ref={rootRef} className={`more-menu more-menu--${align}`}>
      <IconButton
        label={`More options for ${itemLabel}`}
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <MoreHorizontal />
      </IconButton>

      {open && (
        <div className="more-menu__pop" role="menu" aria-label={`Options for ${itemLabel}`}>
          {items.map((item) => {
            const Icon = item.icon;
            const isFeedback = feedback === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                className={`more-menu__item ${item.danger ? 'is-danger' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  act(item.id);
                }}
              >
                <span className="more-menu__icon">
                  {isFeedback ? <Check /> : <Icon />}
                </span>
                {isFeedback ? feedbackLabel[feedback as Exclude<Feedback, null>] : item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
