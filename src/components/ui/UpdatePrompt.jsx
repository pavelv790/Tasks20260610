import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

// На всеки час проверяваме за нова версия, докато приложението стои отворено
const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000;

// Изскачащ прозорец за потвърждение при налична нова версия.
// Работи заедно с registerType: 'prompt' в vite.config.js.
export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      setInterval(() => {
        registration.update().catch(() => {});
      }, UPDATE_CHECK_INTERVAL);
    },
  });

  // Escape = „По-късно"
  useEffect(() => {
    if (!needRefresh) return;
    const onKey = (e) => { if (e.key === 'Escape') setNeedRefresh(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [needRefresh, setNeedRefresh]);

  if (!needRefresh) return null;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-cyan-400 via-teal-300 to-emerald-300 bg-opacity-90 flex items-center justify-center p-4 z-[70]">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border-2 border-indigo-200">
        <div className="flex items-start gap-3 mb-4">
          <RefreshCw className="w-8 h-8 flex-shrink-0 text-indigo-500" />
          <div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Налична е нова версия</h3>
            <p className="text-gray-600">
              Има обновление на приложението. Да го заредя ли сега?
              Задачите и историята ти остават непокътнати.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setNeedRefresh(false)}
            className="flex-1 py-3 bg-gray-200 text-gray-800 rounded-xl font-semibold hover:bg-gray-300"
          >
            По-късно
          </button>
          <button
            onClick={() => updateServiceWorker(true)}
            className="flex-1 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-500 hover:shadow-lg"
          >
            Обнови сега
          </button>
        </div>
      </div>
    </div>
  );
}
