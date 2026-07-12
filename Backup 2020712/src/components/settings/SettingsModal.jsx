import { useState, useEffect } from 'react';
import { X, Download, Upload, Database, Trash2, Info, AlertTriangle } from 'lucide-react';
import { exportToJson, importFromJson, validateAppData } from '../../utils/exportImport';
import { saveBackup, listBackups, loadBackup } from '../../utils/storage';
import ConfirmModal from '../ui/ConfirmModal';
import ArchiveScreen from '../habits/ArchiveScreen';
import HelpModal from '../ui/HelpModal';

export default function SettingsModal({ data, onClose, onImport, onClearAll, onUnarchive, onArchivedDelete }) {
  const [showSuccess,  setShowSuccess]  = useState(null);
  const [confirm,      setConfirm]      = useState(null);
  const [importing,    setImporting]    = useState(false);
  const [importError,  setImportError]  = useState(null);
  const [backups, setBackups] = useState([]);
  const [showHelp, setShowHelp] = useState(false);

useEffect(() => {
  listBackups().then(setBackups);
}, []);

  const handleExport = () => {
    try {
      exportToJson(data);
    } catch (e) {
      console.error(e);
    }
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
        setImportError(validationError);
        return;
      }
      setConfirm({
        title:        '⚠️ Внимание!',
        message:      'Това ще замени ВСИЧКИ съществуващи данни!\n\nПродължаваш ли?',
        confirmLabel: 'Импортирай',
        onConfirm: () => {
          onImport(imported);
          setShowSuccess('import');
          setTimeout(() => { setShowSuccess(null); onClose(); }, 2000);
          setConfirm(null);
        },
      });
    } catch (err) {
      console.error(err);
      setImportError('Файлът не е валиден JSON.');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const handleBackup = async () => {
  await saveBackup(data);
  const updated = await listBackups();
  setBackups(updated);
  setShowSuccess('backup');
  setTimeout(() => setShowSuccess(null), 3000);
};

  const handleRestore = (key) => {
  setConfirm({
    title:        '⚠️ Потвърждение',
    message:      'Настоящите данни ще бъдат заменени с backup-а.',
    confirmLabel: 'Възстанови',
    onConfirm: async () => {
      const backupData = await loadBackup(key);
      if (backupData) {
        onImport(backupData);
        setShowSuccess('restore');
        setTimeout(() => { setShowSuccess(null); onClose(); }, 2000);
      }
      setConfirm(null);
    },
  });
};

  const handleClearAll = () => {
    setConfirm({
      title:        '🔴 КРИТИЧНО ПРЕДУПРЕЖДЕНИЕ!',
      message:      'Това ще изтрие ВСИЧКИ данни завинаги!\n\nПрепоръчваме да експортираш преди това.',
      confirmLabel: 'Изтрий всичко',
      isDestructive: true,
      onConfirm: () => {
        setConfirm({
          title:        '🔴 ПОСЛЕДЕН ШАНС!',
          message:      'Наистина ли искаш да изтриеш всичко?',
          confirmLabel: 'Да, изтрий',
          isDestructive: true,
          onConfirm: () => {
            onClearAll();
            setShowSuccess('clear');
            setTimeout(() => { setShowSuccess(null); onClose(); }, 2000);
            setConfirm(null);
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

            {showSuccess && (
              <div className="mb-4 p-3 bg-green-100 border-2 border-green-400 rounded-xl text-green-800 font-semibold text-center">
                {showSuccess === 'import'  && '✅ Данните са импортирани успешно!'}
                {showSuccess === 'backup'  && '✅ Резервно копие е създадено!'}
                {showSuccess === 'restore' && '✅ Данните са възстановени!'}
                {showSuccess === 'clear'   && '✅ Всички данни са изтрити!'}
              </div>
            )}

            {importError && (
              <div className="mb-4 p-3 bg-red-100 border-2 border-red-400 rounded-xl text-red-800 font-semibold text-center">
                ⚠️ {importError}
              </div>
            )}

            <div className="space-y-4">

              {/* Експорт */}
              <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-xl p-4 border-2 border-green-200">
                <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                  <Download className="w-5 h-5 text-green-600" />
                  Експортирай данни
                </h3>
                <p className="text-sm text-gray-600 mb-3">Запази всички задачи и правила в JSON файл.</p>
                <button onClick={handleExport} className="w-full py-3 bg-gradient-to-r from-green-400 to-green-500 text-white rounded-xl font-semibold hover:shadow-lg transition-shadow">
                  📥 Свали backup (JSON)
                </button>
              </div>

              {/* Импорт */}
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-4 border-2 border-blue-200">
                <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-blue-600" />
                  Импортирай данни
                </h3>
                <p className="text-sm text-gray-600 mb-3">Възстанови данни от JSON файл.</p>
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
                <p className="text-sm text-gray-600 mb-3">Създай локално резервно копие (пазят се последните 5).</p>
                <button onClick={handleBackup} className="w-full py-3 bg-gradient-to-r from-purple-400 to-purple-500 text-white rounded-xl font-semibold hover:shadow-lg transition-shadow">
                  💾 Създай backup
                </button>

                {backups.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-semibold text-gray-700">Налични backup-и:</p>
                    {backups.map(b => (
                      <div key={b.key} className="bg-white rounded-lg p-2 flex justify-between items-center">
                        <span className="text-xs text-gray-600">{b.dateStr}</span>
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
                  Изтрий всички данни
                </h3>
                <p className="text-sm text-gray-600 mb-3">⚠️ Това ще изтрие всички задачи и правила завинаги!</p>
                <button onClick={handleClearAll} className="w-full py-3 bg-gradient-to-r from-red-400 to-red-500 text-white rounded-xl font-semibold hover:shadow-lg transition-shadow">
                  🗑️ Изтрий ВСИЧКО
                </button>
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