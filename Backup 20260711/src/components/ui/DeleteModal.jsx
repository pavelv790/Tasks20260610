export default function DeleteModal({ title, message, onConfirm, onClose }) {
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-cyan-400 via-teal-300 to-emerald-300 bg-opacity-90 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-2">
          {title ?? 'Сигурни ли сте?'}
        </h3>
        <p className="text-gray-600 mb-6">
          {message ?? 'Това действие не може да бъде отменено.'}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
          >
            Откажи
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-6 py-3 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 transition-colors"
          >
            Изтрий
          </button>
        </div>
      </div>
    </div>
  );
}
