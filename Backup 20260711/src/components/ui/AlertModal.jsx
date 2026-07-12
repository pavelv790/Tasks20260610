export default function AlertModal({ title, message, onClose }) {
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-cyan-400 via-teal-300 to-emerald-300 bg-opacity-90 flex items-center justify-center p-4 z-[60]">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border-2 border-blue-200">
        <h3 className="text-xl font-bold text-gray-800 mb-2">{title}</h3>
        <p className="text-gray-600 whitespace-pre-line mb-4">{message}</p>
        <button onClick={onClose} className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold">
          Разбрах
        </button>
      </div>
    </div>
  );
}