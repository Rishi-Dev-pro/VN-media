import { ArrowLeft, Eraser, MoreHorizontal, Search, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Creator } from '../../data/types';
import { Avatar } from '../common/Avatar';
import { IconButton } from '../common/IconButton';
import './ConversationHeader.css';

interface ConversationHeaderProps {
  creator: Creator;
  activeNow: boolean;
  onBack: () => void;
  searchOpen: boolean;
  onToggleSearch: () => void;
  onClearRequest: () => void;
}

export function ConversationHeader({
  creator,
  activeNow,
  onBack,
  searchOpen,
  onToggleSearch,
  onClearRequest,
}: ConversationHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  return (
    <div className="conv-head">
      <IconButton
        label="Back to conversations"
        className="conv-head__back"
        onClick={onBack}
      >
        <ArrowLeft />
      </IconButton>

      <Link
        to={`/creators/${creator.handle}`}
        className="conv-head__identity"
        aria-label={`View profile of ${creator.name}`}
      >
        <span className="conv-head__avatar">
          <Avatar src={creator.avatar} alt={creator.name} size={40} ring={activeNow} />
          {activeNow && <span className="conv-head__online" aria-hidden="true" />}
        </span>
        <span className="conv-head__meta">
          <span className="conv-head__name">{creator.name}</span>
          <span className="conv-head__handle">
            @{creator.handle}
            <span className="conv-head__status">
              {activeNow ? (
                <span className="conv-head__status-live">
                  <span className="conv-head__status-dot" aria-hidden="true" /> Active now
                </span>
              ) : (
                'Private conversation'
              )}
            </span>
          </span>
        </span>
      </Link>

      <div ref={menuRef} className="conv-head__menu">
        <IconButton
          label="Conversation options"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
        >
          <MoreHorizontal />
        </IconButton>
        {menuOpen && (
          <div className="conv-head__pop" role="menu" aria-label="Conversation options">
            <Link
              to={`/creators/${creator.handle}`}
              role="menuitem"
              className="conv-head__pop-item"
              onClick={() => setMenuOpen(false)}
            >
              <User size={15} aria-hidden="true" />
              View profile
            </Link>
            <button
              type="button"
              role="menuitem"
              className={`conv-head__pop-item ${searchOpen ? 'is-active' : ''}`}
              onClick={() => {
                onToggleSearch();
                setMenuOpen(false);
              }}
            >
              <Search size={15} aria-hidden="true" />
              Search messages
            </button>
            <button
              type="button"
              role="menuitem"
              className="conv-head__pop-item is-danger"
              onClick={() => {
                setMenuOpen(false);
                onClearRequest();
              }}
            >
              <Eraser size={15} aria-hidden="true" />
              Clear local conversation
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
