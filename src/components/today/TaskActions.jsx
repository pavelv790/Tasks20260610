import { useConfetti } from '../../hooks/useConfetti';
import { ORDINAL_SUFFIX } from '../../utils/constants';
import { isTaskCompleted } from '../../utils/habitUtils';

// ─────────────────────────────────────────────────────────
// TaskActions — логика за завършване на задача
//
// Използва се и в TodayScreen и в DayModal (календар) и при еднократните.
// Props:
//   task             — обектът на задачата
//   onUpdate         — callback с обновената задача
//   isMakeup         — true ако е makeup ден (без бутон "Пропусни")
//   hideSkip         — скрива бутона "Пропусни" (напр. за еднократни задачи)
//   onDelete         — ако е подаден, показва бутон "Изтрий задачата"
//   onToggleInactive — ако е подаден, показва контроли за „неактивно":
//                      извиква се с { scope: 'task' | 'completion' | 'subtask', index }
// ─────────────────────────────────────────────────────────
export default function TaskActions({ task, onUpdate, isMakeup = false, hideSkip = false, onDelete = null, onToggleInactive = null }) {
  const { fireConfetti } = useConfetti();

  const wasCompleted = () => task.status === 'completed';

  const finish = (updatedTask) => {
    const justCompleted = !wasCompleted() && updatedTask.status === 'completed';
    onUpdate(updatedTask);
    if (justCompleted) setTimeout(() => fireConfetti(), 100);
  };

  const isActiveC = (c) => !c.inactive;
  const isActiveS = (s) => !s.inactive;

  // ── Completions (пъти на ден) ────────────────────────
  const toggleCompletion = (index) => {
    const target = task.completions.find(c => c.index === index);
    if (!target || target.inactive) return;
    const wasDone = target.completed;
    const updated = task.completions.map(c =>
      c.index === index
        ? { ...c, completed: !c.completed, timestamp: !c.completed ? new Date().toISOString() : null }
        : c
    );
    const active   = updated.filter(isActiveC);
    const allDone  = active.every(c => c.completed);
    const someDone = active.some(c => c.completed);

    const resetSubtasks = wasDone && (task.subtasks?.length ?? 0) > 0
      ? task.subtasks.map(s => (s.inactive ? s : { ...s, completed: false, timestamp: null }))
      : task.subtasks;

    finish({ ...task, completions: updated, subtasks: resetSubtasks, status: allDone ? 'completed' : someDone ? 'partial' : 'pending' });
  };

  const completeAll = () => {
    const updated = task.completions.map(c => (c.inactive ? c : { ...c, completed: true, timestamp: new Date().toISOString() }));
    const updatedSubtasks = task.subtasks?.map(s => (s.inactive ? s : { ...s, completed: true, timestamp: new Date().toISOString() })) ?? [];
    finish({ ...task, completions: updated, subtasks: updatedSubtasks, status: 'completed', completedAt: new Date().toISOString() });
  };

  // ── Subtasks ─────────────────────────────────────────
  const toggleSubtask = (index) => {
    const target = task.subtasks.find(s => s.index === index);
    if (!target || target.inactive) return;
    const updatedSubtasks = task.subtasks.map(s =>
      s.index === index
        ? { ...s, completed: !s.completed, timestamp: !s.completed ? new Date().toISOString() : null }
        : s
    );
    const allSubDone = updatedSubtasks.filter(isActiveS).every(s => s.completed);
    let updatedTask = { ...task, subtasks: updatedSubtasks };

    // Ако има активни completions — завършването на всички активни subtasks отбелязва едно completion
    const activeCompletions = (task.completions ?? []).filter(isActiveC);
    if (activeCompletions.length > 0 && allSubDone) {
      const firstIncomplete = task.completions.findIndex(c => !c.inactive && !c.completed);
      if (firstIncomplete !== -1) {
        const updatedCompletions = task.completions.map((c, i) =>
          i === firstIncomplete ? { ...c, completed: true, timestamp: new Date().toISOString() } : c
        );
        updatedTask.completions = updatedCompletions;
        const allCompDone = updatedCompletions.filter(isActiveC).every(c => c.completed);
        if (allCompDone) {
          updatedTask.status = 'completed';
        } else {
          // Нулираме активните subtasks за следващото completion
          updatedTask.subtasks = task.subtasks.map(s => (s.inactive ? s : { ...s, completed: false, timestamp: null }));
          updatedTask.status = 'partial';
        }
      }
    } else {
      const anyDone = updatedSubtasks.filter(isActiveS).some(s => s.completed);
      updatedTask.status = allSubDone ? 'completed' : anyDone ? 'partial' : 'pending';
    }

    finish(updatedTask);
  };

  const completeAllSubtasks = () => {
    const updatedSubtasks = task.subtasks.map(s => (s.inactive ? s : { ...s, completed: true, timestamp: new Date().toISOString() }));
    let updatedTask = { ...task, subtasks: updatedSubtasks };

    const activeCompletions = (task.completions ?? []).filter(isActiveC);
    if (activeCompletions.length > 0) {
      const firstIncomplete = task.completions.findIndex(c => !c.inactive && !c.completed);
      if (firstIncomplete !== -1) {
        const updatedCompletions = task.completions.map((c, i) =>
          i === firstIncomplete ? { ...c, completed: true, timestamp: new Date().toISOString() } : c
        );
        updatedTask.completions = updatedCompletions;
        const allCompDone = updatedCompletions.filter(isActiveC).every(c => c.completed);
        if (!allCompDone) {
          updatedTask.subtasks = task.subtasks.map(s => (s.inactive ? s : { ...s, completed: false, timestamp: null }));
          updatedTask.status = 'partial';
        } else {
          updatedTask.status = 'completed';
        }
      }
    } else {
      updatedTask.status = 'completed';
    }

    finish(updatedTask);
  };

  // ── Прости действия ──────────────────────────────────
  const markCompleted = () => {
    finish({ ...task, status: 'completed', completedAt: new Date().toISOString() });
  };

  const markMissed = () => {
    onUpdate({
      ...task,
      status: 'missed',
      manuallyReset: undefined,
      completions: task.completions?.map(c => (c.inactive ? c : { ...c, completed: false, timestamp: null })) ?? [],
      subtasks:    task.subtasks?.map(s => (s.inactive ? s : { ...s, completed: false, timestamp: null }))    ?? [],
    });
  };

  const reset = () => {
    onUpdate({
      ...task,
      status:        'pending',
      completedAt:   null,
      manuallyReset: true,
      completions:   task.completions?.map(c => (c.inactive ? c : { ...c, completed: false, timestamp: null })) ?? [],
      subtasks:      task.subtasks?.map(s => (s.inactive ? s : { ...s, completed: false, timestamp: null }))    ?? [],
    });
  };

  const hasCompletions  = task.completions?.length > 0;
  const hasSubtasks     = task.subtasks?.length > 0;
  const activeCompletionsCount = (task.completions ?? []).filter(isActiveC).length;
  const activeSubtasksCount    = (task.subtasks ?? []).filter(isActiveS).length;
  const isCompleted     = isTaskCompleted(task);
  const isMissed        = task.status === 'missed';
  const wholeInactive   = !!(task.habitInactive || task.inactive);

  // ── Цялата задача е неактивна — само „върни активна" ──
  if (wholeInactive) {
    return (
      <div className="space-y-4">
        <div className="bg-gray-100 border-2 border-gray-300 rounded-xl p-4 text-center">
          <div className="text-4xl mb-2">⏸</div>
          <p className="font-bold text-gray-700">Задачата е неактивна</p>
          <p className="text-sm text-gray-500 mt-1">Не се брои за изпълнение и не става „пропусната".</p>
        </div>
        {onToggleInactive && (
          <button
            onClick={() => onToggleInactive({ scope: 'task' })}
            className="w-full py-3 bg-gradient-to-r from-green-400 to-green-500 text-white rounded-xl font-semibold hover:shadow-lg transition-shadow"
          >
            ▶ Върни като активна
          </button>
        )}
        {onDelete && (
          <button onClick={onDelete} className="w-full py-3 bg-gradient-to-r from-rose-500 to-red-600 text-white rounded-xl font-semibold hover:shadow-lg transition-shadow">
            🗑 Изтрий задачата
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* ── Completions ── */}
      {hasCompletions && (
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-3">
            Завършено: {task.completions.filter(c => isActiveC(c) && c.completed).length}/{activeCompletionsCount} пъти
          </p>
          <div className="space-y-2">
            {task.completions.map(c => (
              c.inactive ? (
                <div
                  key={c.index}
                  className="w-full p-3 rounded-xl flex items-center gap-3 bg-gray-100 border-2 border-dashed border-gray-300 opacity-70"
                >
                  <div className="w-6 h-6 rounded-full flex items-center justify-center bg-gray-300 text-white text-xs">⏸</div>
                  <span className="font-medium text-gray-500 line-through">
                    Отбележи {c.index}-{ORDINAL_SUFFIX(c.index)} път
                  </span>
                  <span className="ml-auto text-[10px] font-bold uppercase text-gray-400">неактивно</span>
                  {onToggleInactive && (
                    <button
                      onClick={() => onToggleInactive({ scope: 'completion', index: c.index })}
                      className="text-xs font-bold text-green-600 hover:text-green-700 px-2 py-1"
                      title="Върни активно"
                    >▶</button>
                  )}
                </div>
              ) : (
                <div key={c.index} className="flex items-center gap-1">
                  <button
                    onClick={() => toggleCompletion(c.index)}
                    className={`flex-1 p-3 rounded-xl flex items-center gap-3 transition-all ${
                      c.completed ? 'bg-green-100 border-2 border-green-400' : 'bg-gray-50 border-2 border-gray-200 hover:border-indigo-300'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${c.completed ? 'bg-green-400' : 'bg-gray-300'}`}>
                      {c.completed && <span className="text-white text-sm">✓</span>}
                    </div>
                    <span className="font-medium text-gray-800">
                      Отбележи {c.index}-{ORDINAL_SUFFIX(c.index)} път
                    </span>
                  </button>
                  {onToggleInactive && (
                    <button
                      onClick={() => onToggleInactive({ scope: 'completion', index: c.index })}
                      className="p-2 text-gray-400 hover:text-gray-600 text-sm leading-none"
                      title="Направи неактивно"
                    >⏸</button>
                  )}
                </div>
              )
            ))}
          </div>
          {!isCompleted && activeCompletionsCount > 0 && (
            <button onClick={completeAll} className="w-full mt-3 py-3 bg-gradient-to-r from-green-400 to-green-500 text-white rounded-xl font-semibold hover:shadow-lg transition-shadow">
              ✓✓ Отбележи като изпълнено
            </button>
          )}
        </div>
      )}

      {/* ── Subtasks ── */}
      {hasSubtasks && (
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-3">
            Подзадачи: {task.subtasks.filter(s => isActiveS(s) && s.completed).length}/{activeSubtasksCount}
          </p>
          <div className="space-y-2">
            {task.subtasks.map(s => (
              s.inactive ? (
                <div
                  key={s.index}
                  className="w-full p-3 rounded-xl flex items-center gap-3 bg-gray-100 border-2 border-dashed border-gray-300 opacity-70"
                >
                  <div className="w-6 h-6 rounded border-2 border-gray-300 flex items-center justify-center bg-white text-gray-400 text-xs">⏸</div>
                  <span className="font-medium text-gray-500 line-through">
                    {s.name || `Подзадача ${s.index}`}
                  </span>
                  <span className="ml-auto text-[10px] font-bold uppercase text-gray-400">неактивно</span>
                  {onToggleInactive && (
                    <button
                      onClick={() => onToggleInactive({ scope: 'subtask', index: s.index })}
                      className="text-xs font-bold text-green-600 hover:text-green-700 px-2 py-1"
                      title="Върни активно"
                    >▶</button>
                  )}
                </div>
              ) : (
                <div key={s.index} className="flex items-center gap-1">
                  <button
                    onClick={() => toggleSubtask(s.index)}
                    className={`flex-1 p-3 rounded-xl flex items-center gap-3 transition-all ${
                      s.completed ? 'bg-green-100 border-2 border-green-400' : 'bg-gray-50 border-2 border-gray-200 hover:border-indigo-300'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${s.completed ? 'bg-green-400 border-green-400' : 'bg-white border-gray-300'}`}>
                      {s.completed && <span className="text-white text-sm">✓</span>}
                    </div>
                    <span className="font-medium text-gray-800">
                      {s.name || `Подзадача ${s.index}`}
                    </span>
                  </button>
                  {onToggleInactive && (
                    <button
                      onClick={() => onToggleInactive({ scope: 'subtask', index: s.index })}
                      className="p-2 text-gray-400 hover:text-gray-600 text-sm leading-none"
                      title="Направи неактивно"
                    >⏸</button>
                  )}
                </div>
              )
            ))}
          </div>
          {activeSubtasksCount > 0 && (
            <button onClick={completeAllSubtasks} className="w-full mt-3 py-3 bg-gradient-to-r from-blue-400 to-blue-500 text-white rounded-xl font-semibold hover:shadow-lg transition-shadow">
              ✓ Отбележи всички подзадачи
            </button>
          )}
          {!isCompleted && !hasCompletions && activeSubtasksCount > 0 && (
            <button onClick={() => {
              const updatedSubtasks = task.subtasks.map(s => (s.inactive ? s : { ...s, completed: true, timestamp: new Date().toISOString() }));
              finish({ ...task, subtasks: updatedSubtasks, status: 'completed', completedAt: new Date().toISOString() });
            }} className="w-full mt-2 py-3 bg-gradient-to-r from-green-400 to-green-500 text-white rounded-xl font-semibold hover:shadow-lg transition-shadow">
              ✓✓ Отбележи като изпълнено
            </button>
          )}
        </div>
      )}

      {/* ── Обикновена задача ── */}
      {!hasCompletions && !hasSubtasks && !isCompleted && (
        <button onClick={markCompleted} className="w-full py-3 bg-gradient-to-r from-green-400 to-green-500 text-white rounded-xl font-semibold hover:shadow-lg transition-shadow">
          ✓ Отбележи като изпълнено
        </button>
      )}

      {/* ── Пропусни / Нулирай / Неактивно / Изтрий ── */}
      <div className="space-y-2 pt-4 border-t border-gray-200">
        {!isMakeup && !isMissed && !hideSkip && (
          <button onClick={markMissed} className="w-full py-3 bg-gradient-to-r from-red-400 to-red-500 text-white rounded-xl font-semibold hover:shadow-lg transition-shadow">
            ✗ Пропусни
          </button>
        )}
        {!isMakeup && <button onClick={reset} className="w-full py-3 bg-gradient-to-r from-gray-400 to-gray-500 text-white rounded-xl font-semibold hover:shadow-lg transition-shadow">
          🔄 Нулирай задачата
        </button>}
        {onToggleInactive && !isMakeup && (
          <button
            onClick={() => onToggleInactive({ scope: 'task' })}
            className="w-full py-3 bg-gradient-to-r from-slate-400 to-slate-500 text-white rounded-xl font-semibold hover:shadow-lg transition-shadow"
          >
            ⏸ Направи задачата неактивна
          </button>
        )}
        {onDelete && (
          <button onClick={onDelete} className="w-full py-3 bg-gradient-to-r from-rose-500 to-red-600 text-white rounded-xl font-semibold hover:shadow-lg transition-shadow">
            🗑 Изтрий задачата
          </button>
        )}
      </div>
    </div>
  );
}
