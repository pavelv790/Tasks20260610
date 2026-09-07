import { useState } from 'react';
import { X } from 'lucide-react';
import { createTodoObject, buildTodoArrays, computeTodoStatus } from '../../utils/habitUtils';
import SubtaskEditor from '../ui/SubtaskEditor';

// ─────────────────────────────────────────────────────────
// TodoModal — създаване / редакция на еднократна задача
//
// Props:
//   todo     — обектът за редакция, или null за нова
//   date     — денят (YYYY-MM-DD), за който се създава нова задача
//   onSave   — callback(todoObject)
//   onClose  — затваря модала
// ─────────────────────────────────────────────────────────
export default function TodoModal({ todo, date, onSave, onClose }) {
  const isEditing = !!todo;

  const [name,          setName]          = useState(todo?.name          ?? '');
  const [description,   setDescription]   = useState(todo?.description   ?? '');
  const [timesPerDay,   setTimesPerDay]   = useState(todo?.timesPerDay   ?? 1);
  const [subtaskNames,  setSubtaskNames]  = useState(todo?.subtaskNames  ?? []);
  const [error,         setError]         = useState('');

  // ── Неактивност ──────────────────────────────────────
  const [inactive,            setInactive]            = useState(todo?.inactive ?? false);
  const [inactiveCompletions, setInactiveCompletions] = useState((todo?.completions ?? []).filter(c => c.inactive).map(c => c.index));
  const [inactiveSubtasks,    setInactiveSubtasks]    = useState((todo?.subtasks ?? []).filter(s => s.inactive).map(s => s.index));
  const toggleInList = (list, setList, idx) =>
    setList(list.includes(idx) ? list.filter(i => i !== idx) : [...list, idx]);
  const applyInactiveFlag = (arr, indices) => {
    const set = new Set(indices);
    return arr.map(el => {
      if (set.has(el.index)) return { ...el, inactive: true };
      if (!el.inactive) return el;
      const copy = { ...el };
      delete copy.inactive;
      return copy;
    });
  };

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) { setError('Името е задължително'); return; }

    const times = Math.max(1, parseInt(timesPerDay) || 1);
    const count = subtaskNames.length;
    const validCompletions = inactiveCompletions.filter(i => i >= 1 && i <= times);
    const validSubtasks    = inactiveSubtasks.filter(i => i >= 1 && i <= count);

    if (isEditing) {
      const { completions, subtasks } = buildTodoArrays(
        { timesPerDay: times, subtasksCount: count, subtaskNames },
        todo
      );
      const updated = {
        ...todo,
        date: todo.date ?? date,
        name: trimmed,
        description: description.trim() || null,
        timesPerDay: times,
        subtasksCount: count,
        subtaskNames,
        completions: applyInactiveFlag(completions, validCompletions),
        subtasks: applyInactiveFlag(subtasks, validSubtasks),
        inactive,
      };
      updated.status = computeTodoStatus(updated);
      if (updated.status !== 'completed') updated.completedAt = null;
      onSave(updated);
      return;
    }

    const created = createTodoObject({
      name: trimmed,
      description,
      timesPerDay: times,
      subtasksCount: count,
      subtaskNames,
      date,
    });
    created.completions = applyInactiveFlag(created.completions, validCompletions);
    created.subtasks = applyInactiveFlag(created.subtasks, validSubtasks);
    created.inactive = inactive;
    created.status = computeTodoStatus(created);
    onSave(created);
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-cyan-400 via-teal-300 to-emerald-300 bg-opacity-90 flex items-center justify-center p-4 z-50">
      <div className="bg-gradient-to-br from-blue-100 to-purple-100 rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">

          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-800">
              {isEditing ? 'Редактирай еднократна задача' : 'Нова еднократна задача'}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex gap-3 mb-6">
            <button onClick={onClose} className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300">
              Откажи
            </button>
            <button onClick={handleSubmit} className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-semibold hover:shadow-lg">
              Запази
            </button>
          </div>

          {error && <p className="text-red-500 text-sm mb-4 font-semibold">{error}</p>}

          <div className="space-y-5">

            {/* Име */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Име на задачата</label>
              <input
                type="text"
                value={name}
                onChange={e => { setName(e.target.value); setError(''); }}
                onFocus={e => e.target.select()}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-400 focus:outline-none"
                placeholder="Напр. Супермаркет"
                autoFocus
              />
            </div>

            {/* Описание */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Описание (незадължително)</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                onFocus={e => e.target.select()}
                rows={2}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-400 focus:outline-none resize-none"
                placeholder="Напр. преди да затворят"
              />
            </div>

            {/* Пъти на ден */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Колко пъти да се изпълни?</label>
              <input
                type="number" min="1"
                value={timesPerDay}
                onChange={e => setTimesPerDay(Math.max(1, parseInt(e.target.value) || 1))}
                onFocus={e => e.target.select()}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-400 focus:outline-none"
              />
            </div>

            {/* Подзадачи */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Подзадачи (напр. списък с продукти)</label>
              <SubtaskEditor names={subtaskNames} onChange={setSubtaskNames} />
            </div>

            {/* Активност */}
            <div className="border-2 border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-gray-700">Задачата е неактивна</span>
                  <p className="text-xs text-gray-500">Вижда се в „Днес", но е заключена и не се брои.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setInactive(p => !p)}
                  className={`relative w-14 h-8 rounded-full transition-colors flex-shrink-0 ${inactive ? 'bg-gradient-to-r from-slate-500 to-slate-600' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 ${inactive ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              {!inactive && Math.max(1, parseInt(timesPerDay) || 1) > 1 && (
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-1">Неактивни повторения</p>
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: Math.max(1, parseInt(timesPerDay) || 1) }, (_, i) => i + 1).map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => toggleInList(inactiveCompletions, setInactiveCompletions, n)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                          inactiveCompletions.includes(n)
                            ? 'bg-slate-500 text-white'
                            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!inactive && subtaskNames.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-1">Неактивни подзадачи</p>
                  <div className="space-y-1">
                    {subtaskNames.map((nm, i) => {
                      const idx = i + 1;
                      const off = inactiveSubtasks.includes(idx);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => toggleInList(inactiveSubtasks, setInactiveSubtasks, idx)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-between ${
                            off ? 'bg-slate-500 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          <span>{nm || `Подзадача ${idx}`}</span>
                          <span className="text-xs">{off ? '⏸ неактивна' : '▶ активна'}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <p className="text-xs text-gray-500">
              💡 Задачата се добавя за избрания ден и стои там, докато не я отметнеш. Ако денят ѝ мине неотметната, се показва и в „Днес“. Няма правило за повторение и не влиза в календара и статистиката.
            </p>

          </div>
        </div>
      </div>
    </div>
  );
}
