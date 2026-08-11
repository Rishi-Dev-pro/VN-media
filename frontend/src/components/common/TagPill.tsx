import { formatCount } from '../../utils/format';
import './TagPill.css';

interface TagPillProps {
  name: string;
  count?: number;
  onClick?: () => void;
}

export function TagPill({ name, count, onClick }: TagPillProps) {
  return (
    <button type="button" className="tag-pill" onClick={onClick}>
      <span className="tag-pill__hash" aria-hidden="true">
        #
      </span>
      <span className="tag-pill__name">{name}</span>
      {count !== undefined && (
        <span className="tag-pill__count tabular">{formatCount(count)}</span>
      )}
    </button>
  );
}
