import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown } from 'lucide-react';

export default function SearchableSelect({ options, value, onChange, placeholder = 'Избери...' }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find(o => o.id === value);
  const filtered = query.trim()
    ? options.filter(o => o.name.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-400 focus:outline-none font-semibold bg-white flex items-center justify-between"
      >
        <span>{selected ? selected.name : placeholder}</span>
        <ChevronDown className="w-5 h-5 text-gray-400" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white border-2 border-gray-200 rounded-xl shadow-lg max-h-72 overflow-y-auto">
          <div className="relative p-2 border-b border-gray-100">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Търси..."
              className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-indigo-400 focus:outline-none"
            />
          </div>
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-gray-500 py-4">Няма намерени задачи</p>
          ) : filtered.map(o => (
            <button
              key={o.id}
              type="button"
              onClick={() => { onChange(o.id); setOpen(false); setQuery(''); }}
              className={`w-full text-left px-4 py-2 hover:bg-indigo-50 font-medium ${o.id === value ? 'bg-indigo-100' : ''}`}
            >
              {o.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
