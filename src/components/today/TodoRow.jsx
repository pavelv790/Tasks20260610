import { useState, useEffect } from 'react';
import { getEffectiveStatus, getProgressText, isTaskCompleted, isEntirelyInactive, computeTodoStatus } from '../../utils/habitUtils';
import TaskActions from './TaskActions';
import TodoModal from './TodoModal';

// ─────────────────────────────────────────────────────────
// TodoRow — един ред за еднократна задача в общия списък на „Днес".
// Формата е като на обикновените карти + дискретен етикет „еднократна".
// Собствен прозорец за действия, редакция и инлайн бележка.
//
// Props:
//   todo        — обектът
//   dateStr     — денят (за display в модала)
//   onSave      — callback(todo) upsert
//   onDelete    — callback(id)
//   onComplete  — callback(snapshotПредиОтмятането) — TodayScreen пуска анимацията + toast
//   completing  — true докато трае анимацията „изчезва"
//   isSearching — при активно търсене пренареждането е изключено
//   isFirst / isLast — за disabled на ▲▼
//   onMoveUp / onMoveDown — пренареждане (в общия ред)
//   draggable / onDragStart / onDragOver / onDrop / isDragging — drag-and-drop
// ─────────────────────────────────────────────────────────
export default function TodoRow({
  todo, dateStr, onSave, onDelete, onComplete, completing = false,
  isSearching = false, isFirst = false, isLast = false, onMoveUp, onMoveDown,
  draggable = false, onDragStart, onDragOver, onDrop, isDragging = false,
}) {
  const [actionOpen,  setActionOpen]  = useState(false);
  const [actionTodo,  setActionTodo]  = useState(null);
  const [modalNote,   setModalNote]   = useState('');
  const [editing,     setEditing]     = useState(false);
  const [noteOpen,    setNoteOpen]    = useState(false);
  const [noteDraft,   setNoteDraft]   = useState('');
  const [infoOpen,    setInfoOpen]    = useState(false);

  const status = getEffectiveStatus(todo);
  const progressText = getProgressText(todo);
  const hasNote = !!(todo.note && todo.note.trim());
  const inert = !!todo.inactive || isEntirelyInactive(todo);

  let statusIcon = '⏱', statusText = 'Предстоящо';
  if (status === 'partial') { statusIcon = '⏳'; statusText = 'В процес'; }
  else if (status === 'inactive' || inert) { statusIcon = '⏸'; statusText = 'Неактивна'; }

  const toggleElFlag = (el) => {
    if (!el.inactive) return { ...el, inactive: true };
    const copy = { ...el };
    delete copy.inactive;
    return copy;
  };
  const handleToggleInactive = ({ scope, index }) => {
    let updated;
    let reactivating;   // ⏸→▶ (връщане към активно) → затваряме прозореца
    if (scope === 'task') {
      reactivating = !!actionTodo.inactive;
      updated = { ...actionTodo, inactive: !actionTodo.inactive };
    } else if (scope === 'completion') {
      reactivating = !!(actionTodo.completions ?? []).find(c => c.index === index)?.inactive;
      updated = { ...actionTodo, completions: (actionTodo.completions ?? []).map(c => c.index === index ? toggleElFlag(c) : c) };
    } else {
      reactivating = !!(actionTodo.subtasks ?? []).find(s => s.index === index)?.inactive;
      updated = { ...actionTodo, subtasks: (actionTodo.subtasks ?? []).map(s => s.index === index ? toggleElFlag(s) : s) };
    }
    if (reactivating && modalNote !== (actionTodo.note ?? '')) {
      updated = { ...updated, note: modalNote };
    }
    updated.status = computeTodoStatus(updated);
    if (updated.status !== 'completed') updated.completedAt = null;
    onSave(updated);
    setActionTodo(updated);
    // „Направи неактивно" оставя прозореца отворен (има надпис за четене);
    // „Върни активно" го затваря — като при отмятане (виж handleActionUpdate).
    if (reactivating) setTimeout(() => setActionOpen(false), 300);
  };

  // ── Инлайн бележка (записва при клик извън полето) ──
  useEffect(() => {
    if (!noteOpen) return;
    const handler = (e) => {
      const btn = e.target.closest('[data-note-toggle]');
      if (btn && btn.getAttribute('data-note-toggle') === String(todo.id)) return;
      if (!e.target.closest('[data-note-container]')) {
        if (noteDraft !== (todo.note ?? '')) onSave({ ...todo, note: noteDraft });
        setNoteOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteOpen, noteDraft, todo]);

  const toggleNote = () => {
    if (noteOpen) {
      if (noteDraft !== (todo.note ?? '')) onSave({ ...todo, note: noteDraft });
      setNoteOpen(false);
    } else {
      setNoteDraft(todo.note ?? '');
      setNoteOpen(true);
    }
  };

  // ── Прозорец за действия ──
  const openAction = () => {
    setActionTodo(todo);
    setModalNote(todo.note ?? '');
    setActionOpen(true);
  };
  const commitModalNote = () => {
    if (!actionTodo) return actionTodo;
    if (modalNote !== (actionTodo.note ?? '')) {
      const t = { ...actionTodo, note: modalNote };
      onSave(t);
      return t;
    }
    return actionTodo;
  };
  const closeAction = () => { commitModalNote(); setActionOpen(false); };

  const handleActionUpdate = (updated) => {
    const noteChanged = modalNote !== (actionTodo.note ?? '');
    const merged = noteChanged ? { ...updated, note: modalNote } : updated;
    const wasCompleted = isTaskCompleted(actionTodo);
    onSave(merged);
    if (!wasCompleted && isTaskCompleted(merged)) {
      setActionOpen(false);
      onComplete({ ...actionTodo, note: modalNote });   // snapshot преди отмятането
    } else {
      // Като при обикновените задачи: след всяко отмятане (изпълнение / подзадача /
      // „изпълнено" / „нулирай") прозорецът се затваря и се връщаме на списъка „Днес".
      setActionTodo(merged);
      setTimeout(() => setActionOpen(false), 300);
    }
  };

  return (
    <>
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`w-full border rounded-xl shadow-md p-4 transition-all hover:shadow-lg ${
        inert ? 'bg-gray-100 border-gray-300 opacity-75' : 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200'
      } ${isDragging ? 'opacity-50 scale-95' : ''} ${completing ? 'animate-todo-done line-through' : ''}`}
    >
      <div className="flex items-start gap-2">
        <span className="text-gray-400 cursor-grab active:cursor-grabbing text-lg leading-none pt-1">⋮⋮</span>

        <div className="flex-1 min-w-0 text-left cursor-pointer" onClick={() => !completing && openAction()}>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className={`font-bold truncate ${inert ? 'text-gray-600' : 'text-gray-800'}`}>{todo.name}</h3>
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-amber-700 bg-amber-100 rounded px-1.5 py-0.5">
                  еднократна
                </span>
                {inert && (
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-gray-500 bg-gray-200 rounded px-1.5 py-0.5">
                    неактивна
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 font-semibold">{statusIcon} {statusText}</p>
              {infoOpen && todo.description && (
                <p className="text-xs mt-1 text-gray-600 bg-white bg-opacity-70 rounded-lg px-2 py-1">{todo.description}</p>
              )}
              {noteOpen && (
                <div data-note-container>
                  <textarea
                    autoFocus
                    value={noteDraft}
                    onChange={e => setNoteDraft(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    onFocus={e => { const v = e.target.value; e.target.setSelectionRange(v.length, v.length); }}
                    placeholder="Бележка за задачата..."
                    rows={2}
                    className="w-full mt-1 px-2 py-1 border-2 border-gray-200 rounded-lg text-xs text-gray-700 bg-white bg-opacity-80 focus:border-indigo-400 focus:outline-none resize-none"
                  />
                </div>
              )}
            </div>
            {progressText && (
              <span className="text-lg font-bold px-3 py-1 rounded-full shadow text-gray-700 bg-white shrink-0">
                {progressText}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 ml-1 shrink-0">
          {todo.description && (
            <button
              onClick={e => { e.stopPropagation(); setInfoOpen(p => !p); }}
              className="text-sm leading-none opacity-60 hover:opacity-100"
              title="Описание"
            >ℹ️</button>
          )}
          <button
            data-note-toggle={todo.id}
            onClick={e => { e.stopPropagation(); toggleNote(); }}
            className={`text-sm leading-none ${hasNote ? 'opacity-100' : 'opacity-60 hover:opacity-100'}`}
            title="Бележка"
          >📝</button>
          <div className="flex flex-col gap-0.5">
            <button
              onClick={onMoveUp}
              disabled={isSearching || isFirst}
              className="p-0.5 hover:bg-white hover:bg-opacity-50 rounded transition-colors disabled:opacity-30 text-xs leading-none"
              title="Премести нагоре"
            >▲</button>
            <button
              onClick={onMoveDown}
              disabled={isSearching || isLast}
              className="p-0.5 hover:bg-white hover:bg-opacity-50 rounded transition-colors disabled:opacity-30 text-xs leading-none"
              title="Премести надолу"
            >▼</button>
          </div>
        </div>
      </div>
    </div>

      {/* Прозорец за действия — извън реда, за да не наследи полупрозрачността
          на неактивния ред (opacity на родител се пренася върху fixed деца) */}
      {actionOpen && actionTodo && (
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
                <button onClick={closeAction} className="text-gray-400 hover:text-gray-600 text-2xl font-bold ml-2">✕</button>
              </div>

              <button
                onClick={() => { commitModalNote(); setActionOpen(false); setEditing(true); }}
                className="w-full mb-4 py-2 bg-white text-gray-700 rounded-xl font-semibold text-sm border-2 border-gray-200 hover:border-indigo-300"
              >
                ✏️ Редактирай
              </button>

              <TaskActions
                task={actionTodo}
                onUpdate={handleActionUpdate}
                hideSkip
                onToggleInactive={handleToggleInactive}
                onDelete={() => { onDelete(actionTodo.id); setActionOpen(false); }}
              />

              <div className="mt-4 pt-4 border-t border-gray-200">
                <label className="block text-sm font-semibold text-gray-700 mb-1">📝 Бележка</label>
                <textarea
                  value={modalNote}
                  onChange={e => setModalNote(e.target.value)}
                  placeholder="Добави бележка за задачата..."
                  rows={2}
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-indigo-400 focus:outline-none resize-none bg-white bg-opacity-80"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <TodoModal
          todo={todo}
          date={dateStr}
          onSave={(t) => { onSave(t); setEditing(false); }}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  );
}
