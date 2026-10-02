import { doesDateMatchRule } from './ruleEngine';
import { isTaskCompleted, resetTaskProgress } from './habitUtils';
import { checkMissedTasks } from './taskGenerator';

// ─────────────────────────────────────────────────────────
// Групови действия върху задачи (екран „Пропуснати и Отработени“).
// Всяка функция приема целия масив `tasks` и списък `ids` и връща НОВ масив със
// задачи (минал през checkMissedTasks), готов за onTasksUpdate(..., true).
// ─────────────────────────────────────────────────────────

// Кои от `ids` реално ще се променят от съответното действие
export const pickCompletable = (tasks, ids) =>
  tasks.filter(t => ids.has(t.id) && !isTaskCompleted(t));

export const pickActivatable = (tasks, ids) =>
  tasks.filter(t => ids.has(t.id) && !t.habitInactive);

// „Отбележи като изпълнено“ — същото като TaskActions.completeAll / markCompleted
export const bulkMarkCompleted = (tasks, ids) => {
  const now = new Date().toISOString();
  const done = (x) => (x.inactive ? x : { ...x, completed: true, timestamp: now });
  const targets = new Set(pickCompletable(tasks, ids).map(t => t.id));
  return checkMissedTasks(tasks.map(t => (
    targets.has(t.id)
      ? {
          ...t,
          completions: t.completions?.map(done),
          subtasks: t.subtasks?.map(done),
          status: 'completed',
          completedAt: now,
        }
      : t
  )));
};

// „Направи неактивна“ — само за избраните дни (`habitInactive` на самата задача,
// дефиницията на навика не се пипа)
export const bulkMakeInactive = (tasks, ids) => {
  const targets = new Set(pickActivatable(tasks, ids).map(t => t.id));
  return checkMissedTasks(tasks.map(t => (targets.has(t.id) ? { ...t, habitInactive: true } : t)));
};

// „Нулирай“ — огледално на DayModal.handleReset (разваля makeup връзките), но като
// TaskActions.reset слага `manuallyReset`, за да не се върне задачата веднага в „пропуснати“.
export const bulkReset = (tasks, ids, rules) => {
  let all = tasks;
  ids.forEach(id => {
    const task = all.find(t => t.id === id);
    if (!task) return;

    const rule   = rules.find(r => r.habitId === task.habitId && r.isActive);
    const inRule = rule ? doesDateMatchRule(new Date(task.date), rule) : false;
    const reset  = { ...resetTaskProgress(task), makeupFromDate: null, makeupForDate: null, manuallyReset: true };

    // Ръчно отработен ден извън правилото: без бележка се изтрива, с бележка се нулира
    if (task.createdBy === 'manual' && !inRule && !task.makeupFromDate && !task.makeupForDate) {
      all = task.note?.trim()
        ? all.map(t => (t.id === id ? reset : t))
        : all.filter(t => t.id !== id);
      return;
    }

    let next = all.map(t => (t.id === id ? reset : t));
    if (task.makeupForDate) {
      const target = next.find(t => t.date === task.makeupForDate && t.habitId === task.habitId);
      if (target) {
        const targetInRule = rule ? doesDateMatchRule(new Date(target.date), rule) : false;
        next = targetInRule
          ? next.map(t => (t.id === target.id ? { ...resetTaskProgress(target), makeupFromDate: null } : t))
          : next.filter(t => t.id !== target.id);
      }
    }
    all = next;
  });
  return checkMissedTasks(all);
};
