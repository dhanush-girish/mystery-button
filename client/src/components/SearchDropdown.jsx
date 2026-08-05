import { useState, useRef, useEffect } from 'react';

function SearchDropdown({ options, value, onChange, placeholder }) {
  const [query, setQuery] = useState(value || '');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const wrapperRef = useRef(null);

  const filtered = options.filter(
    (opt) => opt && opt.toLowerCase().includes(query.toLowerCase())
  );

  // Sync external value changes
  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (option) => {
    onChange(option);
    setQuery(option);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    onChange(''); // Clear selection while typing
    setIsOpen(true);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filtered.length) {
          handleSelect(filtered[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
      default:
        break;
    }
  };

  return (
    <div className="search-dropdown" ref={wrapperRef}>
      <input
        type="text"
        className="form-input"
        value={query}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
      />
      {isOpen && filtered.length > 0 && (
        <ul className="dropdown-list">
          {filtered.map((opt, i) => (
            <li
              key={opt}
              className={`dropdown-item${i === highlightedIndex ? ' highlighted' : ''}${opt === value ? ' selected' : ''}`}
              onMouseDown={() => handleSelect(opt)}
              onMouseEnter={() => setHighlightedIndex(i)}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
      {isOpen && query && filtered.length === 0 && (
        <div className="dropdown-empty">No matches found</div>
      )}
    </div>
  );
}

export default SearchDropdown;
