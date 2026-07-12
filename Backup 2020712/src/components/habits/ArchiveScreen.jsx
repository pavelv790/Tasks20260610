import { useState } from 'react';
import { ArchiveRestore, Trash2 } from 'lucide-react';
import DeleteModal  from '../ui/DeleteModal';
import ConfirmModal from '../ui/ConfirmModal';
import { MONTH_NAMES_BG } from '../../utils/dateUtils';

const formatArchiveDate = (ts) => {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTH_NAMES_BG[d.getMonth()]} ${d.getFullYear()}`;
};

export default function ArchiveScreen({ archivedHabits, onUnarchive, onDelete }) {
  const [unarchiveTarget, setUnarchiveTarget] = useState(null);
  const [deleteTarget,    setDeleteTarget]    = useState(null);

  if (archivedHabits.length === 0) {
    return (
      <div className="bg-white rounded-3xl shadow-xl p-12 text-center">
        <div className="text-6xl mb-4">📦</div>
        <p className="text-xl font-semibold text-gray-700 mb-2">Архивът е празен</p>
        <p className="text-gray-500">Архивираните задачи ще се появят тук.</p>
      </div>
    );
  }

  const sorted = [...archivedHabits].sort((a, b) => b.archivedAt - a.archivedAt);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-lg p-4 text-center">
        <p className="text-sm text-gray-600">
          📦 Архивирани задачи: <span className="font-bold">{archivedHabits.length}</span>
        </p>
      </div>

      <div className="space-y-3">
        {sorted.map(entry => (
          <div
            key={entry.archivedAt}
            className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl shadow-lg p-4"
          >
            {/* Горен ред — име */}
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: entry.habit.color }}
                />
                <h3 className="font-bold text-gray-800 break-words">{entry.habit.name}</h3>
              </div>
            </div>

            {/* Информация */}
            <div className="space-y-1 text-sm text-gray-600 mb-3">
              <p>📅 Архивирано на: {formatArchiveDate(entry.archivedAt)}</p>
              <p>🔄 {entry.habit.timesPerDay}x на ден</p>
              {entry.habit.subtasksCount > 0 && (
                <p>📋 {entry.habit.subtasksCount} подзадачи</p>
              )}
              {entry.tasks.length > 0 && (
                <p>📊 {entry.tasks.filter(t => t.status === 'completed').length} завършени от {entry.tasks.length} задачи</p>
              )}
            </div>

            {/* Бутони */}
            <div className="flex gap-2">
              <button
                onClick={() => setUnarchiveTarget(entry)}
                className="flex-1 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:shadow-lg transition-shadow"
              >
                <ArchiveRestore className="w-4 h-4" />
                Върни
              </button>
              <button
                onClick={() => setDeleteTarget(entry)}
                className="py-2 px-4 bg-red-100 text-red-600 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-red-200 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {unarchiveTarget && (
        <ConfirmModal
          title="Върни от архив"
          message={`"${unarchiveTarget.habit.name}" ще бъде върната като активна задача.\n\nВсичките й записи ще бъдат възстановени.`}
          confirmLabel="Върни"
          onConfirm={() => { onUnarchive(unarchiveTarget.archivedAt); setUnarchiveTarget(null); }}
          onClose={() => setUnarchiveTarget(null)}
        />
      )}

      {deleteTarget && (
        <DeleteModal
          title="Изтриване от архив"
          message={`Сигурни ли сте? "${deleteTarget.habit.name}" и всичките й записи ще бъдат изтрити завинаги.`}
          onConfirm={() => { onDelete(deleteTarget.archivedAt); setDeleteTarget(null); }}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}