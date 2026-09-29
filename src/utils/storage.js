// ============================================================
// storage.js
// Отговорност: четене и запис в IndexedDB
//
// Профили: данните на всеки профил живеят под ключ
// `profileData_<profileId>`; списъкът с профили и активният профил —
// под ключ `profilesMeta`. Backup-ите са per-profile:
// `backup_<profileId>_<timestamp>`.
//
// Обратна съвместимост: старият единствен запис под ключ `main` и
// старите backup-и `backup_<timestamp>` се мигрират еднократно към
// профил „Основен“ при първо зареждане. Старият `main` НЕ се трие.
// ============================================================

const DB_NAME    = 'habitTrackerDB';
const DB_VERSION = 1;
const STORE_NAME = 'appData';

const LEGACY_DATA_KEY = 'main';
const META_KEY        = 'profilesMeta';

const EMPTY_DATA = {
  habits:         [],
  tasks:          [],
  rules:          [],
  archivedHabits: [],
  todos:          [],
  dayOrders:      {},
};

// Палитра за автоматичен цвят на новите профили
export const PROFILE_COLORS = [
  '#6366f1', '#ec4899', '#14b8a6', '#f59e0b',
  '#8b5cf6', '#ef4444', '#10b981', '#3b82f6',
];

// Схема-маркер за export на всички профили наведнъж
export const MULTI_PROFILE_SCHEMA = 'tasks-multiprofile-v1';

const genProfileId    = () => `p_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
const dataKeyFor      = (id) => `profileData_${id}`;
const backupPrefixFor = (id) => `backup_${id}_`;

// Нормализира произволен запис до пълната структура на данните
const normalizeData = (parsed) => ({
  habits:         parsed?.habits         ?? [],
  tasks:          parsed?.tasks          ?? [],
  rules:          parsed?.rules          ?? [],
  archivedHabits: parsed?.archivedHabits ?? [],
  todos:          parsed?.todos          ?? [],
  dayOrders:      parsed?.dayOrders      ?? {},
});

// ── Ниско ниво: обвивки около IndexedDB ─────────────────────

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

// Една връзка за целия live на страницата
let dbPromise = null;
const getDB = () => (dbPromise ??= openDB());

const idbGet = (db, key) => new Promise((res, rej) => {
  const r = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key);
  r.onsuccess = e => res(e.target.result);
  r.onerror   = e => rej(e.target.error);
});

const idbPut = (db, key, val) => new Promise((res, rej) => {
  const r = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(val, key);
  r.onsuccess = () => res(true);
  r.onerror   = e => rej(e.target.error);
});

const idbDel = (db, key) => new Promise((res, rej) => {
  const r = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(key);
  r.onsuccess = () => res(true);
  r.onerror   = e => rej(e.target.error);
});

const idbAllKeys = (db) => new Promise((res, rej) => {
  const r = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAllKeys();
  r.onsuccess = e => res(e.target.result ?? []);
  r.onerror   = e => rej(e.target.error);
});

// ── Профили: миграция + мета ────────────────────────────────

// Миграцията се пуска ТОЧНО веднъж за живота на страницата.
// Кешираме промиса, за да не се състезават паралелните извиквания
// (loadProfilesMeta + loadAppData + saveAppData при монтиране).
let initPromise = null;

const runInit = async () => {
  const db = await getDB();
  const existing = await idbGet(db, META_KEY);
  if (existing && Array.isArray(existing.profiles) && existing.profiles.length > 0) {
    if (!existing.profiles.some(p => p.id === existing.activeId)) {
      existing.activeId = existing.profiles[0].id;
      await idbPut(db, META_KEY, existing);
    }
    return;
  }

  const legacy = await idbGet(db, LEGACY_DATA_KEY);
  const id = genProfileId();
  const profile = { id, name: 'Основен', color: PROFILE_COLORS[0], createdAt: Date.now() };
  await idbPut(db, dataKeyFor(id), legacy ? normalizeData(legacy) : { ...EMPTY_DATA });

  // Копираме старите backup-и (`backup_<цифри>`) към новия профил
  try {
    const keys = await idbAllKeys(db);
    for (const k of keys) {
      if (typeof k === 'string' && /^backup_\d+$/.test(k)) {
        const ts = k.slice('backup_'.length);
        const b  = await idbGet(db, k);
        if (b) await idbPut(db, `${backupPrefixFor(id)}${ts}`, b);
      }
    }
  } catch { /* копирането на стари backup-и не е критично */ }

  await idbPut(db, META_KEY, { activeId: id, profiles: [profile] });
};

const ensureInit = () => {
  if (!initPromise) {
    initPromise = runInit().catch(err => {
      initPromise = null; // позволяваме нов опит при следваща заявка
      throw err;
    });
  }
  return initPromise;
};

// Чете текущата мета (след като миграцията е гарантирана)
const readMeta = async () => {
  await ensureInit();
  const db = await getDB();
  const meta = await idbGet(db, META_KEY);
  if (meta && Array.isArray(meta.profiles) && meta.profiles.length > 0) return meta;
  // Краен fallback — не би трябвало да се стига дотук
  const id = genProfileId();
  return { activeId: id, profiles: [{ id, name: 'Основен', color: PROFILE_COLORS[0], createdAt: Date.now() }] };
};

const resolveId = (meta, profileId) =>
  (profileId && meta.profiles.some(p => p.id === profileId)) ? profileId : meta.activeId;

// Връща { activeId, profiles: [{ id, name, color, createdAt }] }
export const loadProfilesMeta = async () => {
  try {
    return await readMeta();
  } catch {
    const id = genProfileId();
    return { activeId: id, profiles: [{ id, name: 'Основен', color: PROFILE_COLORS[0], createdAt: Date.now() }] };
  }
};

export const setActiveProfile = async (profileId) => {
  try {
    const db = await getDB();
    const meta = await readMeta();
    if (!meta.profiles.some(p => p.id === profileId)) return meta;
    const next = { ...meta, activeId: profileId };
    await idbPut(db, META_KEY, next);
    return next;
  } catch {
    return null;
  }
};

// Създава нов празен профил (НЕ го прави активен). Връща новата мета.
export const createProfile = async (name) => {
  const db = await getDB();
  const meta = await readMeta();
  const used = new Set(meta.profiles.map(p => p.color));
  const color = PROFILE_COLORS.find(c => !used.has(c)) ?? PROFILE_COLORS[meta.profiles.length % PROFILE_COLORS.length];
  const profile = {
    id: genProfileId(),
    name: (name || '').trim() || `Профил ${meta.profiles.length + 1}`,
    color,
    createdAt: Date.now(),
  };
  await idbPut(db, dataKeyFor(profile.id), { ...EMPTY_DATA });
  const next = { ...meta, profiles: [...meta.profiles, profile] };
  await idbPut(db, META_KEY, next);
  return { meta: next, profile };
};

export const renameProfile = async (profileId, name) => {
  const db = await getDB();
  const meta = await readMeta();
  const next = {
    ...meta,
    profiles: meta.profiles.map(p =>
      p.id === profileId ? { ...p, name: (name || '').trim() || p.name } : p
    ),
  };
  await idbPut(db, META_KEY, next);
  return next;
};

// Трие профил заедно с данните и backup-ите му. Не позволява да
// остане без профили — извикващият трябва да пази поне един.
export const deleteProfile = async (profileId) => {
  const db = await getDB();
  const meta = await readMeta();
  if (meta.profiles.length <= 1) return meta;
  if (!meta.profiles.some(p => p.id === profileId)) return meta;

  await idbDel(db, dataKeyFor(profileId));
  try {
    const keys = await idbAllKeys(db);
    const prefix = backupPrefixFor(profileId);
    for (const k of keys) {
      if (typeof k === 'string' && k.startsWith(prefix)) await idbDel(db, k);
    }
  } catch { /* без значение */ }

  const profiles = meta.profiles.filter(p => p.id !== profileId);
  const activeId = meta.activeId === profileId ? profiles[0].id : meta.activeId;
  const next = { activeId, profiles };
  await idbPut(db, META_KEY, next);
  return next;
};

// ── Данни на активния профил ───────────────────────────────

export const loadAppData = async (profileId) => {
  try {
    const db = await getDB();
    const meta = await readMeta();
    const id = resolveId(meta, profileId);
    const parsed = await idbGet(db, dataKeyFor(id));
    return parsed ? normalizeData(parsed) : { ...EMPTY_DATA };
  } catch {
    return { ...EMPTY_DATA };
  }
};

export const saveAppData = async (data, profileId) => {
  try {
    const db = await getDB();
    const meta = await readMeta();
    const id = resolveId(meta, profileId);
    await idbPut(db, dataKeyFor(id), normalizeData(data));
    return true;
  } catch {
    return false;
  }
};

// Нулира данните на един профил (профилът остава да съществува)
export const clearAppData = async (profileId) => {
  try {
    const db = await getDB();
    const meta = await readMeta();
    const id = resolveId(meta, profileId);
    await idbPut(db, dataKeyFor(id), { ...EMPTY_DATA });
    return true;
  } catch {
    return false;
  }
};

// Трие ВСИЧКИ профили и започва наново с един празен „Основен“.
// Локалните backup-и на всички профили също се трият.
export const resetAllProfiles = async () => {
  try {
    const db = await getDB();
    await ensureInit();
    const keys = await idbAllKeys(db);
    for (const k of keys) {
      if (typeof k !== 'string') continue;
      if (k === META_KEY || k.startsWith('profileData_') || /^backup_/.test(k)) {
        await idbDel(db, k);
      }
    }
    const id = genProfileId();
    const profile = { id, name: 'Основен', color: PROFILE_COLORS[0], createdAt: Date.now() };
    await idbPut(db, dataKeyFor(id), { ...EMPTY_DATA });
    const meta = { activeId: id, profiles: [profile] };
    await idbPut(db, META_KEY, meta);
    return meta;
  } catch {
    return null;
  }
};

// ── Export / import на всички профили ───────────────────────

// Връща { schema, exportedAt, activeId, profiles: [{ id, name, color, createdAt, data }] }
export const loadAllProfilesExport = async () => {
  const db = await getDB();
  const meta = await readMeta();
  const profiles = [];
  for (const p of meta.profiles) {
    const parsed = await idbGet(db, dataKeyFor(p.id));
    profiles.push({
      id: p.id,
      name: p.name,
      color: p.color,
      createdAt: p.createdAt,
      data: parsed ? normalizeData(parsed) : { ...EMPTY_DATA },
    });
  }
  return {
    schema: MULTI_PROFILE_SCHEMA,
    exportedAt: Date.now(),
    activeId: meta.activeId,
    profiles,
  };
};

// Заменя ЦЕЛИЯ набор профили с този от export плик. Връща новата мета.
export const importAllProfiles = async (envelope) => {
  const db = await getDB();
  await ensureInit();
  const keys = await idbAllKeys(db);
  for (const k of keys) {
    if (typeof k !== 'string') continue;
    if (k === META_KEY || k.startsWith('profileData_') || /^backup_/.test(k)) {
      await idbDel(db, k);
    }
  }
  const profiles = [];
  (envelope.profiles ?? []).forEach((p, i) => {
    const id = typeof p.id === 'string' && p.id ? p.id : genProfileId();
    profiles.push({
      id,
      name: (p.name || '').trim() || `Профил ${i + 1}`,
      color: p.color || PROFILE_COLORS[i % PROFILE_COLORS.length],
      createdAt: p.createdAt ?? Date.now(),
    });
  });
  if (profiles.length === 0) {
    const id = genProfileId();
    profiles.push({ id, name: 'Основен', color: PROFILE_COLORS[0], createdAt: Date.now() });
  }
  for (let i = 0; i < profiles.length; i++) {
    const src = envelope.profiles?.[i]?.data ?? {};
    await idbPut(db, dataKeyFor(profiles[i].id), normalizeData(src));
  }
  const activeId = profiles.some(p => p.id === envelope.activeId) ? envelope.activeId : profiles[0].id;
  const meta = { activeId, profiles };
  await idbPut(db, META_KEY, meta);
  return meta;
};

// ── Backup-и (per-profile) ─────────────────────────────────

// Автоматичните копия (преди заместване/изтриване) имат ключ `backup_<id>_auto_<ts>` и собствен
// лимит — така не изтласкват ръчните (`backup_<id>_<ts>`, лимит 5).
const AUTO_TAG        = 'auto_';
const MANUAL_BACKUPS  = 5;
const AUTO_BACKUPS    = 3;

// Има ли профилът какво да се губи (само реалното съдържание; празните dayOrders не се броят)
export const hasProfileData = (data) =>
  ['habits', 'tasks', 'rules', 'archivedHabits', 'todos'].some(k => Array.isArray(data?.[k]) && data[k].length > 0);

const parseBackupKey = (key, prefix) => {
  const rest = key.slice(prefix.length);
  const auto = rest.startsWith(AUTO_TAG);
  return { auto, timestamp: parseInt(auto ? rest.slice(AUTO_TAG.length) : rest) };
};

// options.auto — автоматично копие (отделен лимит). Връща true/false.
export const saveBackup = async (data, profileId, { auto = false } = {}) => {
  try {
    const db = await getDB();
    const meta = await readMeta();
    const id = resolveId(meta, profileId);
    const prefix = backupPrefixFor(id);
    const key = `${prefix}${auto ? AUTO_TAG : ''}${Date.now()}`;
    await idbPut(db, key, normalizeData(data));
    // Проверка, че записът реално е там (не мълчаливо неуспешен)
    if (!(await idbGet(db, key))) return false;

    const allKeys = await idbAllKeys(db);
    const same = allKeys
      .filter(k => typeof k === 'string' && k.startsWith(prefix) && parseBackupKey(k, prefix).auto === auto)
      .sort((a, b) => parseBackupKey(a, prefix).timestamp - parseBackupKey(b, prefix).timestamp);
    const limit = auto ? AUTO_BACKUPS : MANUAL_BACKUPS;
    if (same.length > limit) {
      for (const k of same.slice(0, same.length - limit)) await idbDel(db, k);
    }
    return true;
  } catch {
    return false;
  }
};

export const listBackups = async (profileId) => {
  try {
    const db = await getDB();
    const meta = await readMeta();
    const id = resolveId(meta, profileId);
    const prefix = backupPrefixFor(id);
    const allKeys = await idbAllKeys(db);
    return allKeys
      .filter(k => typeof k === 'string' && k.startsWith(prefix))
      .map(key => {
        const { auto, timestamp: ts } = parseBackupKey(key, prefix);
        return { key, auto, timestamp: ts, dateStr: new Date(ts).toLocaleString('bg-BG') };
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  } catch {
    return [];
  }
};

export const loadBackup = async (key) => {
  try {
    const db = await getDB();
    const parsed = await idbGet(db, key);
    return parsed ? normalizeData(parsed) : null;
  } catch {
    return null;
  }
};

// ── Потребителски звуци (глобални — не са част от профилите) ──
// Ключ `customSound_<събитие>` → { blob, name, size, duration }.
// Не се обхождат от resetAllProfiles / importAllProfiles / backup-ите (те филтрират по
// конкретни префикси), не влизат в export и не се пипат при смяна на профил.

const CUSTOM_SOUND_PREFIX = 'customSound_';

// Записва файла и го чете обратно — ако устройството не може да пази Blob (стари iOS) или
// няма място, връща false, вместо да остави „повреден“ запис.
export const saveCustomSound = async (event, blob, info) => {
  try {
    const db  = await getDB();
    const key = `${CUSTOM_SOUND_PREFIX}${event}`;
    await idbPut(db, key, { blob, name: info.name, size: blob.size, duration: info.duration ?? null });
    const back = await idbGet(db, key);
    if (!back?.blob || back.blob.size !== blob.size) {
      await idbDel(db, key);
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

// { [event]: { blob, name, size, duration } }
export const loadCustomSounds = async () => {
  try {
    const db   = await getDB();
    const keys = await idbAllKeys(db);
    const out  = {};
    for (const k of keys) {
      if (typeof k !== 'string' || !k.startsWith(CUSTOM_SOUND_PREFIX)) continue;
      const rec = await idbGet(db, k);
      if (rec?.blob) out[k.slice(CUSTOM_SOUND_PREFIX.length)] = rec;
    }
    return out;
  } catch {
    return {};
  }
};

export const deleteCustomSound = async (event) => {
  try {
    const db = await getDB();
    await idbDel(db, `${CUSTOM_SOUND_PREFIX}${event}`);
    return true;
  } catch {
    return false;
  }
};
