// ============================================================
// constants.js
// Отговорност: константи използвани в цялото приложение
// ============================================================

export const COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
  '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
  '#F8B739', '#52C79F', '#FF8E9E', '#A29BFE',
];

export const WEEKDAY_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
  '#98D8C8', '#F7DC6F', '#BB8FCE',
];

// Суфикс за поредния номер при завършвания (1-ви, 2-ри, 3-ти, 7-ми, 8-ми...)
export const ORDINAL_SUFFIX = (n) => {
  const lastTwo   = n % 100;
  const lastDigit = n % 10;
  if (lastTwo === 11 || lastTwo === 12) return 'ти';
  if (lastDigit === 1) return 'ви';
  if (lastDigit === 2) return 'ри';
  if (lastDigit === 7 || lastDigit === 8) return 'ми';
  return 'ти';
};