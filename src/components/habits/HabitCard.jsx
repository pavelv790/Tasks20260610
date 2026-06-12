import { useState } from 'react';
import { Edit2, Trash2, Archive } from 'lucide-react';

export default function HabitCard({
  habit,
  onEdit,
  onDelete,
  onArchive,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}) {
  const [showFullName, setShowFullName] = useState(false);

  const ringClass = habit.isDefault ? 'ring-2 ring-indigo-500' : '';

  return (
    <>
      <div
        draggable
        onDragStart={e => onDragStart(e, habit)}
        onDragOver={e => onDragOver(e, habit)}
        onDrop={e => onDrop(e, habit)}
        className={`bg-gradient-to-br from-blue-100 to-cyan-100 rounded-2xl shadow-lg p-3 hover:shadow-xl transition-all ${ringClass} ${isDragging ? 'opacity-50 scale-95' : ''}`}
      >
        {/* Горен ред — drag handle + име */}
        <div className="flex items-start gap-2 mb-2">
          <span className="text-gray-400 cursor-grab active:cursor-grabbing text-lg leading-none pt-0.5">
            ⋮⋮
          </span>
          <div className="flex-1 cursor-pointer" onClick={() => setShowFullName(true)}>
            <h3 className="font-bold text-gray-800 break-words line-clamp-2">
              {habit.name}
            </h3>
            {habit.isDefault && (
              <span className="text-xs text-indigo-600 font-semibold">★ Основна</span>
            )}
          </div>
        </div>

        {/* Долен ред — бутони */}
        <div className="flex items-center justify-end gap-0.5 mb-2">
          <button
            onClick={onMoveUp}
            disabled={isFirst}
            className="p-1.5 hover:bg-white hover:bg-opacity-50 rounded-lg transition-colors disabled:opacity-30"
            title="Премести нагоре"
          >
            ▲
          </button>
          <button
            onClick={onMoveDown}
            disabled={isLast}
            className="p-1.5 hover:bg-white hover:bg-opacity-50 rounded-lg transition-colors disabled:opacity-30"
            title="Премести надолу"
          >
            ▼
          </button>
          <button
            onClick={() => onEdit(habit)}
            className="p-1.5 hover:bg-white hover:bg-opacity-50 rounded-lg transition-colors"
            title="Редактирай"
          >
            <Edit2 className="w-3.5 h-3.5 text-gray-600" />
          </button>
          <button
            onClick={() => onArchive(habit)}
            className="p-1.5 hover:bg-yellow-50 rounded-lg transition-colors"
            title="Архивирай"
          >
            <Archive className="w-3.5 h-3.5 text-yellow-600" />
          </button>
          <button
            onClick={() => onDelete(habit)}
            className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
            title="Изтрий"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-500" />
          </button>
        </div>

        {/* Информация */}
        <div className="space-y-1 text-sm text-gray-600">
          <p>🔄 {habit.timesPerDay}x на ден</p>
          {habit.subtasksCount > 0 && <p>📋 {habit.subtasksCount} подзадачи</p>}
          {habit.reminderTime && <p>🔔 {habit.reminderTime}</p>}
        </div>
      </div>

      {/* Попъп с пълното име */}
      {showFullName && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setShowFullName(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-bold text-gray-800 text-lg mb-4 break-words">{habit.name}</h3>
            <button
              onClick={() => setShowFullName(false)}
              className="w-full px-4 py-2 bg-indigo-500 text-white rounded-xl font-semibold"
            >
              Затвори
            </button>
          </div>
        </div>
      )}
    </>
  );
}
