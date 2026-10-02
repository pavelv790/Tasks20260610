// ============================================================
// ruleEngine.js
// Отговорност: проверява дали дадена дата попада в правило
// ============================================================

import { toMidnight, formatDate } from './dateUtils';

// Главна функция — връща true ако датата попада в правилото
export const doesDateMatchRule = (date, rule) => {
  if (!rule?.isActive) return false;

  const start = toMidnight(new Date(rule.startDate));
  const check = toMidnight(new Date(date));

  if (check < start) return false;

  if (rule.type === 'simple')  return matchSimple(check, start, rule);
  if (rule.type === 'complex') return matchComplex(check, rule);

  return false;
};

// -------------------------------------------------------
// Прости шаблони
// -------------------------------------------------------
const matchSimple = (check, start, rule) => {
  switch (rule.simplePattern) {
    case 'today':
      return check.getTime() === start.getTime();

    case 'daily':
      return true;

    case 'every_other_day': {
      const diff = daysBetween(start, check);
      return diff % 2 === 0;
    }

    case 'custom_interval': {
      const diff = daysBetween(start, check);
      return diff % rule.customInterval === 0;
    }

    case 'monthly':
      return matchMonthly(check, rule.monthlyDay);

    case 'yearly':
      return matchYearly(check, rule.yearlyMonth, rule.yearlyDay);

    default:
      return false;
  }
};

// -------------------------------------------------------
// Сложен шаблон — конкретни дни от седмицата
// -------------------------------------------------------
const matchComplex = (check, rule) => {
  // JS: 0=Неделя, 1=Пон...6=Съб → нормализираме до 0=Пон...6=Нед
  const js = check.getDay();
  const normalized = js === 0 ? 6 : js - 1;
  return (rule.complexDays ?? []).includes(normalized);
};

// -------------------------------------------------------
// Помощни функции
// -------------------------------------------------------

// Брой дни между два Date обекта (само цели дни)
const daysBetween = (a, b) =>
  Math.round((b - a) / (1000 * 60 * 60 * 24));

// Месечно правило — взема предвид месеци с по-малко дни
const matchMonthly = (check, monthlyDay) => {
  const lastDay = new Date(check.getFullYear(), check.getMonth() + 1, 0).getDate();
  return check.getDate() === Math.min(monthlyDay, lastDay);
};

// Годишно правило — взема предвид февруари
const matchYearly = (check, yearlyMonth, yearlyDay) => {
  if (check.getMonth() !== yearlyMonth) return false;
  const lastDay = new Date(check.getFullYear(), yearlyMonth + 1, 0).getDate();
  return check.getDate() === Math.min(yearlyDay, lastDay);
};

// Търси следващата дата от правилото след дадена дата
// Търси в рамките на maxDays дни напред
export const getNextRuleDate = (fromDate, rule, maxDays = 60) => {
  for (let i = 1; i <= maxDays; i++) {
    const candidate = new Date(fromDate);
    candidate.setDate(candidate.getDate() + i);
    if (doesDateMatchRule(candidate, rule)) return toMidnight(candidate);
  }
  return null;
};

// -------------------------------------------------------
// Краен срок („показвай всеки ден, докато не я изпълня")
//
// rule.deadline (по избор):
//   { type: 'days',     days: N }          — показва се N дни (вкл. деня на появата)
//   { type: 'weekdays', weekdays: [0..6] } — до първия такъв ден от седмицата (0=Пон)
//   { type: 'monthly',  day: 1..31 }       — до първото такова число (клипва се към
//                                            последния ден на по-късите месеци)
//   { type: 'yearly',   month: 0..11, day } — до първата такава дата
//   { type: 'next' }                       — до деня преди следващото повторение
//
// При weekdays/monthly/yearly денят на появата НЕ се брои — ако съвпада, срокът е
// следващото срещане (напр. появява се на 21-во, срок „21-во" → 21-во следващия месец).
// Денят на срока е последният ден, в който задачата още НЕ е пропусната.
// -------------------------------------------------------

const lastDayOf = (y, m) => new Date(y, m + 1, 0).getDate();

// Първата дата СЛЕД `start`, за която match(date) е true (търси до maxDays напред)
const firstAfter = (start, match, maxDays) => {
  for (let i = 1; i <= maxDays; i++) {
    const c = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    if (match(c)) return c;
  }
  return null;
};

// Връща "YYYY-MM-DD" — последният ден, в който задачата от `dateStr` още не е
// пропусната, или null (няма краен срок → задачата важи само за деня си).
export const computeDueDate = (dateStr, rule) => {
  const dl = rule?.deadline;
  if (!dl || !dateStr) return null;
  const start = new Date(dateStr + 'T00:00:00');
  let due;

  switch (dl.type) {
    case 'days': {
      const n = Math.max(1, parseInt(dl.days) || 1);
      due = new Date(start.getFullYear(), start.getMonth(), start.getDate() + n - 1);
      break;
    }
    case 'weekdays': {
      const days = dl.weekdays ?? [];
      if (days.length === 0) return null;
      due = firstAfter(start, c => days.includes(c.getDay() === 0 ? 6 : c.getDay() - 1), 7);
      break;
    }
    case 'monthly':
      due = firstAfter(start, c => c.getDate() === Math.min(dl.day, lastDayOf(c.getFullYear(), c.getMonth())), 62);
      break;
    case 'yearly':
      due = firstAfter(start, c =>
        c.getMonth() === dl.month && c.getDate() === Math.min(dl.day, lastDayOf(c.getFullYear(), dl.month)), 370);
      break;
    case 'next': {
      const maxDays = Math.max(800, (parseInt(rule.customInterval) || 0) + 1);
      const next = getNextRuleDate(start, rule, maxDays);
      if (!next) return null;
      due = new Date(next.getFullYear(), next.getMonth(), next.getDate() - 1);
      break;
    }
    default:
      return null;
  }
  return due ? formatDate(due) : null;
};
