import {
  Bookmark,
  Check,
  Download,
  Flag,
  MoreHorizontal,
  Share2,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { IconButton } from './IconButton';
import './MoreMenu.css';

interface MoreMenuProps {
  /** label of the item this menu belongs to */
  itemLabel: string;
  align?: 'left' | 'right';
}

type MenuId = 'album' | 'share' | 'download' | 'report';
type Feedback = 'album' | 'share' | 'download' | null;

interface MenuItem {
  id: MenuId;
  label: string;
  icon: LucideIcon;
  danger?: boolean;
}

const MENU_ITEMS: MenuItem[] = [
  { id: 'album', label: 'Add to album', icon: Bookmark },
  { id: 'share', label: 'Share VoiceNote', icon: Share2 },
  { id: 'download', label: 'Download', icon: Download },
  { id: 'report', label: 'Report', icon: Flag, danger: true },
];

/** A small local mock menu — real actions arrive with the API. */
export function MoreMenu({ itemLabel, align = 'right' }: MoreMenuProps) {
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

  const act = (id: MenuId) => {
    if (id === 'album' || id === 'share' || id === 'download') {
      setFeedback(id);
      window.setTimeout(() => setFeedback(null), 1400);
    }
    setOpen(false);
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
          {MENU_ITEMS.map((item) => {
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
                {isFeedback ? 'Saved to your library' : item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
