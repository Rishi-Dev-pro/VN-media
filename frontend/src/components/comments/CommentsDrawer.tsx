import { ArrowUp, Heart, Pencil, Reply, Trash2, X } from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import type { MockComment } from '../../data/mockComments';
import type { VoiceNote } from '../../data/types';
import { getCreator } from '../../data/mockCreators';
import { useComments } from '../../hooks/useComments';
import { useCommentCount } from '../../hooks/useCommentCount';
import { formatCount, formatRelative } from '../../utils/format';
import { Avatar } from '../common/Avatar';
import './CommentsDrawer.css';

/* ============================================================
   Comments — the engagement thread for a VoiceNote.

   UI → useComments → commentRepository (mock). One thread per
   note; root comments carry shallow, readable replies. The user
   can reply, edit and delete only their own comments (the repo
   enforces ownership). Deterministic demo failure:
   `?demo=comment-error`.
   ============================================================ */

interface CommentsDrawerProps {
  note: VoiceNote | null;
  onClose: () => void;
}

interface CommentItemProps {
  comment: MockComment;
  isReply?: boolean;
  mine: boolean;
  editing: boolean;
  editText: string;
  onEditText: (t: string) => void;
  onBeginEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  confirmingDelete: boolean;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  onReply: () => void;
}

function CommentItem({
  comment,
  isReply = false,
  mine,
  editing,
  editText,
  onEditText,
  onBeginEdit,
  onSaveEdit,
  onCancelEdit,
  confirmingDelete,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
  onReply,
}: CommentItemProps) {
  const deleted = comment.status === 'deleted';

  if (editing) {
    return (
      <div className={`comment-row comment-row--edit ${isReply ? 'comment-row--reply' : ''}`}>
        <Avatar src={comment.avatar} alt={comment.authorName} size={isReply ? 30 : 34} />
        <div className="comment-row__body">
          <p className="comment-row__author">
            <span className="comment-row__handle">@{comment.authorHandle}</span>
            <span className="comment-row__editing micro">Editing</span>
          </p>
          <textarea
            className="comment-row__edit-input"
            value={editText}
            onChange={(e) => onEditText(e.target.value)}
            aria-label="Edit comment"
            rows={2}
          />
          <p className="comment-row__edit-actions">
            <button type="button" className="comment-row__edit-save" onClick={onSaveEdit}>
              Save
            </button>
            <button type="button" className="comment-row__edit-cancel" onClick={onCancelEdit}>
              Cancel
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`comment-row ${isReply ? 'comment-row--reply' : ''}`}>
      <Avatar src={comment.avatar} alt={comment.authorName} size={isReply ? 30 : 34} />
      <div className="comment-row__body">
        <p className="comment-row__author">
          <span className="comment-row__handle">@{comment.authorHandle}</span>
          {mine && <span className="comment-row__you micro">You</span>}
          <span className="comment-row__time micro tabular">
            {formatRelative(comment.createdAt, Date.now())}
          </span>
        </p>

        {deleted ? (
          <p className="comment-row__deleted">COMMENT DELETED</p>
        ) : (
          <p className="comment-row__text">{comment.text}</p>
        )}

        {!deleted && (
          <p className="comment-row__foot">
            <button
              type="button"
              className="comment-row__like"
              aria-label={`Like this comment — ${comment.likes}`}
              title="Like comment"
            >
              <Heart size={12} aria-hidden="true" />
              <span className="tabular">{comment.likes}</span>
            </button>
            <button
              type="button"
              className="comment-row__reply"
              onClick={onReply}
              aria-label={`Reply to ${comment.authorName}`}
            >
              <Reply size={12} aria-hidden="true" />
              Reply
            </button>
            {mine && (
              <span className="comment-row__mine">
                <button
                  type="button"
                  className="comment-row__act"
                  onClick={onAskDelete}
                  aria-label="Delete your comment"
                  title="Delete comment"
                >
                  <Trash2 size={13} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="comment-row__act"
                  onClick={onBeginEdit}
                  aria-label="Edit your comment"
                  title="Edit comment"
                >
                  <Pencil size={13} aria-hidden="true" />
                </button>
              </span>
            )}
          </p>
        )}

        {confirmingDelete && (
          <div className="comment-row__confirm">
            <span className="comment-row__confirm-text micro">DELETE COMMENT?</span>
            <button type="button" className="comment-row__confirm-yes" onClick={onConfirmDelete}>
              Delete
            </button>
            <button type="button" className="comment-row__confirm-no" onClick={onCancelDelete}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function CommentsDrawer({ note, onClose }: CommentsDrawerProps) {
  const {
    comments,
    loading,
    loadError,
    actionError,
    submitting,
    currentUser,
    retry,
    submit,
    update,
    remove,
    clearActionError,
  } = useComments(note?.id ?? null);

  const liveCount = useCommentCount(note?.id ?? null, note?.comments ?? 0);

  const [draft, setDraft] = useState('');
  const [replyingTo, setReplyingTo] = useState<MockComment | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const closeRef = useRef<HTMLButtonElement>(null);
  const replyInputRef = useRef<HTMLInputElement>(null);

  // focus on open, lock body scroll, Escape = cancel reply → close
  useEffect(() => {
    if (!note) return;
    closeRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (replyingTo || editingId || confirmingDelete) {
        e.stopPropagation();
        setReplyingTo(null);
        setEditingId(null);
        setConfirmingDelete(null);
      } else {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey, true);
    };
  }, [note, onClose, replyingTo, editingId, confirmingDelete]);

  // autofocus the reply composer when reply mode opens
  useEffect(() => {
    if (!replyingTo) return undefined;
    const t = window.setTimeout(() => replyInputRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [replyingTo]);

  const threads = useMemo(() => {
    const roots = comments.filter((c) => !c.parentCommentId);
    const childrenByRoot = new Map<string, MockComment[]>();
    comments.forEach((c) => {
      if (!c.parentCommentId) return;
      const list = childrenByRoot.get(c.parentCommentId) ?? [];
      list.push(c);
      childrenByRoot.set(c.parentCommentId, list);
    });
    childrenByRoot.forEach((list) =>
      list.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)),
    );
    return { roots, childrenByRoot };
  }, [comments]);

  if (!note) return null;

  const creator = getCreator(note.creatorId);
  const myHandle = currentUser?.handle?.toLowerCase();

  const toggleExpanded = (rootId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(rootId)) next.delete(rootId);
      else next.add(rootId);
      return next;
    });
  };

  const submitComment = (e: FormEvent) => {
    e.preventDefault();
    void submit(draft);
    setDraft('');
  };

  const submitReply = (e: FormEvent) => {
    e.preventDefault();
    if (!replyingTo) return;
    const parent = replyingTo.parentCommentId ?? replyingTo.id;
    void submit(replyDraft, parent);
    setReplyDraft('');
    setReplyingTo(null);
    // keep the thread visible after a reply lands
    setExpanded((prev) => new Set(prev).add(parent));
  };

  const beginEdit = (comment: MockComment) => {
    setEditingId(comment.id);
    setEditText(comment.text);
  };

  const saveEdit = (comment: MockComment) => {
    if (!editText.trim()) return;
    void update(comment.id, editText);
    setEditingId(null);
    setEditText('');
  };

  const confirmDelete = (comment: MockComment) => {
    void remove(comment.id);
    setConfirmingDelete(null);
  };

  const isMine = (comment: MockComment) =>
    myHandle !== undefined && comment.authorHandle.toLowerCase() === myHandle;

  const composerAvatar = currentUser?.avatar ?? '/images/portrait-7.jpg';
  const canPost = draft.trim().length > 0 && !submitting;
  const canPostReply = replyDraft.trim().length > 0 && !submitting;

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
                  {formatCount(liveCount)} {liveCount === 1 ? 'comment' : 'comments'}
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
          ) : loadError ? (
            <div className="comments__state">
              <p className="comments__state-title">COMMENTS UNAVAILABLE.</p>
              <p className="comments__state-body">{loadError}</p>
              <button type="button" className="comments__retry" onClick={() => void retry()}>
                TRY AGAIN
              </button>
            </div>
          ) : comments.length === 0 ? (
            <p className="comments__empty">
              <span className="comments__empty-title">NO THOUGHTS YET.</span>
              <span className="comments__empty-body">Be the first person to leave one.</span>
            </p>
          ) : (
            threads.roots.map((root) => {
              const children = threads.childrenByRoot.get(root.id) ?? [];
              const isOpen = expanded.has(root.id);
              return (
                <div key={root.id} className="comment-thread">
                  <CommentItem
                    comment={root}
                    mine={isMine(root)}
                    editing={editingId === root.id}
                    editText={editText}
                    onEditText={setEditText}
                    onBeginEdit={() => beginEdit(root)}
                    onSaveEdit={() => saveEdit(root)}
                    onCancelEdit={() => setEditingId(null)}
                    confirmingDelete={confirmingDelete === root.id}
                    onAskDelete={() => setConfirmingDelete(root.id)}
                    onCancelDelete={() => setConfirmingDelete(null)}
                    onConfirmDelete={() => confirmDelete(root)}
                    onReply={() => setReplyingTo(root)}
                  />

                  {children.length > 0 && (
                    <button
                      type="button"
                      className="comment-replies-toggle"
                      onClick={() => toggleExpanded(root.id)}
                      aria-expanded={isOpen}
                    >
                      <span className="comment-replies-toggle__line" aria-hidden="true" />
                      {isOpen
                        ? 'Hide replies'
                        : `${children.length} ${children.length === 1 ? 'reply' : 'replies'}`}
                    </button>
                  )}

                  {isOpen &&
                    children.map((child) => (
                      <CommentItem
                        key={child.id}
                        comment={child}
                        isReply
                        mine={isMine(child)}
                        editing={editingId === child.id}
                        editText={editText}
                        onEditText={setEditText}
                        onBeginEdit={() => beginEdit(child)}
                        onSaveEdit={() => saveEdit(child)}
                        onCancelEdit={() => setEditingId(null)}
                        confirmingDelete={confirmingDelete === child.id}
                        onAskDelete={() => setConfirmingDelete(child.id)}
                        onCancelDelete={() => setConfirmingDelete(null)}
                        onConfirmDelete={() => confirmDelete(child)}
                        onReply={() => setReplyingTo(child)}
                      />
                    ))}

                  {replyingTo &&
                    (replyingTo.id === root.id || replyingTo.parentCommentId === root.id) && (
                      <form className="comments__reply-composer" onSubmit={submitReply}>
                        <span className="comments__reply-label micro">
                          Replying to @{replyingTo.authorHandle}
                          <button
                            type="button"
                            className="comments__reply-cancel"
                            onClick={() => setReplyingTo(null)}
                            aria-label="Cancel reply"
                          >
                            Cancel
                          </button>
                        </span>
                        <div className="comments__reply-row">
                          <Avatar src={composerAvatar} alt={currentUser?.name ?? 'You'} size={30} />
                          <input
                            ref={replyInputRef}
                            className="comments__input"
                            type="text"
                            placeholder="Write a reply…"
                            aria-label="Write a reply"
                            value={replyDraft}
                            maxLength={220}
                            onChange={(e) => setReplyDraft(e.target.value)}
                          />
                          <button
                            type="submit"
                            className="comments__send"
                            aria-label="Post reply"
                            disabled={!canPostReply}
                          >
                            <ArrowUp size={16} aria-hidden="true" />
                          </button>
                        </div>
                      </form>
                    )}
                </div>
              );
            })
          )}
        </div>

        <div className="comments__status" role="status" aria-live="polite">
          {actionError && <span className="comments__status-error">{actionError}</span>}
        </div>

        <form className="comments__composer" onSubmit={submitComment}>
          <Avatar src={composerAvatar} alt={currentUser?.name ?? 'You'} size={30} />
          <input
            className="comments__input"
            type="text"
            placeholder="Add a comment…"
            aria-label="Add a comment"
            value={draft}
            maxLength={220}
            onChange={(e) => {
              setDraft(e.target.value);
              clearActionError();
            }}
          />
          <button
            type="submit"
            className="comments__send"
            aria-label="Post comment"
            disabled={!canPost}
          >
            <ArrowUp size={16} aria-hidden="true" />
          </button>
        </form>
        <p className="comments__note micro">Demo — comments live only in this session.</p>
      </section>
    </div>
  );
}
