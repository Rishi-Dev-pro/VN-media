import { Hash, Mic2, Music2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { getCreator } from '../../data/mockCreators';
import type { SearchResults } from '../../services/searchRepository';
import { highlight } from './HighlightText';
import './SearchSuggestions.css';

interface SearchSuggestionsProps {
  query: string;
  results: SearchResults;
  onPick: (q: string) => void;
}

function Row({
  icon,
  kind,
  children,
  onClick,
}: {
  icon: ReactNode;
  kind: string;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="sugg-row"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      <span className="sugg-row__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="sugg-row__kind micro">{kind}</span>
      <span className="sugg-row__text">{children}</span>
    </button>
  );
}

export function SearchSuggestions({ query, results, onPick }: SearchSuggestionsProps) {
  const hasAny =
    results.creators.length > 0 ||
    results.voiceNotes.length > 0 ||
    results.tags.length > 0;

  if (!hasAny) return null;

  return (
    <div className="sugg" role="presentation">
      <p className="sugg__heading micro">Searching for “{query.trim()}”</p>
      {results.creators.map((c) => (
        <Row
          key={c.id}
          icon={<Mic2 size={15} />}
          kind="Creator"
          onClick={() => onPick(`@${c.handle}`)}
        >
          {highlight(`@${c.handle}`, query)} <span className="sugg-row__sub">{c.name}</span>
        </Row>
      ))}
      {results.voiceNotes.map((n) => (
        <Row
          key={n.id}
          icon={<Music2 size={15} />}
          kind="VoiceNote"
          onClick={() => onPick(n.title)}
        >
          {highlight(n.title, query)}{' '}
          <span className="sugg-row__sub">@{getCreator(n.creatorId).handle}</span>
        </Row>
      ))}
      {results.tags.map((t) => (
        <Row
          key={t.name}
          icon={<Hash size={15} />}
          kind="Tag"
          onClick={() => onPick(`#${t.name}`)}
        >
          {highlight(`#${t.name}`, query)}
        </Row>
      ))}
    </div>
  );
}
