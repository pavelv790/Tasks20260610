// Временни placeholder компоненти
// Ще бъдат заменени в следващите етапи

export const Placeholder = ({ name }) => (
  <div className="bg-white rounded-3xl shadow-xl p-8 text-center">
    <div className="text-6xl mb-4">🔧</div>
    <p className="text-xl font-semibold text-gray-700">{name}</p>
    <p className="text-gray-500 mt-2">Идва скоро...</p>
  </div>
);
