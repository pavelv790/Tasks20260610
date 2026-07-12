// ============================================================
// storage.js
// Отговорност: четене и запис в IndexedDB
// ============================================================

const DB_NAME    = 'habitTrackerDB';
const DB_VERSION = 1;
const STORE_NAME = 'appData';
const DATA_KEY   = 'main';

const EMPTY_DATA = {
  habits:         [],
  tasks:          [],
  rules:          [],
  archivedHabits: [],
  dayOrders:      {},
};

// Отваря (или създава) базата данни
const openDB = () => new Promise((resolve, reject) => {
  const req = indexedDB.open(DB_NAME, DB_VERSION);
  req.onupgradeneeded = e => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME);
    }
  };
  req.onsuccess = e => resolve(e.target.result);
  req.onerror   = e => reject(e.target.error);
});

// Зарежда данните
export const loadAppData = async () => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(DATA_KEY);
      req.onsuccess = e => {
        const parsed = e.target.result;
        if (!parsed) { resolve({ ...EMPTY_DATA }); return; }
        resolve({
          habits:         parsed.habits         ?? [],
          tasks:          parsed.tasks          ?? [],
          rules:          parsed.rules          ?? [],
          archivedHabits: parsed.archivedHabits ?? [],
          dayOrders:      parsed.dayOrders      ?? {},
        });
      };
      req.onerror = e => reject(e.target.error);
    });
  } catch {
    return { ...EMPTY_DATA };
  }
};

// Запазва данните
export const saveAppData = async (data) => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).put(data, DATA_KEY);
      req.onsuccess = () => resolve(true);
      req.onerror   = e => reject(e.target.error);
    });
  } catch {
    return false;
  }
};

// Изчиства всичко
export const clearAppData = async () => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).clear();
      req.onsuccess = () => resolve(true);
      req.onerror   = e => reject(e.target.error);
    });
  } catch {
    return false;
  }
};

// Запазва резервно копие
export const saveBackup = async (data) => {
  try {
    const db  = await openDB();
    const key = `backup_${Date.now()}`;
    await new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).put(data, key);
      req.onsuccess = () => resolve(true);
      req.onerror   = e => reject(e.target.error);
    });
    // Пазим само последните 5 backup-а
    const allKeys = await new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAllKeys();
      req.onsuccess = e => resolve(e.target.result);
      req.onerror   = e => reject(e.target.error);
    });
    const backupKeys = allKeys.filter(k => k.startsWith('backup_')).sort();
    if (backupKeys.length > 5) {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      backupKeys.slice(0, backupKeys.length - 5).forEach(k => tx.objectStore(STORE_NAME).delete(k));
    }
    return true;
  } catch {
    return false;
  }
};

// Връща списък с backup-и
export const listBackups = async () => {
  try {
    const db = await openDB();
    const allKeys = await new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAllKeys();
      req.onsuccess = e => resolve(e.target.result);
      req.onerror   = e => reject(e.target.error);
    });
    return allKeys
      .filter(k => k.startsWith('backup_'))
      .map(key => {
        const ts = parseInt(key.replace('backup_', ''));
        return { key, timestamp: ts, dateStr: new Date(ts).toLocaleString('bg-BG') };
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  } catch {
    return [];
  }
};

// Зарежда конкретен backup
export const loadBackup = async (key) => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = e => resolve(e.target.result ?? null);
      req.onerror   = e => reject(e.target.error);
    });
  } catch {
    return null;
  }
};