import { AlertTriangle } from 'lucide-react';

// Универсален модал за потвърждение
// isDestructive=true → червен бутон за потвърждение
export default function ConfirmModal({ title, message, confirmLabel, onConfirm, onClose, isDestructive = false }) {
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-cyan-400 via-teal-300 to-emerald-300 bg-opacity-90 flex items-center justify-center p-4 z-[60]">
      <div className={`bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 ${isDestructive ? 'border-4 border-red-400' : 'border-2 border-gray-200'}`}>
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className={`w-8 h-8 flex-shrink-0 ${isDestructive ? 'text-red-500' : 'text-yellow-500'}`} />
          <div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">{title}</h3>
            <p className="text-gray-600 whitespace-pre-line">{message}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-gray-200 text-gray-800 rounded-xl font-semibold hover:bg-gray-300"
          >
            Откажи
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-3 rounded-xl font-semibold text-white ${
              isDestructive
                ? 'bg-gradient-to-r from-red-500 to-red-600 hover:shadow-lg'
                : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:shadow-lg'
            }`}
          >
            {confirmLabel ?? 'Продължи'}
          </button>
        </div>
      </div>
    </div>
  );
}
