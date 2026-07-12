// ============================================================
// taskGenerator.js
// Отговорност: генерира задачи и обработва смяна на правило
// ============================================================

import { doesDateMatchRule } from './ruleEngine';
import { formatDate, toMidnight, isPastDate } from './dateUtils';
import { createTaskObject, isTaskCompleted, hasTaskProgress } from './habitUtils';

// -------------------------------------------------------
// Генерира задачи за един месец за дадена задача
// allowPastDates = true → генерира и за минали дати
// -------------------------------------------------------
export const generateTasksForMonth = (habit, rules, existingTasks, year, month, allowPastDates = false) => {
  const activeRules = rules.filter(r => r.habitId === habit.id && r.isActive);
  if (activeRules.length === 0) return [];

  const today = toMidnight(new Date());
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const newTasks = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const date = toMidnight(new Date(year, month, day));

    if (!allowPastDates && date < today) continue;

    const dateStr = formatDate(date);

    // Пропускаме ако вече има задача за тази дата
    const exists = existingTasks.some(t => t.habitId === habit.id && t.date === dateStr);
    if (exists) continue;

    const matchingRule = activeRules.find(r => doesDateMatchRule(date, r));
    if (matchingRule) {
      newTasks.push(createTaskObject(habit, dateStr, matchingRule.id));
    }
  }

  return newTasks;
};

// -------------------------------------------------------
// Маркира пропуснати задачи (минали + незавършени)
// -------------------------------------------------------
export const checkMissedTasks = (tasks) => {
  const today = toMidnight(new Date());

  return tasks.map(task => {
    // Не пипаме вече финализирани задачи
    if (['completed', 'missed'].includes(task.status)) return task;
    // Не пипаме ръчно нулирани задачи
    if (task.manuallyReset) return task;
    // Не пипаме makeup задачи
    if (task.makeupFromDate) return task;

    const taskDate = toMidnight(new Date(task.date));
    if (taskDate >= today) return task;

    // Минала дата — определяме статус
    const completions = task.completions ?? [];
    const subtasks   = task.subtasks ?? [];

    const hasAny =
      completions.some(c => c.completed) ||
      subtasks.some(s => s.completed);

    return { ...task, status: hasAny ? 'partial' : 'missed' };
  });
};

// -------------------------------------------------------
// Прилага смяна на правило върху задачите
//
// Логика (проста и предвидима):
//   1. Задачи БЕЗ прогрес и БЕЗ makeup → изтриват се
//   2. Задачи С прогрес или завършени  → запазват се (за история)
//   3. Makeup задачи без прогрес       → изтриват се
//   4. Makeup задачи с прогрес         → запазват се
//   5. Генерираме нови задачи за новото правило
// -------------------------------------------------------
export const applyRuleChange = (allTasks, habit, newRule, applyFromDate, futureOnly = false) => {
  const today = toMidnight(new Date());
  const fromDate = applyFromDate ? toMidnight(new Date(applyFromDate)) : today;

  const otherTasks = allTasks.filter(t => t.habitId !== habit.id);
  const habitTasks = allTasks.filter(t => t.habitId === habit.id);

  // ── Режим „само бъдещи дати" — миналото (преди fromDate) изобщо не се пипа ──
  if (futureOnly) {
    const pastTasks   = habitTasks.filter(t => toMidnight(new Date(t.date)) < fromDate);
    const futureTasks = habitTasks.filter(t => toMidnight(new Date(t.date)) >= fromDate);

    // За бъдещите дни: пазим completed, останалите изхвърляме (за да не останат стари в разрез с новото правило)
    const keptFuture = futureTasks.filter(task => isTaskCompleted(task));
    const cleanedFuture = keptFuture.map(task => {
      let updated = { ...task };
      if (updated.makeupForDate)  updated = { ...updated, makeupForDate: null };
      if (updated.makeupFromDate) updated = { ...updated, makeupFromDate: null, status: 'completed' };
      return updated;
    });

    // Генерираме нови задачи, започвайки точно от fromDate (не от 1-во число на месеца)
    const newTasks = [];
    let current = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
    const endDate = new Date(today.getFullYear(), today.getMonth() + 24, 1);

    while (current <= endDate) {
      const generated = generateTasksForMonth(
        habit,
        [newRule],
        [...pastTasks, ...cleanedFuture, ...newTasks],
        current.getFullYear(),
        current.getMonth(),
        true
      );
      // Подсигуряваме се да не пада нищо преди fromDate
      const filtered = generated.filter(t => toMidnight(new Date(t.date)) >= fromDate);
      newTasks.push(...filtered);
      current.setMonth(current.getMonth() + 1);
    }

    const combined = [...otherTasks, ...pastTasks, ...cleanedFuture, ...newTasks];
    return checkMissedTasks(combined);
  }

  // ── Режим „приложи за всички дати" — поведение както досега ──

  // Запазваме само completed задачи (partial, missed, pending → изхвърляме)
  // Отработени без връзка (createdBy: manual, без makeupFromDate) → запазваме ако са completed
  const keptTasks = habitTasks.filter(task => {
    return isTaskCompleted(task);
  });

  // Почистваме makeup връзки:
  // - ако completed ден е имал makeupForDate → откачаме (makeup денят може да е изчезнал)
  // - ако completed makeup ден (makeupFromDate) → откачаме makeupFromDate и makeupForDate от двата края,
  //   защото оригиналният ден вече е completed сам по себе си
  const cleanedTasks = keptTasks.map(task => {
    let updated = { ...task };

    if (updated.makeupForDate) {
      // Оригиналният ден се наваксвал другаде — откачаме
      updated = { ...updated, makeupForDate: null };
    }

    if (updated.makeupFromDate) {
      // Makeup ден — откачаме връзката, остава като обикновен completed
      updated = { ...updated, makeupFromDate: null, status: 'completed' };
    }

    return updated;
  });

  // Генерираме нови задачи за новото правило
  const newTasks = [];
  const ruleStart = toMidnight(new Date(newRule.startDate));
  const startPoint = fromDate > ruleStart ? fromDate : ruleStart;

  let current = new Date(startPoint.getFullYear(), startPoint.getMonth(), 1);
  const endDate = new Date(today.getFullYear(), today.getMonth() + 24, 1);

  while (current <= endDate) {
    const generated = generateTasksForMonth(
      habit,
      [newRule],
      [...cleanedTasks, ...newTasks],
      current.getFullYear(),
      current.getMonth(),
      true
    );
    newTasks.push(...generated);
    current.setMonth(current.getMonth() + 1);
  }

  // Обединяваме и маркираме пропуснати (минали pending → missed)
  const combined = [...otherTasks, ...cleanedTasks, ...newTasks];
  return checkMissedTasks(combined);
};