import { useState } from 'react';
import { X } from 'lucide-react';
import { createTodoObject, buildTodoArrays, computeTodoStatus } from '../../utils/habitUtils';

// ─────────────────────────────────────────────────────────
// TodoModal — създаване / редакция на еднократна задача
//
// Props:
//   todo     — обектът за редакция, или null за нова
//   onSave   — callback(todoObject)
//   onClose  — затваря модала
// ─────────────────────────────────────────────────────────
export default function TodoModal({ todo, onSave, onClose }) {
  const isEditing = !!todo;

  const [name,          setName]          = useState(todo?.name          ?? '');
  const [description,   setDescription]   = useState(todo?.description   ?? '');
  const [timesPerDay,   setTimesPerDay]   = useState(todo?.timesPerDay   ?? 1);
  const [subtasksCount, setSubtasksCount] = useState(todo?.subtasksCount ?? 0);
  const [subtaskNames,  setSubtaskNames]  = useState(todo?.subtaskNames  ?? []);
  const [error,         setError]         = useState('');

  const handleSubtasksCountChange = (val) => {
    const count = Math.max(0, parseInt(val) || 0);
    setSubtasksCount(count);
    const names = [...subtaskNames];
    while (names.length < count) names.push('');
    setSubtaskNames(names.slice(0, count));
  };

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) { setError('Името е задължително'); return; }

    const times = Math.max(1, parseInt(timesPerDay) || 1);
    const count = Math.max(0, parseInt(subtasksCount) || 0);

    if (isEditing) {
      const { completions, subtasks } = buildTodoArrays(
        { timesPerDay: times, subtasksCount: count, subtaskNames },
        todo
      );
      const updated = {
        ...todo,
        name: trimmed,
        description: description.trim() || null,
        timesPerDay: times,
        subtasksCount: count,
        subtaskNames,
        completions,
        subtasks,
      };
      updated.status = computeTodoStatus(updated);
      if (updated.status !== 'completed') updated.completedAt = null;
      onSave(updated);
      return;
    }

    onSave(createTodoObject({
      name: trimmed,
      description,
      timesPerDay: times,
      subtasksCount: count,
      subtaskNames,
    }));
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
              <label className="block text-sm font-semibold text-gray-700 mb-2">Подзадачи (0 = без подзадачи)</label>
              <input
                type="number" min="0"
                value={subtasksCount}
                onChange={e => handleSubtasksCountChange(e.target.value)}
                onFocus={e => e.target.select()}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-400 focus:outline-none"
              />
              {subtasksCount > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-gray-600">Имена на подзадачите (напр. списък с продукти):</p>
                  {Array.from({ length: subtasksCount }, (_, i) => (
                    <input
                      key={i}
                      type="text"
                      value={subtaskNames[i] ?? ''}
                      onChange={e => {
                        const names = [...subtaskNames];
                        names[i] = e.target.value;
                        setSubtaskNames(names);
                      }}
                      placeholder={`Подзадача ${i + 1}`}
                      maxLength={50}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-indigo-400 focus:outline-none text-sm"
                    />
                  ))}
                  <p className="text-gray-400 text-xs">Ако оставиш празно, ще се номерира автоматично</p>
                </div>
              )}
            </div>

            <p className="text-xs text-gray-500">
              💡 Еднократната задача стои в „Днес“, докато не я отметнеш. Няма правило за повторение и не влиза в календара и статистиката.
            </p>

          </div>
        </div>
      </div>
    </div>
  );
}
