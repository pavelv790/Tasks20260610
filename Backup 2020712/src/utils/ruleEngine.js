// ============================================================
// ruleEngine.js
// Отговорност: проверява дали дадена дата попада в правило
// ============================================================

import { toMidnight } from './dateUtils';

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