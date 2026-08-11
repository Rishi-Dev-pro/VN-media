import { Search, X } from 'lucide-react';
import { forwardRef } from 'react';
import './SearchInput.css';

interface SearchInputProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  placeholder?: string;
  maxLength?: number;
}

/** The centerpiece search field. Enter commits, Esc clears. */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput(
    { value, onChange, onSubmit, onClear, placeholder = 'Search voices, creators, albums…', maxLength = 100 },
    ref,
  ) {
    return (
      <form
        className={`search-field ${value ? 'has-value' : ''}`}
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <label className="search-field__label" htmlFor="vn-search">
          Search VN-Media
        </label>
        <Search className="search-field__icon" size={20} aria-hidden="true" strokeWidth={1.8} />
        <input
          ref={ref}
          id="vn-search"
          type="search"
          className="search-field__input"
          value={value}
          placeholder={placeholder}
          maxLength={maxLength}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              onClear();
            }
          }}
        />
        {value && (
          <button
            type="button"
            className="search-field__clear"
            aria-label="Clear search"
            onClick={onClear}
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
        <span className="search-field__hint micro" aria-hidden="true">
          /
        </span>
      </form>
    );
  },
);
