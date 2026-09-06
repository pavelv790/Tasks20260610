import { useState } from 'react';
import { Plus } from 'lucide-react';
import { getEffectiveStatus, getProgressText, isTaskCompleted } from '../../utils/habitUtils';
import { formatDate } from '../../utils/dateUtils';
import TaskActions from './TaskActions';
import TodoModal from './TodoModal';
import Toast from '../ui/Toast';

// ─────────────────────────────────────────────────────────
// TodoList — секция с еднократни задачи в екран „Днес"
//
// Props:
//   todos        — масив с еднократни задачи
//   dateStr      — денят, който се разглежда (YYYY-MM-DD)
//   isToday      — true ако dateStr е днес
//   onSave       — callback(todo) — upsert по id (създаване/редакция/прогрес/върни)
//   onDelete     — callback(id)
//   searchQuery  — текущият текст в търсачката на „Днес"
// ─────────────────────────────────────────────────────────
export default function TodoList({ todos, dateStr, isToday = false, onSave, onDelete, searchQuery = '' }) {
  const [showCreate,  setShowCreate]  = useState(false);
  const [editingTodo, setEditingTodo] = useState(null);   // todo в режим редакция
  const [actionTodo,  setActionTodo]  = useState(null);   // todo с отворен прозорец за действия
  const [completingId, setCompletingId] = useState(null); // id на todo с анимация „изчезва"
  const [undoTodo, setUndoTodo]       = useState(null);    // snapshot за toast „Върни"

  const isSearching = searchQuery.trim().length > 0;
  const q = searchQuery.trim().toLowerCase();
  const todayStr = formatDate(new Date());

  const belongsHere = (t) => {
    const d = t.date ?? todayStr;
    if (d === dateStr) return true;
    // Просрочените неотметнати се „пренасят" и се показват в „Днес"
    if (isToday && d < todayStr && t.status !== 'completed') return true;
    return false;
  };

  const visibleTodos = todos
    .filter(t => t.status !== 'completed' || t.id === completingId)
    .filter(belongsHere)
    .filter(t => !isSearching || t.name.toLowerCase().includes(q))
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));

  const finalizeCompletion = (snapshot) => {
    setActionTodo(null);
    setCompletingId(snapshot.id);
    setTimeout(() => {
      setCompletingId(null);
      setUndoTodo(snapshot);
    }, 1200);
  };

  const handleActionUpdate = (updated) => {
    const wasCompleted = isTaskCompleted(actionTodo);
    onSave(updated);
    if (!wasCompleted && isTaskCompleted(updated)) {
      finalizeCompletion({ ...actionTodo });   // snapshot преди последното отмятане
    } else {
      setActionTodo(updated);
    }
  };

  const handleUndo = () => {
    if (undoTodo) onSave(undoTodo);
    setUndoTodo(null);
  };

  const handleToastClose = () => {
    if (undoTodo) onDelete(undoTodo.id);
    setUndoTodo(null);
  };

  return (
    <div className="bg-gradient-to-br from-amber-50 to-yellow-100 rounded-2xl shadow-lg p-4 space-y-3">
      <button
        onClick={() => setShowCreate(true)}
        className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold shadow-md hover:shadow-lg flex items-center justify-center gap-2 transition-shadow"
      >
        <Plus className="w-5 h-5" />
        Създай еднократна задача
      </button>

      {visibleTodos.length === 0 ? (
        isSearching ? (
          <p className="text-center text-gray-500 text-sm py-1">Няма намерени еднократни задачи</p>
        ) : null
      ) : (
        <div className="space-y-2">
          {visibleTodos.map(todo => {
            const status = getEffectiveStatus(todo);
            const progressText = getProgressText(todo);
            const vanishing = completingId === todo.id;

            let statusIcon = '⏱', statusText = 'Предстоящо';
            if (status === 'partial') { statusIcon = '⏳'; statusText = 'В процес'; }

            return (
              <button
                key={todo.id}
                onClick={() => !vanishing && setActionTodo(todo)}
                className={`w-full bg-white rounded-xl shadow-sm p-3 flex items-center justify-between gap-2 text-left ${
                  vanishing ? 'animate-todo-done line-through' : 'hover:shadow-md'
                }`}
              >
                <div className="min-w-0">
                  <h4 className="font-bold text-gray-800 truncate">{todo.name}</h4>
                  <p className="text-xs text-gray-500 font-semibold">{statusIcon} {statusText}</p>
                </div>
                {progressText && (
                  <span className="text-sm font-bold px-3 py-1 rounded-full bg-amber-100 text-amber-700 shrink-0">
                    {progressText}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Прозорец за действия */}
      {actionTodo && (
        <div className="fixed inset-0 bg-gradient-to-br from-cyan-400 via-teal-300 to-emerald-300 bg-opacity-80 flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-br from-blue-100 to-purple-100 rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="min-w-0">
                  <h2 className="text-xl font-bold text-gray-800 break-words">{actionTodo.name}</h2>
                  <p className="text-sm text-gray-500">Еднократна задача</p>
                  {actionTodo.description && (
                    <p className="text-xs text-gray-600 mt-1 bg-white bg-opacity-70 rounded-lg px-2 py-1">{actionTodo.description}</p>
                  )}
                </div>
                <button onClick={() => setActionTodo(null)} className="text-gray-400 hover:text-gray-600 text-2xl font-bold ml-2">✕</button>
              </div>

              <button
                onClick={() => { setEditingTodo(actionTodo); setActionTodo(null); }}
                className="w-full mb-4 py-2 bg-white text-gray-700 rounded-xl font-semibold text-sm border-2 border-gray-200 hover:border-indigo-300"
              >
                ✏️ Редактирай
              </button>

              <TaskActions
                task={actionTodo}
                onUpdate={handleActionUpdate}
                hideSkip
                onDelete={() => { onDelete(actionTodo.id); setActionTodo(null); }}
              />
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <TodoModal
          todo={null}
          date={dateStr}
          onSave={(todo) => { onSave(todo); setShowCreate(false); }}
          onClose={() => setShowCreate(false)}
        />
      )}

      {editingTodo && (
        <TodoModal
          todo={editingTodo}
          date={dateStr}
          onSave={(todo) => { onSave(todo); setEditingTodo(null); }}
          onClose={() => setEditingTodo(null)}
        />
      )}

      {undoTodo && (
        <Toast
          type="success"
          duration={5000}
          message={
            <span className="flex items-center gap-3 whitespace-nowrap">
              Изпълнена
              <button
                onClick={handleUndo}
                className="underline font-bold bg-white/20 px-2 py-0.5 rounded-lg hover:bg-white/30"
              >
                Върни
              </button>
            </span>
          }
          onClose={handleToastClose}
        />
      )}
    </div>
  );
}
