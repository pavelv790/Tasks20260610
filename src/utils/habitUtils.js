// ============================================================
// habitUtils.js
// Отговорност: помощни функции за статус на задачи
// ============================================================

import { formatDate } from './dateUtils';

// ─────────────────────────────────────────────────────────
// Неактивност
//
// „Неактивно" = елементът се вижда, но е заключен: не може да се отмята,
// не се брои за завършване и не става „пропуснато".
//
// Източник на истината е ДЕФИНИЦИЯТА на навика:
//   habit.inactive             — цялата задача е неактивна
//   habit.inactiveCompletions  — индекси (1-базирани) на неактивни повторения
//   habit.inactiveSubtasks     — индекси (1-базирани) на неактивни подзадачи
//
// Върху конкретната task инстанция това се „подпечатва" (за да работят
// helper-ите без да им подаваме habit навсякъде):
//   task.habitInactive         — цялата задача е неактивна
//   task.completions[i].inactive / task.subtasks[i].inactive
//
// Еднократните задачи (todos) пазят същите флагове директно на обекта
// (todo.inactive + inactive на елементите), защото са за един ден.
// ─────────────────────────────────────────────────────────

const applyInactiveFlags = (arr, inactiveIndices) => {
  const set = new Set(inactiveIndices ?? []);
  return (arr ?? []).map(el => {
    if (set.has(el.index)) return el.inactive ? el : { ...el, inactive: true };
    if (el.inactive) { const copy = { ...el }; delete copy.inactive; return copy; }
    return el;
  });
};

// Пренася неактивността от дефиницията на навика върху една task инстанция.
export const syncTaskInactivity = (task, habit) => {
  if (!task || !habit) return task;
  const completions = applyInactiveFlags(task.completions, habit.inactiveCompletions);
  const subtasks    = applyInactiveFlags(task.subtasks, habit.inactiveSubtasks);
  const next = { ...task, completions, subtasks };
  if (habit.inactive) next.habitInactive = true;
  else delete next.habitInactive;
  return next;
};

// Има ли задачата поне едно активно нещо за правене?
export const hasActiveRequirements = (task) => {
  if (!task) return false;
  const comps = task.completions ?? [];
  const subs  = task.subtasks ?? [];
  if (comps.length === 0 && subs.length === 0) return true;
  return comps.some(c => !c.inactive) || subs.some(s => !s.inactive);
};

// Напълно неактивна: целият навик е неактивен, ИЛИ има под-елементи, но
// всичките са неактивни.
export const isEntirelyInactive = (task) => {
  if (!task) return false;
  if (task.habitInactive || task.inactive) return true;
  const comps = task.completions ?? [];
  const subs  = task.subtasks ?? [];
  if (comps.length === 0 && subs.length === 0) return false;
  return !comps.some(c => !c.inactive) && !subs.some(s => !s.inactive);
};

// Проверява дали задача е напълно завършена (неактивните елементи не се броят)
export const isTaskCompleted = (task) => {
  if (!task) return false;

  if (task.completions?.length > 0) {
    const active = task.completions.filter(c => !c.inactive);
    if (active.length > 0) return active.every(c => c.completed);
    // всички повторения са неактивни → падаме към подзадачите
  }

  if (task.subtasks?.length > 0) {
    const active = task.subtasks.filter(s => !s.inactive);
    if (active.length > 0) return active.every(s => s.completed);
    return false; // всички подзадачи неактивни → няма какво да се завърши
  }

  if (task.completions?.length > 0) return false; // имаше повторения, но всички неактивни

  return task.status === 'completed';
};

// Проверява дали задача има НЯКАКЪВ прогрес (поне едно завършено активно)
export const hasTaskProgress = (task) => {
  if (!task) return false;
  if (task.completions?.some(c => !c.inactive && c.completed)) return true;
  if (task.subtasks?.some(s => !s.inactive && s.completed)) return true;
  return false;
};

// Връща текст за прогреса: "2/3" или null (броим само активните)
export const getProgressText = (task) => {
  if (!task) return null;

  if (task.completions?.length > 0) {
    const active = task.completions.filter(c => !c.inactive);
    const done = active.filter(c => c.completed).length;
    if (done > 0) return `${done}/${active.length}`;
  }

  if (task.subtasks?.length > 0 && (!task.completions || task.completions.length === 0)) {
    const active = task.subtasks.filter(s => !s.inactive);
    const done = active.filter(s => s.completed).length;
    if (done > 0) return `${done}/${active.length}`;
  }

  return null;
};

// Изчислява ефективния статус на задача (за визуализация)
// Връща: 'completed' | 'partial' | 'missed' | 'makeup' | 'pending' | 'inactive'
export const getEffectiveStatus = (task) => {
  if (!task) return 'pending';

  if (task.status === 'missed') return 'missed';
  if (task.makeupFromDate) return 'makeup';
  // Неактивна, но само ако още не е завършена (завършеното си остава завършено)
  if ((task.habitInactive || task.inactive) && !isTaskCompleted(task)) return 'inactive';

  if (task.completions?.length > 0) {
    const active = task.completions.filter(c => !c.inactive);
    if (active.length > 0) {
      const done = active.filter(c => c.completed).length;
      if (done === active.length) return 'completed';
      if (done > 0) return 'partial';
      // Проверяваме subtasks дори когато има completions
      if (task.subtasks?.some(s => !s.inactive && s.completed)) return 'partial';
      return 'pending';
    }
    // всички повторения неактивни → падаме към подзадачите
  }

  if (task.subtasks?.length > 0) {
    const active = task.subtasks.filter(s => !s.inactive);
    if (active.length > 0) {
      const done = active.filter(s => s.completed).length;
      if (done === active.length) return 'completed';
      if (done > 0) return 'partial';
      return 'pending';
    }
    return 'inactive';
  }

  if (task.completions?.length > 0) return 'inactive'; // имаше повторения, всички неактивни

  return task.status ?? 'pending';
};

// Генерира нова задача за дадена задача и дата
export const createTaskObject = (habit, dateStr, ruleId) => {
  const base = {
    id: generateId('task'),
    habitId: habit.id,
    date: dateStr,
    status: 'pending',
    completions: habit.timesPerDay > 1
      ? Array.from({ length: habit.timesPerDay }, (_, i) => ({
          index: i + 1,
          completed: false,
          timestamp: null,
        }))
      : [],
    subtasks: habit.subtasksCount > 0
      ? Array.from({ length: habit.subtasksCount }, (_, i) => ({
          index: i + 1,
          name: habit.subtaskNames?.[i] || `Подзадача ${i + 1}`,
          completed: false,
          timestamp: null,
        }))
      : [],
    makeupForDate: null,
    makeupFromDate: null,
    createdBy: 'rule',
    ruleId: ruleId ?? null,
  };
  // Новите инстанции наследяват неактивността от дефиницията на навика.
  return syncTaskInactivity(base, habit);
};

// ─────────────────────────────────────────────────────────
// Еднократни задачи (todos) — независими от навици/правила.
// Ползват същите completions/subtasks масиви, за да работи TaskActions.
// ─────────────────────────────────────────────────────────

// Строи масивите completions/subtasks за дадени параметри,
// като пази наличните отметки където е възможно (за редакция).
export const buildTodoArrays = ({ timesPerDay, subtasksCount, subtaskNames = [] }, prev = {}) => {
  const prevCompletions = prev.completions ?? [];
  const prevSubtasks    = prev.subtasks ?? [];

  const completions = timesPerDay > 1
    ? Array.from({ length: timesPerDay }, (_, i) => {
        const el = {
          index: i + 1,
          completed: prevCompletions[i]?.completed ?? false,
          timestamp: prevCompletions[i]?.timestamp ?? null,
        };
        if (prevCompletions[i]?.inactive) el.inactive = true;
        return el;
      })
    : [];

  const subtasks = subtasksCount > 0
    ? Array.from({ length: subtasksCount }, (_, i) => {
        const el = {
          index: i + 1,
          name: subtaskNames[i] || `Подзадача ${i + 1}`,
          completed: prevSubtasks[i]?.completed ?? false,
          timestamp: prevSubtasks[i]?.timestamp ?? null,
        };
        if (prevSubtasks[i]?.inactive) el.inactive = true;
        return el;
      })
    : [];

  return { completions, subtasks };
};

// Изчислява статуса на todo от неговите масиви (неактивните елементи не се броят)
export const computeTodoStatus = (todo) => {
  // Неактивна еднократна задача остава „pending" — не се маха при зареждане.
  if (todo.inactive) return 'pending';
  const comps = (todo.completions ?? []).filter(c => !c.inactive);
  const subs  = (todo.subtasks ?? []).filter(s => !s.inactive);

  if ((todo.completions?.length ?? 0) > 0 && comps.length > 0) {
    const allDone  = comps.every(c => c.completed);
    const someDone = comps.some(c => c.completed) || subs.some(s => s.completed);
    return allDone ? 'completed' : someDone ? 'partial' : 'pending';
  }
  if ((todo.subtasks?.length ?? 0) > 0 && subs.length > 0) {
    const allDone  = subs.every(s => s.completed);
    const someDone = subs.some(s => s.completed);
    return allDone ? 'completed' : someDone ? 'partial' : 'pending';
  }
  return todo.status === 'completed' ? 'completed' : 'pending';
};

// Създава нов todo обект.
// `date` = денят, за който е задачата (по подразбиране днес).
export const createTodoObject = ({ name, description, timesPerDay = 1, subtasksCount = 0, subtaskNames = [], date }) => {
  const { completions, subtasks } = buildTodoArrays({ timesPerDay, subtasksCount, subtaskNames });
  return {
    id: generateId('todo'),
    name: name.trim(),
    description: description?.trim() || null,
    timesPerDay: Math.max(1, timesPerDay),
    subtasksCount: Math.max(0, subtasksCount),
    subtaskNames,
    completions,
    subtasks,
    status: 'pending',
    note: '',
    createdAt: Date.now(),
    order: Date.now(),            // за ръчно пренареждане в списъка
    date: date || formatDate(new Date()),
    completedAt: null,
  };
};

// Нулира прогреса на задача
export const resetTaskProgress = (task) => ({
  ...task,
  status: 'pending',
  completedAt: null,
  completions: task.completions?.map(c => ({ ...c, completed: false, timestamp: null })) ?? [],
  subtasks: task.subtasks?.map(s => ({ ...s, completed: false, timestamp: null })) ?? [],
});

// Генерира уникален ID
export const generateId = (prefix = 'id') =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;