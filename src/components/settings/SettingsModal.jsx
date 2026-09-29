import { useState, useEffect } from 'react';
import { X, Download, Upload, Database, Trash2, Info, Users, Volume2, VolumeX } from 'lucide-react';
import { exportToJson, importFromJson, validateAppData } from '../../utils/exportImport';
import { saveBackup, listBackups, loadBackup, hasProfileData } from '../../utils/storage';
import ConfirmModal from '../ui/ConfirmModal';
import ArchiveScreen from '../habits/ArchiveScreen';
import HelpModal from '../ui/HelpModal';
import {
  isSoundEnabled, setSoundEnabled, getSoundVolume, setSoundVolume, playSound,
  SOUND_LABELS, MAX_FILE_VOLUME, ensureCustomSounds, getCustomSoundsInfo, setCustomSound, setCustomSoundVolume, removeCustomSound,
} from '../../utils/sounds';

const formatSize = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
const formatDuration = (sec) => (sec == null ? '' : `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`);

const safeFileName = (s) => (s || 'профил').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'профил';

export default function SettingsModal({
  data,
  profiles = [],
  activeProfileId,
  activeProfileName = '',
  onClose,
  onImport,
  onClearAll,
  onExportAllProfiles,
  onUnarchive,
  onArchivedDelete,
}) {
  const [showSuccess,  setShowSuccess]  = useState(null);
  const [confirm,      setConfirm]      = useState(null);
  const [importing,    setImporting]    = useState(false);
  const [importError,  setImportError]  = useState(null);
  const [backups, setBackups] = useState([]);
  const [showHelp, setShowHelp] = useState(false);
  const [soundOn,  setSoundOn]  = useState(isSoundEnabled);
  const [volume,   setVolume]   = useState(() => Math.round(getSoundVolume() * 100));
  const [customInfo, setCustomInfo] = useState(getCustomSoundsInfo);
  const [soundError, setSoundError] = useState(null);
  const [busyEvent,  setBusyEvent]  = useState(null);

  const multiProfile = profiles.length > 1;

useEffect(() => {
  listBackups(activeProfileId).then(setBackups);
}, [activeProfileId]);

useEffect(() => {
  ensureCustomSounds().then(() => setCustomInfo(getCustomSoundsInfo()));
}, []);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundEnabled(next);
    setSoundOn(next);
    if (next) playSound('check');   // кратка проба при включване
  };

  const handleVolumeChange = (e) => {
    const v = Number(e.target.value);
    setVolume(v);
    setSoundVolume(v / 100);
  };
  const previewVolume = () => playSound('check');   // при пускане на плъзгача — чува се новата сила

  const handleFileVolumeChange = (event, e) => {
    setCustomSoundVolume(event, Number(e.target.value) / 100);
    setCustomInfo(getCustomSoundsInfo());
  };

  const handleSoundUpload = async (event, e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setBusyEvent(event);
    setSoundError(null);
    const res = await setCustomSound(event, file);
    setBusyEvent(null);
    if (!res.ok) {
      playSound('error');
      setSoundError(`${SOUND_LABELS[event]}: ${res.error}`);
      return;
    }
    setCustomInfo(getCustomSoundsInfo());
    playSound(event);   // веднага се чува какво е качено
  };

  const handleSoundRemove = async (event) => {
    setSoundError(null);
    await removeCustomSound(event);
    setCustomInfo(getCustomSoundsInfo());
  };

  const handleExport = (scope = 'profile') => {
    try {
      if (scope === 'all' && onExportAllProfiles) {
        Promise.resolve(onExportAllProfiles()).then(all => {
          const today = new Date().toISOString().split('T')[0];
          exportToJson(all, `Задачи_ВСИЧКИ_профили_${today}.json`);
        });
        return;
      }
      const today = new Date().toISOString().split('T')[0];
      exportToJson(data, `Задачи_${safeFileName(activeProfileName)}_${today}.json`);
    } catch (e) {
      console.error(e);
    }
  };

  // Преди заместване/изтриване на данните на АКТИВНИЯ профил: автоматично локално копие (само ако има
  // данни). При неуспех НЕ продължаваме мълчаливо — питаме потребителя.
  // Сваля файл и иска потвърждение, че е свален, ПРЕДИ да се продължи със заместването/изтриването.
  // „Откажи“ прекъсва действието (данните остават непокътнати).
  const downloadThenConfirm = (payload, fileName, proceed) => {
    let downloadFailed = false;
    try {
      exportToJson(payload, fileName);
    } catch (err) {
      console.error(err);
      downloadFailed = true;
    }
    if (downloadFailed) playSound('error');
    setConfirm({
      title:         downloadFailed ? '⚠️ Файлът не се свали' : '📥 Провери дали файлът е свален',
      message:       downloadFailed
        ? 'Автоматичното сваляне на копие не успя. Свали файл ръчно с „Свали backup“ в Настройки, преди да продължиш — след това данните ще бъдат заменени/изтрити.'
        : `Свален е файл „${fileName}“ (обикновено в папка „Изтегляния“). Провери, че наистина е там — ако не е, откажи и го свали ръчно с „Свали backup“.\n\nСлед потвърждение данните ще бъдат заменени/изтрити.`,
      confirmLabel:  downloadFailed ? 'Продължи без файл' : 'Файлът е свален — продължи',
      isDestructive: true,
      onConfirm:     () => { setConfirm(null); proceed(); },
      onClose:       () => setConfirm(null),
    });
  };

  const withSafetyCopy = async (proceed) => {
    const hasData = hasProfileData(data);
    const today   = new Date().toISOString().split('T')[0];
    const next    = () => (hasData
      ? downloadThenConfirm(data, `Задачи_${safeFileName(activeProfileName)}_преди_замяна_${today}.json`, proceed)
      : proceed());
    if (hasData) {
      const ok = await saveBackup(data, activeProfileId, { auto: true });
      if (!ok) {
        playSound('error');
        setConfirm({
          title:         '⚠️ Автоматичното копие не успя',
          message:       'Не можах да запиша резервно копие на текущите данни (може да няма място или хранилището е недостъпно).\n\nАко продължиш, текущите данни ще бъдат заменени/изтрити БЕЗ копие. Препоръчваме първо да свалиш файл с „Свали backup“.\n\nПродължаваш ли без копие?',
          confirmLabel:  'Продължи без копие',
          isDestructive: true,
          onConfirm:     () => { setConfirm(null); next(); },
          onClose:       () => setConfirm(null),
        });
        return;
      }
      setBackups(await listBackups(activeProfileId));
    }
    next();
  };

  // Преди заместване/изтриване на ВСИЧКИ профили: локалните копия също се трият, затова вместо
  // тях се сваля файл с всички профили (само ако някой профил има данни).
  const withAllProfilesFile = async (proceed) => {
    try {
      const all = await onExportAllProfiles();
      if (!all.profiles.some(p => hasProfileData(p.data))) { proceed(); return; }
      const today = new Date().toISOString().split('T')[0];
      downloadThenConfirm(all, `Задачи_ВСИЧКИ_профили_преди_замяна_${today}.json`, proceed);
      return;
    } catch (err) {
      console.error(err);
    }
    playSound('error');
    setConfirm({
      title:         '⚠️ Файлът с копие не се свали',
      message:       'Не успях да подготвя файл с всички профили. Локалните резервни копия също ще бъдат изтрити.\n\nПродължаваш ли без файл?',
      confirmLabel:  'Продължи без файл',
      isDestructive: true,
      onConfirm:     () => { setConfirm(null); proceed(); },
      onClose:       () => setConfirm(null),
    });
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    setImportError(null);
    try {
      const imported = await importFromJson(file);
      const validationError = validateAppData(imported);
      if (validationError) {
        playSound('error');
        setImportError(validationError);
        return;
      }
      const isAll = imported && imported.schema === 'tasks-multiprofile-v1';
      setConfirm({
        title:        '⚠️ Внимание!',
        message: isAll
          ? `Това ще замени ВСИЧКИ профили и данните им (${imported.profiles.length} профила)! Локалните резервни копия на всички профили също ще бъдат изтрити.\n\nПреди това автоматично ще се свали файл с текущите профили.\n\nПродължаваш ли?`
          : `Това ще замени данните на текущия профил${activeProfileName ? ` „${activeProfileName}“` : ''}!\n\nПреди това автоматично се пази локално копие и се сваля файл с текущите данни (ще те попитаме дали е свален).\n\nПродължаваш ли?`,
        confirmLabel: 'Импортирай',
        onConfirm: () => {
          setConfirm(null);
          (isAll ? withAllProfilesFile : withSafetyCopy)(() => {
            onImport(imported);
            setShowSuccess('import');
            setTimeout(() => { setShowSuccess(null); onClose(); }, 2000);
          });
        },
      });
    } catch (err) {
      console.error(err);
      playSound('error');
      setImportError('Файлът не е валиден JSON.');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const handleBackup = async () => {
  await saveBackup(data, activeProfileId);
  const updated = await listBackups(activeProfileId);
  setBackups(updated);
  setShowSuccess('backup');
  setTimeout(() => setShowSuccess(null), 3000);
};

  const handleRestore = (key) => {
  setConfirm({
    title:        '⚠️ Потвърждение',
    message:      `Данните на текущия профил${activeProfileName ? ` „${activeProfileName}“` : ''} ще бъдат заменени с backup-а.\n\nПреди това автоматично се пази локално копие и се сваля файл с текущите данни (ще те попитаме дали е свален).`,
    confirmLabel: 'Възстанови',
    onConfirm: async () => {
      setConfirm(null);
      // Първо зареждаме избраното копие — новото автоматично копие може да изтласка най-старото
      const backupData = await loadBackup(key);
      if (!backupData) {
        playSound('error');
        setImportError('Избраното резервно копие не може да бъде прочетено. Текущите данни не са променени.');
        return;
      }
      withSafetyCopy(() => {
        onImport(backupData);
        setShowSuccess('restore');
        setTimeout(() => { setShowSuccess(null); onClose(); }, 2000);
      });
    },
  });
};

  const runClear = (scope) => {
    const isAll = scope === 'all';
    setConfirm({
      title:        '🔴 КРИТИЧНО ПРЕДУПРЕЖДЕНИЕ!',
      message: isAll
        ? 'Това ще изтрие ВСИЧКИ профили и данните им! Локалните резервни копия на всички профили също ще бъдат изтрити.\n\nПреди това автоматично ще се свали файл с всички профили.'
        : `Това ще изтрие всички данни на профил${activeProfileName ? ` „${activeProfileName}“` : ''}!\n\nПреди това автоматично се пази локално копие и се сваля файл (ще те попитаме дали е свален; локалното можеш да го възстановиш от „Резервни копия“).`,
      confirmLabel: 'Изтрий',
      isDestructive: true,
      onConfirm: () => {
        setConfirm({
          title:        '🔴 ПОСЛЕДЕН ШАНС!',
          message:      isAll ? 'Наистина ли искаш да изтриеш всички профили?' : 'Наистина ли искаш да изтриеш този профил?',
          confirmLabel: 'Да, изтрий',
          isDestructive: true,
          onConfirm: () => {
            setConfirm(null);
            (isAll ? withAllProfilesFile : withSafetyCopy)(() => {
              onClearAll(scope);
              setShowSuccess('clear');
              setTimeout(() => { setShowSuccess(null); onClose(); }, 2000);
            });
          },
          onClose: () => setConfirm(null),
        });
      },
      onClose: () => setConfirm(null),
    });
  };

  return (
    <>
      <div className="fixed inset-0 bg-gradient-to-br from-cyan-400 via-teal-300 to-emerald-300 bg-opacity-90 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">

            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Database className="w-7 h-7 text-purple-500" />
                Настройки
              </h2>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            {activeProfileName && (
              <div className="mb-4 p-2 bg-indigo-50 border border-indigo-200 rounded-xl text-sm text-indigo-700 flex items-center gap-2">
                <Users className="w-4 h-4 flex-shrink-0" />
                Активен профил: <b>{activeProfileName}</b>
                <span className="text-indigo-400">
                  — експортът, backup-ите и „Изтрий данни на профила“ важат за него
                </span>
              </div>
            )}

            {showSuccess && (
              <div className="mb-4 p-3 bg-green-100 border-2 border-green-400 rounded-xl text-green-800 font-semibold text-center">
                {showSuccess === 'import'  && '✅ Данните са импортирани успешно!'}
                {showSuccess === 'backup'  && '✅ Резервно копие е създадено!'}
                {showSuccess === 'restore' && '✅ Данните са възстановени!'}
                {showSuccess === 'clear'   && '✅ Данните са изтрити!'}
              </div>
            )}

            {importError && (
              <div className="mb-4 p-3 bg-red-100 border-2 border-red-400 rounded-xl text-red-800 font-semibold text-center">
                ⚠️ {importError}
              </div>
            )}

            <div className="space-y-4">

              {/* Звук */}
              <div className="bg-gradient-to-r from-amber-50 to-yellow-100 rounded-xl p-4 border-2 border-amber-200">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-gray-800 mb-1 flex items-center gap-2">
                      {soundOn ? <Volume2 className="w-5 h-5 text-amber-600" /> : <VolumeX className="w-5 h-5 text-gray-500" />}
                      Звукови ефекти
                    </h3>
                    <p className="text-sm text-gray-600">Кратки звуци при отмятане, завършване и изтриване. Важи за цялото приложение.</p>
                  </div>
                  <button
                    role="switch"
                    aria-checked={soundOn}
                    aria-label="Звукови ефекти"
                    onClick={toggleSound}
                    className={`relative shrink-0 w-14 h-8 rounded-full transition-colors ${soundOn ? 'bg-green-500' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${soundOn ? 'translate-x-6' : ''}`} />
                  </button>
                </div>

                {soundOn && (
                  <div className="mt-4 flex items-center gap-2">
                    <span className="text-xs text-gray-600 shrink-0">Обща сила</span>
                    <VolumeX className="w-4 h-4 text-gray-500 shrink-0" />
                    <input
                      type="range" min="0" max="100" step="5"
                      value={volume}
                      onChange={handleVolumeChange}
                      onPointerUp={previewVolume}
                      onKeyUp={previewVolume}
                      aria-label="Сила на звука"
                      className="flex-1 accent-amber-500"
                    />
                    <Volume2 className="w-4 h-4 text-gray-500 shrink-0" />
                    <span className="w-10 text-right text-xs font-semibold text-gray-700">{volume}%</span>
                  </div>
                )}

                {soundOn && (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs text-gray-500">
                      За всяко събитие можеш да качиш свой аудио файл (MP3, WAV, M4A…). Файлът остава само на това
                      устройство и не влиза в backup-ите. Дълъг файл ще бъде прекъснат от следващия звук.
                    </p>
                    {soundError && (
                      <div className="p-2 bg-red-100 border border-red-300 rounded-lg text-xs text-red-800 font-semibold">⚠️ {soundError}</div>
                    )}
                    {Object.keys(SOUND_LABELS).map(ev => {
                      const info = customInfo[ev];
                      return (
                        <div key={ev} className="bg-white bg-opacity-80 rounded-lg p-2">
                          <div className="text-sm font-semibold text-gray-800">{SOUND_LABELS[ev]}</div>
                          <div className="text-xs text-gray-500 break-all">
                            {info
                              ? `📁 ${info.name} · ${formatSize(info.size)}${info.duration != null ? ` · ${formatDuration(info.duration)}` : ''}`
                              : 'Стандартен звук'}
                          </div>
                          {info && (
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-xs text-gray-600 shrink-0">Сила на файла</span>
                              <input
                                type="range" min="0" max={MAX_FILE_VOLUME * 100} step="5"
                                value={Math.round(info.volume * 100)}
                                onChange={(e) => handleFileVolumeChange(ev, e)}
                                onPointerUp={() => playSound(ev)}
                                onKeyUp={() => playSound(ev)}
                                aria-label={`Сила на файла — ${SOUND_LABELS[ev]}`}
                                className="flex-1 min-w-0 accent-blue-500"
                              />
                              <span className="w-10 text-right text-xs font-semibold text-gray-700">{Math.round(info.volume * 100)}%</span>
                            </div>
                          )}
                          <div className="flex flex-wrap gap-2 mt-2">
                            <button onClick={() => playSound(ev)} className="px-3 py-1 bg-amber-500 text-white text-xs rounded-lg hover:bg-amber-600">
                              ▶ Изпробвай
                            </button>
                            <label className={`px-3 py-1 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600 cursor-pointer ${busyEvent === ev ? 'opacity-50 pointer-events-none' : ''}`}>
                              {busyEvent === ev ? 'Проверява се…' : '📁 Качи файл'}
                              <input type="file" accept="audio/*" className="hidden" disabled={busyEvent !== null}
                                onChange={(e) => handleSoundUpload(ev, e)} />
                            </label>
                            {info && (
                              <button onClick={() => handleSoundRemove(ev)} className="px-3 py-1 bg-gray-200 text-gray-700 text-xs rounded-lg hover:bg-gray-300">
                                ✕ Върни стандартния
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Експорт */}
              <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-xl p-4 border-2 border-green-200">
                <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                  <Download className="w-5 h-5 text-green-600" />
                  Експортирай данни
                </h3>
                <p className="text-sm text-gray-600 mb-3">Запази задачите и правилата в JSON файл.</p>
                <button onClick={() => handleExport('profile')} className="w-full py-3 bg-gradient-to-r from-green-400 to-green-500 text-white rounded-xl font-semibold hover:shadow-lg transition-shadow">
                  📥 {multiProfile ? 'Свали този профил (JSON)' : 'Свали backup (JSON)'}
                </button>
                {multiProfile && (
                  <button onClick={() => handleExport('all')} className="w-full mt-2 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold hover:shadow-lg transition-shadow">
                    📦 Свали ВСИЧКИ профили (JSON)
                  </button>
                )}
              </div>

              {/* Импорт */}
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-4 border-2 border-blue-200">
                <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-blue-600" />
                  Импортирай данни
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  Възстанови данни от JSON файл. Файл с един профил заменя текущия профил;
                  файл с всички профили заменя целия набор.
                </p>
                <label className="w-full py-3 bg-gradient-to-r from-blue-400 to-blue-500 text-white rounded-xl font-semibold hover:shadow-lg transition-shadow cursor-pointer flex items-center justify-center">
                  📤 Зареди backup (JSON)
                  <input type="file" accept=".json,application/json"
                  onChange={handleImport} className="hidden" disabled={importing} />
                </label>
              </div>

              {/* Backup */}
              <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl p-4 border-2 border-purple-200">
                <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                  <Database className="w-5 h-5 text-purple-600" />
                  Резервни копия
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  Създай локално резервно копие на текущия профил (пазят се последните 5). Преди „Зареди backup“, „Възстанови“ и „Изтрий данни“ се прави и автоматично копие (последните 3, с етикет „авто“).
                </p>
                <button onClick={handleBackup} className="w-full py-3 bg-gradient-to-r from-purple-400 to-purple-500 text-white rounded-xl font-semibold hover:shadow-lg transition-shadow">
                  💾 Създай backup
                </button>

                {backups.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-semibold text-gray-700">Налични backup-и:</p>
                    {backups.map(b => (
                      <div key={b.key} className="bg-white rounded-lg p-2 flex justify-between items-center">
                        <span className="text-xs text-gray-600">
                          {b.dateStr}
                          {b.auto && <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[10px] font-semibold">авто</span>}
                        </span>
                        <button onClick={() => handleRestore(b.key)} className="px-3 py-1 bg-purple-500 text-white text-xs rounded-lg hover:bg-purple-600">
                          Възстанови
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Изтриване */}
              <div className="bg-gradient-to-r from-red-50 to-red-100 rounded-xl p-4 border-2 border-red-200">
                <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                  <Trash2 className="w-5 h-5 text-red-600" />
                  Изтрий данни
                </h3>
                <p className="text-sm text-gray-600 mb-3">⚠️ Изтрива задачи и правила (двойно потвърждение). Преди това се пази автоматично копие.</p>
                <button onClick={() => runClear('profile')} className="w-full py-3 bg-gradient-to-r from-red-400 to-red-500 text-white rounded-xl font-semibold hover:shadow-lg transition-shadow">
                  🗑️ {multiProfile ? 'Изтрий данните на този профил' : 'Изтрий ВСИЧКО'}
                </button>
                {multiProfile && (
                  <button onClick={() => runClear('all')} className="w-full mt-2 py-3 bg-gradient-to-r from-red-500 to-rose-700 text-white rounded-xl font-semibold hover:shadow-lg transition-shadow">
                    🗑️ Изтрий ВСИЧКИ профили
                  </button>
                )}
              </div>
              {/* Архив */}
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-4 border-2 border-gray-200">
                <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                  📦 Архив
                </h3>
                <ArchiveScreen
                  archivedHabits={data.archivedHabits}
                  onUnarchive={(at) => { onUnarchive(at); }}
                  onDelete={onArchivedDelete}
                />
              </div>

              {/* Ръководство */}
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4 border-2 border-indigo-200">
                <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                  📖 Ръководство
                </h3>
                <p className="text-sm text-gray-600 mb-3">Пълно описание на всички функции на приложението.</p>
                <button onClick={() => setShowHelp(true)} className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-semibold hover:shadow-lg transition-shadow">
                  📖 Отвори ръководството
                </button>
              </div>

              {/* За приложението */}
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-4 border-2 border-gray-200">
                <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                  <Info className="w-5 h-5 text-gray-600" />
                  За приложението
                </h3>
                <p className="text-sm text-gray-600">
                  Habit Tracker PWA v2.0<br />
                  React + Vite + Tailwind CSS
                </p>
              </div>

            </div>
          </div>
        </div>
      </div>

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          isDestructive={confirm.isDestructive}
          onConfirm={confirm.onConfirm}
          onClose={confirm.onClose ?? (() => setConfirm(null))}
        />
      )}
    </>
  );
}
