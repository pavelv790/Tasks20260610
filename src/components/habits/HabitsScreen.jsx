import { useState, useEffect } from 'react';
import { Plus, Search } from 'lucide-react';
import HabitCard    from './HabitCard';
import HabitModal   from './HabitModal';
import DeleteModal  from '../ui/DeleteModal';
import AlertModal   from '../ui/AlertModal';
import ConfirmModal from '../ui/ConfirmModal';

export default function HabitsScreen({ habits, rules, onSave, onDelete, onArchive, onReorder }) {
  const [showModal,     setShowModal]     = useState(false);
  const [editing,       setEditing]       = useState(null);
  const [deleteTarget,  setDeleteTarget]  = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [showAlert,     setShowAlert]     = useState(false);
  const [draggedId,     setDraggedId]     = useState(null);
  const [searchQuery,   setSearchQuery]   = useState('');

  useEffect(() => {
    const withoutOrder = habits.filter(h => h.order === undefined || h.order === null);
    if (withoutOrder.length === 0) return;
    const maxOrder = habits.reduce((max, h) => Math.max(max, h.order ?? -1), -1);
    const updated  = habits.map(h =>
      h.order == null ? { ...h, order: maxOrder + 1 + withoutOrder.indexOf(h) } : h
    );
    onReorder(updated);
  }, [habits.length]);

  const hasManualOrder = habits.some(h => h.manualOrder != null);
  const sorted = [...habits].sort((a, b) => {
    if (hasManualOrder) {
      const oa = a.manualOrder ?? 999, ob = b.manualOrder ?? 999;
      if (oa !== ob) return oa - ob;
    }
    return a.name.localeCompare(b.name, 'bg');
  });
  const isSearching = searchQuery.trim().length > 0;
  const filteredSorted = isSearching
    ? sorted.filter(h => h.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : sorted;
  const moveHabit = (habitId, direction) => {
    const idx = sorted.findIndex(h => h.id === habitId);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= sorted.length) return;
    const reordered = [...sorted];
    const [moved] = reordered.splice(idx, 1);
    reordered.splice(newIdx, 0, moved);
    onReorder(habits.map(h => ({ ...h, manualOrder: reordered.findIndex(r => r.id === h.id) })));
  };

  const handleDragStart = (e, habit) => {
    setDraggedId(habit.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, habit) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, target) => {
    e.preventDefault();
    if (!draggedId || draggedId === target.id) { setDraggedId(null); return; }
    const dragIdx   = sorted.findIndex(h => h.id === draggedId);
    const targetIdx = sorted.findIndex(h => h.id === target.id);
    const reordered = [...sorted];
    const [moved]   = reordered.splice(dragIdx, 1);
    reordered.splice(targetIdx, 0, moved);
    onReorder(habits.map(h => ({ ...h, manualOrder: reordered.findIndex(r => r.id === h.id) })));
    setDraggedId(null);
  };

  const handleSave = (habit, rule, applyToAll) => {
    onSave(habit, rule, applyToAll);
    setShowModal(false);
    setEditing(null);
  };

  const handleDeleteRequest = (habit) => {
    if (habits.length === 1) { setShowAlert(true); return; }
    setDeleteTarget(habit);
  };

  return (
    <div className="space-y-4">
      <button
        onClick={() => { setEditing(null); setShowModal(true); }}
        className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl flex items-center justify-center gap-2 transition-shadow"
      >
        <Plus className="w-6 h-6" />
        Добави задача
      </button>

      <p className="text-xs text-gray-600 text-center">
        💡 Дръпни с drag-and-drop за пренареждане
      </p>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Търси задача..."
          className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-400 focus:outline-none bg-white"
        />
      </div>

      {habits.length === 0 ? (
        <div className="bg-white rounded-3xl shadow-xl p-12 text-center">
          <div className="text-6xl mb-4">📁</div>
          <p className="text-xl font-semibold text-gray-700 mb-2">Няма задачи</p>
          <p className="text-gray-500">Добавете първата си задача!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSorted.length === 0 ? (
            <p className="text-center text-gray-500 py-6">Няма намерени задачи</p>
          ) : filteredSorted.map(habit => (
            <HabitCard
              key={habit.id}
              habit={habit}
              onEdit={h => { setEditing(h); setShowModal(true); }}
              onDelete={handleDeleteRequest}
              onArchive={h => setArchiveTarget(h)}
              onDragStart={isSearching ? () => {} : handleDragStart}
              onDragOver={isSearching ? () => {} : handleDragOver}
              onDrop={isSearching ? () => {} : handleDrop}
              isDragging={draggedId === habit.id}
              onMoveUp={() => moveHabit(habit.id, -1)}
              onMoveDown={() => moveHabit(habit.id, 1)}
              isFirst={isSearching ? true : sorted.indexOf(habit) === 0}
              isLast={isSearching ? true : sorted.indexOf(habit) === sorted.length - 1}
            />
          ))}
        </div>
      )}

      {showModal && (
        <HabitModal
          habit={editing}
          existingRule={editing ? rules.find(r => r.habitId === editing.id && r.isActive) : null}
          habits={habits}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditing(null); }}
        />
      )}

      {deleteTarget && (
        <DeleteModal
          title="Изтриване на задача"
          message={`Сигурни ли сте? Всички записи за "${deleteTarget.name}" ще бъдат изтрити завинаги.`}
          onConfirm={() => { onDelete(deleteTarget.id); setDeleteTarget(null); }}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      {archiveTarget && (
        <ConfirmModal
          title="Архивиране на задача"
          message={`"${archiveTarget.name}" ще бъде преместена в Архив.\n\nЩе можеш да я върнеш по всяко време.`}
          confirmLabel="Архивирай"
          onConfirm={() => { onArchive(archiveTarget.id); setArchiveTarget(null); }}
          onClose={() => setArchiveTarget(null)}
        />
      )}

      {showAlert && (
        <AlertModal
          title="ℹ️ Информация"
          message="Не може да изтриете последната задача!"
          onClose={() => setShowAlert(false)}
        />
      )}
    </div>
  );
}