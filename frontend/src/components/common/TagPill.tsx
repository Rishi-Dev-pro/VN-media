import { formatCount } from '../../utils/format';
import './TagPill.css';

interface TagPillProps {
  name: string;
  count?: number;
}

export function TagPill({ name, count }: TagPillProps) {
  return (
    <button type="button" className="tag-pill">
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
