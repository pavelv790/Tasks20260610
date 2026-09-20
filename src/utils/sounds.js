// ─────────────────────────────────────────────────────────
// Звукови ефекти — синтезирани (Web Audio API) + по избор потребителски файл за събитие
//
// Глобални настройки (за цялото приложение, не по профили; не влизат в export/import и
// backup-ите), в localStorage:
//   `soundEnabled` — '0' = изключен; всичко друго (включително липсващ) = включен.
//   `soundVolume`  — обща сила 0..1 (по подразбиране 1) за синтезираните И качените звуци.
//   `customSoundVolumes` — JSON { [събитие]: 0..2 } — сила на всеки качен файл поотделно
//                     (по подразбиране 1); умножава се с общата.
//
// Събития: check · complete · allDone · skip · delete · error
// Всяко събитие има синтезиран звук (SOUND_DEFS). Потребителят може да качи свой аудио файл
// за всяко събитие — пази се в IndexedDB (виж storage.js, `customSound_<събитие>`), а при
// липса на файл или при грешка при възпроизвеждане се ползва синтезираният звук.
//
// Потребителските файлове се пускат през ЕДИН общ <audio> елемент (стрийминг, без пълно
// разкодиране в паметта — важно за дълги файлове) → едновременно свири най-много един
// потребителски звук; всеки нов звук прекъсва предишния.
// ─────────────────────────────────────────────────────────

import { saveCustomSound, loadCustomSounds, deleteCustomSound } from './storage';

const STORAGE_KEY = 'soundEnabled';
const VOLUME_KEY  = 'soundVolume';
const FILE_VOLUMES_KEY = 'customSoundVolumes';
// Силата на качен файл може да се усилва до 200 % (за тихи файлове); над 100 % има риск от
// изкривяване при силен файл — затова стойността по подразбиране е 100 %.
export const MAX_FILE_VOLUME = 2;
const MASTER_GAIN = 0.18;
// Ако AudioContext-ът още не е „събуден“ (браузърът иска жест от потребителя), звукът се
// пуска само ако resume() успее веднага — иначе би прозвучал късно, при следващото докосване.
const RESUME_WINDOW_MS = 300;
// Колко да чакаме браузъра да прочете метаданните на качен файл (някои — напр. iOS Safari —
// не ги зареждат без жест; тогава файлът се приема непроверен).
const PROBE_TIMEOUT_MS = 4000;

export const SOUND_LABELS = {
  check:    'Отметка на изпълнение / подзадача',
  complete: 'Завършена задача',
  allDone:  'Браво! Всичко е завършено',
  skip:     'Пропусната задача',
  delete:   'Изтриване',
  error:    'Грешка',
};

// Тон: [честота Hz, начало s, продължителност s, тип на вълната]
const SOUND_DEFS = {
  check:    [[660, 0, 0.09, 'sine']],
  complete: [[523.25, 0, 0.12, 'sine'], [783.99, 0.1, 0.22, 'sine']],
  allDone:  [[523.25, 0, 0.14, 'triangle'], [659.25, 0.13, 0.14, 'triangle'],
             [783.99, 0.26, 0.14, 'triangle'], [1046.5, 0.39, 0.4, 'triangle']],
  skip:     [[320, 0, 0.12, 'triangle'], [240, 0.11, 0.18, 'triangle']],
  delete:   [[440, 0, 0.1, 'triangle'], [294, 0.09, 0.16, 'triangle']],
  error:    [[196, 0, 0.14, 'square'], [196, 0.18, 0.2, 'square']],
};

const MIME_BY_EXT = {
  mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', aac: 'audio/aac',
  ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', webm: 'audio/webm', flac: 'audio/flac',
};

let enabled = null;
let volume  = null;
let ctx = null;
let completeEndsAt = 0;   // performance.now() (ms), до когато свири „complete“

// ── Настройка вкл/изкл ──────────────────────────────────────

export function isSoundEnabled() {
  if (enabled === null) {
    try {
      enabled = localStorage.getItem(STORAGE_KEY) !== '0';
    } catch {
      enabled = true;
    }
  }
  return enabled;
}

export function setSoundEnabled(value) {
  enabled = !!value;
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    // localStorage може да е недостъпен — настройката важи до презареждане
  }
  if (!enabled) stopCustom();
}

// Обща сила 0..1. Умножава се с MASTER_GAIN при синтеза; при качените файлове минава през
// GainNode (`mediaGain`), защото `audio.volume` се игнорира на iOS Safari.
export function getSoundVolume() {
  if (volume === null) {
    let v = 1;
    try {
      const raw = localStorage.getItem(VOLUME_KEY);
      if (raw !== null && Number.isFinite(parseFloat(raw))) v = parseFloat(raw);
    } catch {
      // localStorage може да е недостъпен — важи стойността по подразбиране
    }
    volume = Math.min(1, Math.max(0, v));
  }
  return volume;
}

export function setSoundVolume(value) {
  volume = Math.min(1, Math.max(0, Number(value) || 0));
  try {
    localStorage.setItem(VOLUME_KEY, String(volume));
  } catch {
    // важи до презареждане
  }
  applyCustomVolume();
}

// ── Потребителски файлове ───────────────────────────────────

const customs = new Map();   // event → { url, name, size, duration, volume }
let currentEvent = null;    // събитието, чийто файл свири/последно е свирил през общия <audio>
let audioEl = null;
let mediaGain = null;   // GainNode след <audio> елемента (ако има AudioContext)
let customReady = null;

// Зарежда записаните файлове (веднъж). Blob-овете в IndexedDB са файлово подкрепени —
// тук само правим object URL-и, не четем съдържанието в паметта.
export function ensureCustomSounds() {
  customReady ??= loadCustomSounds().then(all => {
    const volumes = readFileVolumes();
    Object.entries(all).forEach(([event, rec]) => {
      if (!SOUND_DEFS[event] || customs.has(event)) return;
      customs.set(event, {
        url: URL.createObjectURL(rec.blob), name: rec.name, size: rec.size, duration: rec.duration,
        volume: event in volumes ? clampFileVolume(volumes[event]) : 1,
      });
    });
  }).catch(() => {});
  return customReady;
}

// Копие само с показваното: { [event]: { name, size, duration, volume } }
export function getCustomSoundsInfo() {
  const out = {};
  customs.forEach(({ name, size, duration, volume }, event) => { out[event] = { name, size, duration, volume }; });
  return out;
}

// Ефективна сила на текущия качен файл = обща × на файла. Без AudioContext (fallback към
// audio.volume) е ограничена до 1 — там усилване не е възможно.
function applyCustomVolume() {
  const v = getSoundVolume() * (customs.get(currentEvent)?.volume ?? 1);
  if (mediaGain) mediaGain.gain.value = v;
  else if (audioEl) audioEl.volume = Math.min(1, v);
}

const clampFileVolume = (v) => Math.min(MAX_FILE_VOLUME, Math.max(0, Number(v) || 0));

function readFileVolumes() {
  try {
    const parsed = JSON.parse(localStorage.getItem(FILE_VOLUMES_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeFileVolume(event, value) {
  const all = readFileVolumes();
  if (value === null) delete all[event];
  else all[event] = value;
  try {
    localStorage.setItem(FILE_VOLUMES_KEY, JSON.stringify(all));
  } catch {
    // важи до презареждане
  }
}

// Сила на качения файл за събитие (0..MAX_FILE_VOLUME)
export function setCustomSoundVolume(event, value) {
  const entry = customs.get(event);
  if (!entry) return;
  entry.volume = clampFileVolume(value);
  writeFileVolume(event, entry.volume);
  if (currentEvent === event) applyCustomVolume();
}

function getAudioEl() {
  if (!audioEl) {
    audioEl = new Audio();
    const audioCtx = getContext();
    if (audioCtx?.createMediaElementSource) {
      try {
        mediaGain = audioCtx.createGain();
        audioCtx.createMediaElementSource(audioEl).connect(mediaGain).connect(audioCtx.destination);
      } catch {
        mediaGain = null;   // падаме към audio.volume
      }
    }
    applyCustomVolume();
  }
  return audioEl;
}

function stopCustom() {
  if (!audioEl) return;
  audioEl.pause();
}

const guessType = (file) => {
  if (file.type) return file.type;
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  return MIME_BY_EXT[ext] ?? '';
};

// Resolve → duration (сек.) или null ако не е известна; reject → файлът не може да се чете.
function probeAudio(url) {
  return new Promise((resolve, reject) => {
    const a = new Audio();
    let settled = false;
    const done = (fn, v) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      a.onloadedmetadata = null;
      a.onerror = null;
      a.removeAttribute('src');   // освобождава файла
      fn(v);
    };
    const timer = setTimeout(() => done(resolve, null), PROBE_TIMEOUT_MS);
    a.preload = 'metadata';
    a.onloadedmetadata = () => done(resolve, Number.isFinite(a.duration) ? a.duration : null);
    a.onerror = () => done(reject, new Error('unreadable'));
    a.src = url;
  });
}

// Качва файл за събитие. Връща { ok: true } или { ok: false, error }.
export async function setCustomSound(event, file) {
  if (!SOUND_DEFS[event]) return { ok: false, error: 'Непознато събитие.' };
  const blob = new Blob([file], { type: guessType(file) });
  const url  = URL.createObjectURL(blob);

  let duration;
  try {
    duration = await probeAudio(url);
  } catch {
    URL.revokeObjectURL(url);
    return { ok: false, error: 'Файлът не може да се възпроизведе на това устройство. Пробвай MP3, WAV или M4A.' };
  }

  const saved = await saveCustomSound(event, blob, { name: file.name, duration });
  if (!saved) {
    URL.revokeObjectURL(url);
    return { ok: false, error: 'Файлът не може да се запази на това устройство (няма място или не се поддържа).' };
  }

  const prev = customs.get(event);
  if (prev) URL.revokeObjectURL(prev.url);
  customs.set(event, { url, name: file.name, size: blob.size, duration, volume: 1 });
  writeFileVolume(event, null);   // нов файл — нова сила (100 %)
  return { ok: true };
}

export async function removeCustomSound(event) {
  await deleteCustomSound(event);
  writeFileVolume(event, null);
  const prev = customs.get(event);
  if (prev) {
    URL.revokeObjectURL(prev.url);
    customs.delete(event);
  }
}

function playCustom(event, entry, delaySec, fallback) {
  const start = () => {
    const el = getAudioEl();
    currentEvent = event;
    applyCustomVolume();
    // Изходът минава през AudioContext — при „suspended“ иска събуждане (в рамките на жеста)
    if (mediaGain && ctx?.state !== 'running') ctx.resume?.().catch(() => {});
    el.src = entry.url;   // нов src прекъсва предишния звук
    el.play().catch((err) => {
      // NotAllowedError (няма жест) / AbortError (прекъснат от следващ звук) — мълчим;
      // нечетим файл — падаме към синтезирания звук.
      if (err?.name === 'NotSupportedError') fallback();
    });
  };
  if (delaySec > 0) setTimeout(start, delaySec * 1000);
  else start();
}

// ── Синтезирани звуци ───────────────────────────────────────

function getContext() {
  if (ctx) return ctx;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  try {
    ctx = new AudioCtx();
  } catch {
    ctx = null;
  }
  return ctx;
}

function schedule(audioCtx, tones, delaySec) {
  const peak = MASTER_GAIN * getSoundVolume();
  if (peak <= 0.0001) return;   // сила 0 — тихо (exponentialRamp не понася 0)
  const t0 = audioCtx.currentTime + delaySec;
  tones.forEach(([freq, start, dur, wave]) => {
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = wave;
    osc.frequency.value = freq;
    // Кратко нарастване и плавно затихване — без „щракване“ в началото/края
    gain.gain.setValueAtTime(0.0001, t0 + start);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t0 + start);
    osc.stop(t0 + start + dur + 0.02);
  });
}

function playSynth(tones, delaySec) {
  const audioCtx = getContext();
  if (!audioCtx) return;
  const requestedAt = performance.now();
  if (audioCtx.state === 'running') {
    schedule(audioCtx, tones, delaySec);
    return;
  }
  audioCtx.resume?.().then(() => {
    if (audioCtx.state === 'running' && performance.now() - requestedAt < RESUME_WINDOW_MS) {
      schedule(audioCtx, tones, delaySec);
    }
  }).catch(() => {});
}

// ── Публичен вход ───────────────────────────────────────────

export function playSound(event) {
  if (!isSoundEnabled()) return;
  const tones = SOUND_DEFS[event];
  if (!tones) return;

  // „Браво“ изчаква да свърши „complete“, за да не се застъпват
  const now      = performance.now();
  const delaySec = event === 'allDone' ? Math.max(0, (completeEndsAt - now) / 1000) : 0;
  if (event === 'complete') completeEndsAt = now + 350;

  stopCustom();   // най-много един потребителски звук наведнъж
  const custom = customs.get(event);
  if (custom) playCustom(event, custom, delaySec, () => playSynth(tones, 0));
  else playSynth(tones, delaySec);
}

// Зареждаме записаните файлове още при старт, за да са готови към първия звук
ensureCustomSounds();
