import { useConfetti } from '../../hooks/useConfetti';
import { ORDINAL_SUFFIX } from '../../utils/constants';

// ─────────────────────────────────────────────────────────
// TaskActions — логика за завършване на задача
//
// Използва се и в TodayScreen и в DayModal (календар).
// Props:
//   task        — обектът на задачата
//   onUpdate    — callback с обновената задача
//   isMakeup    — true ако е makeup ден (без бутон "Пропусни")
// ─────────────────────────────────────────────────────────
export default function TaskActions({ task, onUpdate, isMakeup = false }) {
  const { fireConfetti } = useConfetti();

  const wasCompleted = () => task.status === 'completed';

  const finish = (updatedTask) => {
    const justCompleted = !wasCompleted() && updatedTask.status === 'completed';
    onUpdate(updatedTask);
    if (justCompleted) setTimeout(() => fireConfetti(), 100);
  };

  // ── Completions (пъти на ден) ────────────────────────
  const toggleCompletion = (index) => {
    const wasCompleted = task.completions.find(c => c.index === index)?.completed;
    const updated = task.completions.map(c =>
      c.index === index
        ? { ...c, completed: !c.completed, timestamp: !c.completed ? new Date().toISOString() : null }
        : c
    );
    const allDone  = updated.every(c => c.completed);
    const someDone = updated.some(c => c.completed);

    const resetSubtasks = wasCompleted && (task.subtasks?.length ?? 0) > 0
      ? task.subtasks.map(s => ({ ...s, completed: false, timestamp: null }))
      : task.subtasks;

    finish({ ...task, completions: updated, subtasks: resetSubtasks, status: allDone ? 'completed' : someDone ? 'partial' : 'pending' });
  };

  const completeAll = () => {
    const updated = task.completions.map(c => ({ ...c, completed: true, timestamp: new Date().toISOString() }));
    const updatedSubtasks = task.subtasks?.map(s => ({ ...s, completed: true, timestamp: new Date().toISOString() })) ?? [];
    finish({ ...task, completions: updated, subtasks: updatedSubtasks, status: 'completed', completedAt: new Date().toISOString() });
  };

  // ── Subtasks ─────────────────────────────────────────
  const toggleSubtask = (index) => {
    const updatedSubtasks = task.subtasks.map(s =>
      s.index === index
        ? { ...s, completed: !s.completed, timestamp: !s.completed ? new Date().toISOString() : null }
        : s
    );
    const allSubDone = updatedSubtasks.every(s => s.completed);
    let updatedTask = { ...task, subtasks: updatedSubtasks };

    // Ако има completions — завършването на всички subtasks отбелязва едно completion
    if (task.completions?.length > 0 && allSubDone) {
      const firstIncomplete = task.completions.findIndex(c => !c.completed);
      if (firstIncomplete !== -1) {
        const updatedCompletions = task.completions.map((c, i) =>
          i === firstIncomplete ? { ...c, completed: true, timestamp: new Date().toISOString() } : c
        );
        updatedTask.completions = updatedCompletions;
        const allCompDone = updatedCompletions.every(c => c.completed);
        if (allCompDone) {
          updatedTask.status = 'completed';
        } else {
          // Нулираме subtasks за следващото completion
          updatedTask.subtasks = task.subtasks.map(s => ({ ...s, completed: false, timestamp: null }));
          updatedTask.status = 'partial';
        }
      }
    } else {
      const anyDone = updatedSubtasks.some(s => s.completed);
      updatedTask.status = allSubDone ? 'completed' : anyDone ? 'partial' : 'pending';
    }

    finish(updatedTask);
  };

  const completeAllSubtasks = () => {
    const updatedSubtasks = task.subtasks.map(s => ({ ...s, completed: true, timestamp: new Date().toISOString() }));
    let updatedTask = { ...task, subtasks: updatedSubtasks };

    if (task.completions?.length > 0) {
      const firstIncomplete = task.completions.findIndex(c => !c.completed);
      if (firstIncomplete !== -1) {
        const updatedCompletions = task.completions.map((c, i) =>
          i === firstIncomplete ? { ...c, completed: true, timestamp: new Date().toISOString() } : c
        );
        updatedTask.completions = updatedCompletions;
        const allCompDone = updatedCompletions.every(c => c.completed);
        if (!allCompDone) {
          updatedTask.subtasks = task.subtasks.map(s => ({ ...s, completed: false, timestamp: null }));
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
      completions: task.completions?.map(c => ({ ...c, completed: false, timestamp: null })) ?? [],
      subtasks:    task.subtasks?.map(s => ({ ...s, completed: false, timestamp: null }))    ?? [],
    });
  };

  const reset = () => {
    onUpdate({
      ...task,
      status:        'pending',
      completedAt:   null,
      manuallyReset: true,
      completions:   task.completions?.map(c => ({ ...c, completed: false, timestamp: null })) ?? [],
      subtasks:      task.subtasks?.map(s => ({ ...s, completed: false, timestamp: null }))    ?? [],
    });
  };

  const hasCompletions  = task.completions?.length > 0;
  const hasSubtasks     = task.subtasks?.length > 0;
  const isCompleted     = task.status === 'completed';
  const isMissed        = task.status === 'missed';

  return (
    <div className="space-y-4">

      {/* ── Completions ── */}
      {hasCompletions && (
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-3">
            Завършено: {task.completions.filter(c => c.completed).length}/{task.completions.length} пъти
          </p>
          <div className="space-y-2">
            {task.completions.map(c => (
              <button
                key={c.index}
                onClick={() => toggleCompletion(c.index)}
                className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all ${
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
            ))}
          </div>
          {!isCompleted && (
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
            Подзадачи: {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length}
          </p>
          <div className="space-y-2">
            {task.subtasks.map(s => (
              <button
                key={s.index}
                onClick={() => toggleSubtask(s.index)}
                className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all ${
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
            ))}
          </div>
          <button onClick={completeAllSubtasks} className="w-full mt-3 py-3 bg-gradient-to-r from-blue-400 to-blue-500 text-white rounded-xl font-semibold hover:shadow-lg transition-shadow">
            ✓ Отбележи всички подзадачи
          </button>
          {!isCompleted && !hasCompletions && (
            <button onClick={() => {
              const updatedSubtasks = task.subtasks.map(s => ({ ...s, completed: true, timestamp: new Date().toISOString() }));
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
      
      {/* ── Пропусни / Нулирай ── */}
      <div className="space-y-2 pt-4 border-t border-gray-200">
        {!isMakeup && !isMissed && (
          <button onClick={markMissed} className="w-full py-3 bg-gradient-to-r from-red-400 to-red-500 text-white rounded-xl font-semibold hover:shadow-lg transition-shadow">
            ✗ Пропусни
          </button>
        )}
        {!isMakeup && <button onClick={reset} className="w-full py-3 bg-gradient-to-r from-gray-400 to-gray-500 text-white rounded-xl font-semibold hover:shadow-lg transition-shadow">
          🔄 Нулирай задачата
        </button>}
      </div>
    </div>
  );
}
