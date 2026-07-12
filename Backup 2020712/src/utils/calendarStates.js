// ============================================================
// calendarStates.js
// Отговорност: определя визуалното състояние на ден в календара
//
// 14 СЪСТОЯНИЯ:
//   C1  Бъдещ ден от правилото, без задача
//   C2  Минал ден от правилото, пропуснат
//   C3  Не е в правилото, без задача
//   C4  Завършен (обикновен)
//   C5  Makeup ден, незавършен
//   C6  Денят се наваксва другаде
//   C7  Makeup ден, завършен
//   C8  Частични завършвания (някои)
//   C9  Всички завършвания направени
//   C10 Подзадачите частично завършени
//   C11 Makeup + частични завършвания
//   C12 Makeup + всички завършвания
//   C13 Makeup + подзадачи частично
//   C14 Отработен без връзка
// ============================================================

import { doesDateMatchRule } from './ruleEngine';
import { toMidnight, formatShortDate } from './dateUtils';
import { isTaskCompleted } from './habitUtils';

export const getCalendarDayState = (date, task, rule) => {
  const check  = toMidnight(new Date(date));
  const today  = toMidnight(new Date());
  const isPast = check < today;

  const inRule = rule ? doesDateMatchRule(check, rule) : false;

  // ── Няма задача ─────────────────────────────────────────
  if (!task) {
    if (inRule) return isPast ? STATE.C2 : STATE.C1;
    return STATE.C3;
  }

  // ── Денят се наваксва другаде (C6) ──────────────────────
  if (task.makeupForDate) {
    return {
      ...STATE.C6,
      label: `Наваксва се на ${formatShortDate(task.makeupForDate)}`,
    };
  }

  // ── Makeup ден ──────────────────────────────────────────
  if (task.makeupFromDate) {
    const label = `Наваксва за ${formatShortDate(task.makeupFromDate)}`;

    const hasMultiCompletions = (task.completions?.length ?? 0) > 1;
    const hasSubtasks         = (task.subtasks?.length ?? 0) > 0;

    if (hasMultiCompletions) {
      const done     = task.completions.filter(c => c.completed).length;
      const total    = task.completions.length;
      const allDone  = done === total;
      const someDone = done > 0 && !allDone;

      if (allDone)  return { ...STATE.C12, label: `${label} ${done}/${total}` };
      if (someDone) return { ...STATE.C11, label: `${label} ${done}/${total}` };
    }

    if (hasSubtasks && !hasMultiCompletions) {
      const someDone = task.subtasks.some(s => s.completed);
      const allDone  = task.subtasks.every(s => s.completed);

      if (allDone && isTaskCompleted(task))              return { ...STATE.C7,  label };
      if (someDone || (allDone && !isTaskCompleted(task))) return { ...STATE.C13, label };
      if (isTaskCompleted(task))                         return { ...STATE.C7,  label };
    }

    if (isTaskCompleted(task)) return { ...STATE.C7, label };

    const anySubDone = (task.subtasks?.length ?? 0) > 0 && task.subtasks.some(s => s.completed);
    if (anySubDone) return { ...STATE.C13, label };

    return { ...STATE.C5, label };
  }

  // ── Отработен без връзка ─────────────────────────────────
  if (task.createdBy === 'manual' && !inRule) {
    const hasMultiC = (task.completions?.length ?? 0) > 1;
    const hasSub    = (task.subtasks?.length ?? 0) > 0;

    if (hasMultiC) {
      const done     = task.completions.filter(c => c.completed).length;
      const total    = task.completions.length;
      const allDone  = done === total;
      const someDone = done > 0 && !allDone;
      const someSubDone = hasSub && task.subtasks.some(s => s.completed);

      if (allDone)     return { ...STATE.C14, bgColor: 'bg-green-400' };
      if (someDone)    return { ...STATE.C14, bgColor: 'bg-green-300' };
      if (someSubDone) return { ...STATE.C14, bgColor: 'bg-gradient-to-br from-white to-green-300' };
      return STATE.C14;
    }
    if (hasSub) {
      const allDone  = task.subtasks.every(s => s.completed);
      const someDone = task.subtasks.some(s => s.completed);
      if (allDone || isTaskCompleted(task)) return { ...STATE.C14, bgColor: 'bg-green-400' };
      if (someDone) return { ...STATE.C14, bgColor: 'bg-gradient-to-br from-white to-green-300' };
      return STATE.C14;
    }
    if (isTaskCompleted(task)) return { ...STATE.C14, bgColor: 'bg-green-400' };
    return STATE.C14;
  }

  // ── Обикновен ден ───────────────────────────────────────
  const hasMultiCompletions = (task.completions?.length ?? 0) > 1;
  const hasSubtasks         = (task.subtasks?.length ?? 0) > 0;

  if (hasMultiCompletions) {
    const done         = task.completions.filter(c => c.completed).length;
    const total        = task.completions.length;
    const allDone      = done === total;
    const someDone     = done > 0 && !allDone;
    const subtasksDone = (task.subtasks?.length ?? 0) > 0 && task.subtasks.some(s => s.completed);

    if (allDone)      return { ...STATE.C9, completionText: `${done}/${total}` };
    if (someDone)     return { ...STATE.C8, completionText: `${done}/${total}` };
    if (subtasksDone) return STATE.C10;
  }

  if (hasSubtasks && !hasMultiCompletions) {
    const someDone = task.subtasks.some(s => s.completed);
    const allDone  = task.subtasks.every(s => s.completed);

    if (allDone || isTaskCompleted(task)) return STATE.C4;
    if (someDone)                         return STATE.C10;
  }

  if (isTaskCompleted(task)) return STATE.C4;

  if (task.status === 'missed' && !task.manuallyReset) return STATE.C2;

  // Pending задача
  if (task.manuallyReset) return inRule ? STATE.C1 : STATE.C3;
  if (inRule) return isPast ? STATE.C2 : STATE.C1;
  return STATE.C3;
};

// Обвива резултата с динамичен ring според inRule (само за бъдещи/днешни дни — за минали дни ring-ът е подвеждащ спрямо старо правило)
export const getCalendarDayStateWithRing = (date, task, rule) => {
  const check  = toMidnight(new Date(date));
  const today  = toMidnight(new Date());
  const isPast = check < today;
  const inRule = rule ? doesDateMatchRule(check, rule) : false;
  const state  = getCalendarDayState(date, task, rule);
  if (state.unlinkedRing) return state;
  return { ...state, ring: isPast ? false : inRule };
};

const STATE = {
  C1:  { state: 'C1',  bgColor: 'bg-gray-50',                                ring: false, label: null, completionText: null },
  C2:  { state: 'C2',  bgColor: 'bg-red-400',                                ring: false, label: null, completionText: null },
  C3:  { state: 'C3',  bgColor: 'bg-gray-50',                                ring: false, label: null, completionText: null },
  C4:  { state: 'C4',  bgColor: 'bg-green-400',                              ring: false, label: null, completionText: null },
  C5:  { state: 'C5',  bgColor: 'bg-gray-50',                                ring: false, label: null, completionText: null },
  C6:  { state: 'C6',  bgColor: 'bg-orange-400',                             ring: false, label: null, completionText: null },
  C7:  { state: 'C7',  bgColor: 'bg-green-400',                              ring: false, label: null, completionText: null },
  C8:  { state: 'C8',  bgColor: 'bg-green-300',                              ring: false, label: null, completionText: null },
  C9:  { state: 'C9',  bgColor: 'bg-green-400',                              ring: false, label: null, completionText: null },
  C10: { state: 'C10', bgColor: 'bg-gradient-to-br from-white to-green-300', ring: false, label: null, completionText: null },
  C11: { state: 'C11', bgColor: 'bg-green-300',                              ring: false, label: null, completionText: null },
  C12: { state: 'C12', bgColor: 'bg-green-400',                              ring: false, label: null, completionText: null },
  C13: { state: 'C13', bgColor: 'bg-gradient-to-br from-white to-green-300', ring: false, label: null, completionText: null },
  C14: { state: 'C14', bgColor: 'bg-white',                                  ring: false, label: 'Отработен', completionText: null, unlinkedRing: true },
};