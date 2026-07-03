export default function NotificationPermissionModal({ onAllow, onDecline }) {
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-cyan-400 via-teal-300 to-emerald-300 bg-opacity-90 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">🔔 Активирай напомнянията</h2>
        <p className="text-gray-600 mb-6">Искаш ли да получаваш напомняния за задачите си в зададените часове?</p>
        <div className="flex gap-3">
          <button onClick={onDecline} className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300">
            Не благодаря
          </button>
          <button onClick={onAllow} className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-semibold">
            Активирай
          </button>
        </div>
      </div>
    </div>
  );
}
