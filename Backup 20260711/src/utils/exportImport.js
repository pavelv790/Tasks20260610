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