// ============================================================
// dateUtils.js
// Отговорност: форматиране и сравнение на дати
// ============================================================

export const MONTH_NAMES_BG = [
  'януари', 'февруари', 'март', 'април', 'май', 'юни',
  'юли', 'август', 'септември', 'октомври', 'ноември', 'декември',
];

export const MONTH_NAMES_BG_CAP = [
  'Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни',
  'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември',
];

export const WEEKDAY_NAMES_BG = ['Пон', 'Вт', 'Ср', 'Чет', 'Пет', 'Съб', 'Нед'];

// Форматира Date обект като 'YYYY-MM-DD' стринг
export const formatDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Форматира дата за показване: "3 януари 2025"
export const formatDisplayDate = (date) => {
  const d = new Date(date);
  return `${d.getDate()} ${MONTH_NAMES_BG[d.getMonth()]} ${d.getFullYear()}`;
};

// Форматира дата за показване с "Днес - " ако е днес
export const formatDisplayDateWithToday = (date) => {
  if (isSameDay(date, new Date())) {
    return `Днес - ${formatDisplayDate(date)}`;
  }
  return formatDisplayDate(date);
};

// Форматира кратко: "3.1" (ден.месец)
export const formatShortDate = (dateStr) => {
  const d = new Date(dateStr);
  return `${d.getDate()}.${d.getMonth() + 1}`;
};

// Нормализира Date до полунощ (00:00:00)
export const toMidnight = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Проверява дали два Date обекта са на един и същи ден
export const isSameDay = (a, b) => {
  return toMidnight(a).getTime() === toMidnight(b).getTime();
};

// Проверява дали дата е днес
export const isToday = (date) => isSameDay(date, new Date());

// Проверява дали дата е в миналото (преди днес)
export const isPastDate = (date) => {
  return toMidnight(date) < toMidnight(new Date());
};

// Връща 'YYYY-MM-DD' стринг за днес
export const todayStr = () => formatDate(new Date());

// Добавя N дни към дата и връща нов Date обект
export const addDays = (date, n) => {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
};