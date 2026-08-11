import { ArrowUp, Heart, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { VoiceNote } from '../../data/types';
import { getCreator } from '../../data/mockCreators';
import { DEMO_NOW } from '../../data/mockFollowing';
import { useComments } from '../../hooks/useComments';
import { formatRelative } from '../../utils/format';
import { Avatar } from '../common/Avatar';
import './CommentsDrawer.css';

interface CommentsDrawerProps {
  note: VoiceNote | null;
  onClose: () => void;
}

/** UI-only comments thread — local mock data, no backend. */
export function CommentsDrawer({ note, onClose }: CommentsDrawerProps) {
  const { comments, loading, addLocal } = useComments(note?.id ?? null, note?.releasedAt);
  const [draft, setDraft] = useState('');
  const closeRef = useRef<HTMLButtonElement>(null);

  // focus the panel on open, lock body scroll, close on Escape
  useEffect(() => {
    if (!note) return;
    closeRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [note, onClose]);

  if (!note) return null;

  const creator = getCreator(note.creatorId);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    addLocal(draft);
    setDraft('');
  };

  return (
    <div className="comments">
      <div className="comments__backdrop" onClick={onClose} aria-hidden="true" />
      <section
        className="comments__panel"
        role="dialog"
        aria-modal="true"
        aria-label={`Comments on ${note.title}`}
      >
        <header className="comments__head">
          <span className="comments__track">
            <img src={note.cover} alt="" width={44} height={44} />
            <span className="comments__track-meta">
              <span className="comments__track-title">{note.title}</span>
              <span className="comments__track-handle">
                @{creator.handle} ·{' '}
                <span className="tabular">
                  {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
                </span>
              </span>
            </span>
          </span>
          <button
            ref={closeRef}
            type="button"
            className="comments__close"
            aria-label="Close comments"
            onClick={onClose}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="comments__list" tabIndex={-1}>
          {loading ? (
            <div className="comments__loading" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="comment-row comment-row--sk">
                  <div className="skeleton comment-row__sk-avatar" />
                  <div className="comment-row__sk-body">
                    <div className="skeleton comment-row__sk-line" style={{ width: '38%' }} />
                    <div className="skeleton comment-row__sk-line" style={{ width: '82%' }} />
                    <div className="skeleton comment-row__sk-line" style={{ width: '24%' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : comments.length === 0 ? (
            <p className="comments__empty micro">No comments yet — say something.</p>
          ) : (
            comments.map((c) => (
              <article key={c.id} className="comment-row">
                <Avatar src={c.avatar} alt={c.authorName} size={34} />
                <div className="comment-row__body">
                  <p className="comment-row__author">
                    <span className="comment-row__handle">@{c.authorHandle}</span>
                    <span className="comment-row__time micro tabular">
                      {formatRelative(c.createdAt, DEMO_NOW)}
                    </span>
                  </p>
                  <p className="comment-row__text">{c.text}</p>
                  <p className="comment-row__foot">
                    <button
                      type="button"
                      className="comment-row__like"
                      aria-label={`Like this comment — ${c.likes}`}
                    >
                      <Heart size={12} aria-hidden="true" />
                      <span className="tabular">{c.likes}</span>
                    </button>
                    {c.replies > 0 && (
                      <span className="comment-row__replies micro">
                        {c.replies} {c.replies === 1 ? 'reply' : 'replies'}
                      </span>
                    )}
                  </p>
                </div>
              </article>
            ))
          )}
        </div>

        <form className="comments__composer" onSubmit={submit}>
          <Avatar src="/images/portrait-7.jpg" alt="You" size={30} />
          <input
            className="comments__input"
            type="text"
            placeholder="Add a comment…"
            aria-label="Add a comment"
            value={draft}
            maxLength={220}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button
            type="submit"
            className="comments__send"
            aria-label="Post comment"
            disabled={!draft.trim()}
          >
            <ArrowUp size={16} aria-hidden="true" />
          </button>
        </form>
        <p className="comments__note micro">Demo — comments live only in this session.</p>
      </section>
    </div>
  );
}
