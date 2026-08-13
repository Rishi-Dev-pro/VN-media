import { Mic, Search, Trash2, VolumeX, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCreator } from '../../data/mockCreators';
import type { ConversationSummary } from '../../services/messageRepository';
import { formatRelative, formatTime } from '../../utils/format';
import { Avatar } from '../common/Avatar';
import './ConversationList.css';

/** Demo "active now" visual state (deterministic, mock only). */
const ACTIVE_NOW = new Set(['crea-luna', 'crea-elio']);

interface ConversationListProps {
  conversations: ConversationSummary[];
  loading: boolean;
  /** conversation currently open — highlighted in the split pane */
  activeId?: string;
}

/** Inbox list: search + rows. Rows navigate to /messages/:id. */
export function ConversationList({ conversations, loading, activeId }: ConversationListProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const creator = getCreator(c.creatorId);
      return (
        creator.name.toLowerCase().includes(q) ||
        creator.handle.toLowerCase().includes(q) ||
        (c.preview.kind === 'text' && (c.preview.text ?? '').toLowerCase().includes(q))
      );
    });
  }, [conversations, query]);

  return (
    <div className="conv-list">
      <div className="conv-list__search">
        <Search size={15} aria-hidden="true" className="conv-list__search-icon" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search conversations..."
          aria-label="Search conversations"
        />
        {query && (
          <button
            type="button"
            className="conv-list__search-clear"
            aria-label="Clear search"
            onClick={() => setQuery('')}
          >
            <X size={13} aria-hidden="true" />
          </button>
        )}
      </div>

      <ul className="conv-list__rows" aria-label="Conversations">
        {loading &&
          Array.from({ length: 4 }, (_, i) => (
            <li key={i} className="conv-row conv-row--sk" aria-hidden="true">
              <span className="skeleton conv-row__sk-avatar" />
              <span className="conv-row__sk-body">
                <span className="skeleton conv-row__sk-line" style={{ width: '46%' }} />
                <span className="skeleton conv-row__sk-line" style={{ width: '74%' }} />
              </span>
            </li>
          ))}

        {!loading &&
          filtered.map((conv) => (
            <ConversationRow key={conv.id} conv={conv} active={conv.id === activeId} />
          ))}

        {!loading && filtered.length === 0 && (
          <li className="conv-list__none">
            {query ? 'No conversations match.' : 'No conversations yet.'}
          </li>
        )}
      </ul>
    </div>
  );
}

function ConversationRow({ conv, active }: { conv: ConversationSummary; active: boolean }) {
  const creator = getCreator(conv.creatorId);
  const activeNow = ACTIVE_NOW.has(conv.creatorId);

  return (
    <li>
      <Link
        to={`/messages/${conv.id}`}
        className={`conv-row ${active ? 'is-active' : ''} ${conv.unread > 0 ? 'is-unread' : ''}`}
        aria-current={active ? 'page' : undefined}
      >
        <span className="conv-row__avatar">
          <Avatar src={creator.avatar} alt={creator.name} size={46} ring={activeNow} />
          {activeNow && (
            <span className="conv-row__online" aria-hidden="true" title="Active now" />
          )}
        </span>

        <span className="conv-row__body">
          <span className="conv-row__top">
            <span className="conv-row__name">{creator.name}</span>
            <span className="conv-row__time tabular">
              {conv.lastMessageAt ? formatRelative(new Date(conv.lastMessageAt).toISOString()) : ''}
            </span>
          </span>
          <span className="conv-row__preview">
            {conv.preview.kind === 'audio' && (
              <span className="conv-row__audio">
                <Mic size={12} aria-hidden="true" /> Voice message · {formatTime(conv.preview.duration ?? 0)}
              </span>
            )}
            {conv.preview.kind === 'deleted' && (
              <span className="conv-row__deleted">
                <Trash2 size={12} aria-hidden="true" /> Message deleted
              </span>
            )}
            {conv.preview.kind === 'text' && <span>{conv.preview.text}</span>}
            {conv.muted && <VolumeX size={12} aria-hidden="true" className="conv-row__muted" />}
          </span>
        </span>

        {conv.unread > 0 && (
          <span className="conv-row__badge tabular" aria-label={`${conv.unread} unread`}>
            {conv.unread}
          </span>
        )}
      </Link>
    </li>
  );
}
