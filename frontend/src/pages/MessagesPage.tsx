import { MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ConversationList } from '../components/messages/ConversationList';
import { EmptyState } from '../components/common/EmptyState';
import { useMessages } from '../hooks/useMessages';
import './MessagesPage.css';

export default function MessagesPage() {
  const { conversations, loading, error, retry, unreadTotal } = useMessages();

  return (
    <div className="messages-page">
      <header className="messages-head">
        <div>
          <span className="messages-head__eyebrow micro">Private space</span>
          <h1 className="messages-head__title">
            PRIVATE
            <br />
            <span className="text-ghost">CONVERSATIONS.</span>
          </h1>
          <p className="messages-head__sub">Your conversations, away from the noise.</p>
        </div>
        <span className="messages-head__badge">
          <span className="messages-head__badge-dot" aria-hidden="true" />
          PRIVATE SPACE
          {unreadTotal > 0 && <span className="messages-head__unread tabular">{unreadTotal}</span>}
        </span>
      </header>

      {!loading && !error && conversations.length === 0 && (
        <EmptyState
          icon={<MessageCircle size={26} />}
          title="NO CONVERSATIONS YET."
          body="Find a creator whose voice you want to keep close."
          action={
            <Link to="/creators" className="btn btn--primary">
              EXPLORE CREATORS
            </Link>
          }
        />
      )}

      {!loading && error && (
        <EmptyState
          icon={<span className="messages-page__orb" aria-hidden="true">✕</span>}
          title="CONVERSATIONS LOST THE SIGNAL."
          body="Something interrupted your private space."
          action={
            <button type="button" className="btn btn--primary" onClick={retry}>
              TRY AGAIN
            </button>
          }
        />
      )}

      {!error && (
        <ConversationList conversations={conversations} loading={loading} />
      )}
    </div>
  );
}
