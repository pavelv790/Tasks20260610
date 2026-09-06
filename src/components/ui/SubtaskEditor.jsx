import { useState, useRef, useEffect } from 'react';

// ─────────────────────────────────────────────────────────
// SubtaskEditor — редактор на подзадачи без поле за брой.
// Бутон „Добави подзадача" → нов ред с автофокус; ✕ маха ред;
// ▲▼ пренареждат. Броят е просто дължината на списъка.
//
// Props:
//   names     — string[]  (началните имена)
//   onChange  — (string[]) => void  (вика се при всяка промяна)
// ─────────────────────────────────────────────────────────

let seq = 0;
const mkId = () => `st_${Date.now()}_${seq++}`;

export default function SubtaskEditor({ names = [], onChange }) {
  const [items, setItems] = useState(() => names.map(n => ({ id: mkId(), name: n ?? '' })));
  const focusId = useRef(null);
  const inputs  = useRef({});

  useEffect(() => {
    if (focusId.current && inputs.current[focusId.current]) {
      inputs.current[focusId.current].focus();
    }
    focusId.current = null;
  });

  const commit = (next) => {
    setItems(next);
    onChange(next.map(i => i.name));
  };

  const add = () => {
    const item = { id: mkId(), name: '' };
    focusId.current = item.id;
    commit([...items, item]);
  };
  const remove = (id)          => commit(items.filter(i => i.id !== id));
  const rename = (id, name)    => commit(items.map(i => (i.id === id ? { ...i, name } : i)));
  const move   = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[idx], next[j]] = [next[j], next[idx]];
    commit(next);
  };

  return (
    <div className="space-y-2">
      {items.map((it, idx) => (
        <div key={it.id} className="flex items-center gap-1">
          <div className="flex flex-col">
            <button
              type="button"
              onClick={() => move(idx, -1)}
              disabled={idx === 0}
              className="px-1 text-xs leading-none text-gray-500 hover:text-gray-800 disabled:opacity-25"
              title="Нагоре"
            >▲</button>
            <button
              type="button"
              onClick={() => move(idx, 1)}
              disabled={idx === items.length - 1}
              className="px-1 text-xs leading-none text-gray-500 hover:text-gray-800 disabled:opacity-25"
              title="Надолу"
            >▼</button>
          </div>
          <input
            ref={el => { inputs.current[it.id] = el; }}
            type="text"
            value={it.name}
            onChange={e => rename(it.id, e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
            placeholder={`Подзадача ${idx + 1}`}
            maxLength={50}
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:border-indigo-400 focus:outline-none text-sm"
          />
          <button
            type="button"
            onClick={() => remove(it.id)}
            className="px-2 py-2 text-red-500 hover:bg-red-50 rounded-lg leading-none"
            title="Премахни"
          >✕</button>
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm font-semibold text-gray-600 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
      >
        ＋ Добави подзадача
      </button>

      {items.length > 0 && (
        <p className="text-gray-400 text-xs">Празно име → автоматично „Подзадача N“</p>
      )}
    </div>
  );
}
