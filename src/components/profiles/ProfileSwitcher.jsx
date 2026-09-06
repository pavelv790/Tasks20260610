import { useState } from 'react';
import { X, Plus, Pencil, Trash2, Check, Users } from 'lucide-react';
import ConfirmModal from '../ui/ConfirmModal';

// Модал за управление на профили: превключване, създаване,
// преименуване, изтриване. Винаги остава поне един профил.
export default function ProfileSwitcher({
  profiles,
  activeId,
  onSwitch,
  onCreate,
  onRename,
  onDelete,
  onClose,
}) {
  const [editingId, setEditingId]   = useState(null);
  const [editName,  setEditName]    = useState('');
  const [adding,    setAdding]      = useState(false);
  const [newName,   setNewName]     = useState('');
  const [confirm,   setConfirm]     = useState(null);

  const startEdit = (p) => { setEditingId(p.id); setEditName(p.name); };
  const commitEdit = () => {
    if (editingId) onRename(editingId, editName);
    setEditingId(null);
    setEditName('');
  };

  const commitAdd = () => {
    const name = newName.trim();
    if (!name) return;
    onCreate(name);
    setNewName('');
    setAdding(false);
  };

  const askDelete = (p) => {
    setConfirm({
      title: '🗑️ Изтриване на профил',
      message: `Профил „${p.name}“ и всичките му задачи, история и резервни копия ще бъдат изтрити завинаги.\n\nПродължаваш ли?`,
      confirmLabel: 'Изтрий профила',
      isDestructive: true,
      onConfirm: () => { onDelete(p.id); setConfirm(null); },
    });
  };

  return (
    <>
      <div className="fixed inset-0 bg-gradient-to-br from-cyan-400 via-teal-300 to-emerald-300 bg-opacity-90 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">

            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Users className="w-7 h-7 text-indigo-500" />
                Профили
              </h2>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <p className="text-sm text-gray-500 mb-4">
              Всеки профил има собствени задачи, календар, статистика и резервни копия.
            </p>

            <div className="space-y-2">
              {profiles.map(p => {
                const isActive  = p.id === activeId;
                const isEditing = p.id === editingId;
                return (
                  <div
                    key={p.id}
                    className={`rounded-2xl border-2 p-3 flex items-center gap-3 ${
                      isActive ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-white'
                    }`}
                  >
                    <span
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: p.color || '#6366f1' }}
                    />

                    {isEditing ? (
                      <input
                        autoFocus
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') commitEdit();
                          if (e.key === 'Escape') { setEditingId(null); setEditName(''); }
                        }}
                        className="flex-1 min-w-0 px-2 py-1 border-2 border-indigo-300 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                      />
                    ) : (
                      <button
                        onClick={() => { if (!isActive) onSwitch(p.id); else onClose(); }}
                        className="flex-1 min-w-0 text-left"
                      >
                        <span className="font-semibold text-gray-800 block truncate">{p.name}</span>
                        {isActive && <span className="text-xs text-indigo-500 font-medium">активен</span>}
                      </button>
                    )}

                    {isEditing ? (
                      <button
                        onClick={commitEdit}
                        className="p-1.5 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 flex-shrink-0"
                        title="Запази"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => startEdit(p)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-gray-100 flex-shrink-0"
                          title="Преименувай"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => askDelete(p)}
                          disabled={profiles.length <= 1}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-gray-100 flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-gray-400 disabled:hover:bg-transparent"
                          title={profiles.length <= 1 ? 'Трябва да остане поне един профил' : 'Изтрий'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4">
              {adding ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitAdd();
                      if (e.key === 'Escape') { setAdding(false); setNewName(''); }
                    }}
                    placeholder="Име на новия профил"
                    className="flex-1 min-w-0 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400"
                  />
                  <button
                    onClick={commitAdd}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm font-semibold hover:shadow-lg"
                  >
                    Добави
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setAdding(true)}
                  className="w-full py-3 rounded-xl border-2 border-dashed border-indigo-300 text-indigo-600 font-semibold hover:bg-indigo-50 flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Нов профил
                </button>
              )}
            </div>

            <button
              onClick={onClose}
              className="w-full mt-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200"
            >
              Затвори
            </button>
          </div>
        </div>
      </div>

      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          isDestructive={confirm.isDestructive}
          onConfirm={confirm.onConfirm}
          onClose={() => setConfirm(null)}
        />
      )}
    </>
  );
}
