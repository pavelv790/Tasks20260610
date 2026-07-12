// ============================================================
// habitUtils.js
// Отговорност: помощни функции за статус на задачи
// ============================================================

// Проверява дали задача е напълно завършена
export const isTaskCompleted = (task) => {
  if (!task) return false;

  if (task.completions?.length > 0) {
    return task.completions.every(c => c.completed);
  }

  if (task.subtasks?.length > 0) {
    return task.subtasks.every(s => s.completed);
  }

  return task.status === 'completed';
};

// Проверява дали задача има НЯКАКЪВ прогрес (поне едно завършване)
export const hasTaskProgress = (task) => {
  if (!task) return false;
  if (task.completions?.some(c => c.completed)) return true;
  if (task.subtasks?.some(s => s.completed)) return true;
  return false;
};

// Връща текст за прогреса: "2/3" или null
export const getProgressText = (task) => {
  if (!task) return null;

  if (task.completions?.length > 0) {
    const done = task.completions.filter(c => c.completed).length;
    if (done > 0) return `${done}/${task.completions.length}`;
  }

  if (task.subtasks?.length > 0 && (!task.completions || task.completions.length === 0)) {
    const done = task.subtasks.filter(s => s.completed).length;
    if (done > 0) return `${done}/${task.subtasks.length}`;
  }

  return null;
};

// Изчислява ефективния статус на задача (за визуализация)
// Връща: 'completed' | 'partial' | 'missed' | 'makeup' | 'pending'
export const getEffectiveStatus = (task) => {
  if (!task) return 'pending';

  if (task.status === 'missed') return 'missed';
  if (task.makeupFromDate) return 'makeup';

  if (task.completions?.length > 0) {
    const done = task.completions.filter(c => c.completed).length;
    if (done === task.completions.length) return 'completed';
    if (done > 0) return 'partial';
    // Проверяваме subtasks дори когато има completions
    if (task.subtasks?.some(s => s.completed)) return 'partial';
    return 'pending';
  }

  if (task.subtasks?.length > 0) {
    const done = task.subtasks.filter(s => s.completed).length;
    if (done === task.subtasks.length) return 'completed';
    if (done > 0) return 'partial';
    return 'pending';
  }

  return task.status ?? 'pending';
};

// Генерира нова задача за дадена задача и дата
export const createTaskObject = (habit, dateStr, ruleId) => ({
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
});

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