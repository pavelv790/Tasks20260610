export const exportToJson = (data, filename) => {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const today = new Date().toISOString().split('T')[0];
  a.download = filename ?? `Задачи_Backup_${today}.json`;
  a.click();
  URL.revokeObjectURL(url);
};
export const validateAppData = (data) => {
  if (!data || typeof data !== 'object') return 'Файлът не съдържа валидни данни.';
  const arrays = ['habits', 'tasks', 'rules', 'archivedHabits'];
  for (const key of arrays) {
    if (!Array.isArray(data[key])) return `Липсва или е повреден списъкът "${key}".`;
  }
  for (const h of data.habits) {
    if (!h || typeof h.id !== 'string' || typeof h.name !== 'string') {
      return 'Данните за задачите (habits) са повредени.';
    }
  }
  for (const t of data.tasks) {
    if (!t || typeof t.id !== 'string' || typeof t.habitId !== 'string' || typeof t.date !== 'string') {
      return 'Данните за задачите по дни (tasks) са повредени.';
    }
  }
  for (const r of data.rules) {
    if (!r || typeof r.id !== 'string' || typeof r.habitId !== 'string') {
      return 'Данните за правилата (rules) са повредени.';
    }
  }
  if (data.dayOrders !== undefined && (typeof data.dayOrders !== 'object' || Array.isArray(data.dayOrders))) {
    return 'Данните за подредбата по дни (dayOrders) са повредени.';
  }
  return null;
};

export const importFromJson = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        resolve(JSON.parse(e.target.result));
      } catch {
        reject(new Error('Невалиден JSON файл'));
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
};