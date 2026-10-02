import { useMemo, useState } from 'react';
import { Search, CheckSquare, Square, MinusSquare } from 'lucide-react';
import { toMidnight, formatDate } from '../../utils/dateUtils';
import { isTaskCompleted, isEntirelyInactive, isTaskWaiting } from '../../utils/habitUtils';
import { bulkMarkCompleted, bulkMakeInactive, bulkReset, pickCompletable, pickActivatable } from '../../utils/bulkTaskActions';
import ConfirmModal from '../ui/ConfirmModal';
import Toast from '../ui/Toast';

const PERIODS = [
  { id: 'all',   label: 'Всички' },
  { id: 'week',  label: 'Тази седмица' },
  { id: 'month', label: 'Този месец' },
];

const MONTH_NAMES = ['януари','февруари','март','април','май','юни','юли','август','септември','октомври','ноември','декември'];
const WEEKDAY_NAMES = ['неделя','понеделник','вторник','сряда','четвъртък','петък','събота'];

function formatDisplayDate(dateStr) {
  const d = new Date(dateStr);
  return `${WEEKDAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

export default function MissedScreen({ habits, tasks, rules = [], onTasksUpdate, onNavigateToCalendar }) {
  const [period, setPeriod] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [view, setView] = useState('missed');
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [pendingAction, setPendingAction] = useState(null); // { type, ids, count }
  const [toast, setToast] = useState(null);

  const missedTasks = useMemo(() => {
    const today = toMidnight(new Date());

    return tasks
      .filter(t => {
        if (t.status !== 'missed' && t.status !== 'partial') return false;
        if (t.habitInactive || isEntirelyInactive(t)) return false;
        if (isTaskCompleted(t)) return false;
        if (isTaskWaiting(t)) return false; // краен срок — още чака, не е пропусната
        if (t.makeupFromDate) return false;
        if (t.makeupForDate) {
          const makeupTask = tasks.find(m => m.date === t.makeupForDate && m.habitId === t.habitId);
          if (makeupTask && isTaskCompleted(makeupTask)) return false;
        }
        if (t.date === formatDate(today) && t.status !== 'missed') return false;

        const d = toMidnight(new Date(t.date));

        if (period === 'week') {
          const start = new Date(today);
          const day = today.getDay();
          start.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
          const end = new Date(start);
          end.setDate(start.getDate() + 6);
          if (d < toMidnight(start) || d > toMidnight(end)) return false;
        } else if (period === 'month') {
          const start = new Date(today.getFullYear(), today.getMonth(), 1);
          const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
          if (d < toMidnight(start) || d > toMidnight(end)) return false;
        }

        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [tasks, period]);

  const unlinkedTasks = useMemo(() => {
    const today = toMidnight(new Date());

    return tasks
      .filter(t => {
        if (t.createdBy !== 'manual') return false;
        if (t.makeupFromDate || t.makeupForDate) return false;
        if (t.manuallyReset) return false; // нулиран (с бележка) — вече не е отработен

        const d = toMidnight(new Date(t.date));

        if (period === 'week') {
          const start = new Date(today);
          const day = today.getDay();
          start.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
          const end = new Date(start);
          end.setDate(start.getDate() + 6);
          if (d < toMidnight(start) || d > toMidnight(end)) return false;
        } else if (period === 'month') {
          const start = new Date(today.getFullYear(), today.getMonth(), 1);
          const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
          if (d < toMidnight(start) || d > toMidnight(end)) return false;
        }

        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [tasks, period]);

  const habitMap = useMemo(() => {
    const m = {};
    habits.forEach(h => { m[h.id] = h; });
    return m;
  }, [habits]);

  const filteredMissedTasks = searchQuery.trim()
    ? missedTasks.filter(t => habitMap[t.habitId]?.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : missedTasks;

  const filteredUnlinkedTasks = searchQuery.trim()
    ? unlinkedTasks.filter(t => habitMap[t.habitId]?.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : unlinkedTasks;

  // ── Групов избор ────────────────────────────────────────
  // Всичко се отнася само до ПОКАЗАНИТЕ (след период + търсене) задачи.
  const visibleRows = (view === 'missed' ? filteredMissedTasks : filteredUnlinkedTasks)
    .filter(t => habitMap[t.habitId]);
  const selectedVisible = visibleRows.filter(t => selectedIds.has(t.id));
  const allSelected  = visibleRows.length > 0 && selectedVisible.length === visibleRows.length;
  const someSelected = selectedVisible.length > 0;

  const changeView = (v) => { setView(v); setSelectedIds(new Set()); };

  const toggleOne = (id) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const toggleAll = () => setSelectedIds(allSelected ? new Set() : new Set(visibleRows.map(t => t.id)));

  const plural = (n) => `${n} ${n === 1 ? 'задача' : 'задачи'}`;

  const ACTIONS = {
    complete: {
      label: 'Изпълнено', btn: 'from-green-400 to-green-500',
      title: 'Отбележи като изпълнени',
      message: (n) => `Да отбележа ли като изпълнени ${plural(n)}?`,
      done: (n) => `Отбелязани като изпълнени: ${plural(n)}`,
      pick: pickCompletable, run: (ids) => bulkMarkCompleted(tasks, ids),
    },
    reset: {
      label: 'Нулирай', btn: 'from-gray-400 to-gray-500',
      title: 'Нулирай задачите',
      message: (n) => `Да нулирам ли ${plural(n)}? Прогресът се изчиства, връзките за наваксване се развалят, а ръчно отработени дни без бележка се изтриват.`,
      done: (n) => `Нулирани: ${plural(n)}`,
      pick: (all, ids) => all.filter(t => ids.has(t.id)), run: (ids) => bulkReset(tasks, ids, rules),
      destructive: true,
    },
    inactive: {
      label: 'Неактивна', btn: 'from-slate-400 to-slate-500',
      title: 'Направи задачите неактивни',
      message: (n) => `Да направя ли неактивни ${plural(n)}? Само тези дни; самата задача (навикът) не се променя.`,
      done: (n) => `Направени неактивни: ${plural(n)}`,
      pick: pickActivatable, run: (ids) => bulkMakeInactive(tasks, ids),
    },
  };

  const requestAction = (type) => {
    const ids = new Set(selectedVisible.map(t => t.id));
    const count = ACTIONS[type].pick(tasks, ids).length;
    if (count === 0) {
      setToast({ type: 'info', message: 'Няма какво да се промени за избраните задачи' });
      return;
    }
    setPendingAction({ type, ids, count });
  };

  const applyAction = () => {
    const { type, ids, count } = pendingAction;
    onTasksUpdate(ACTIONS[type].run(ids), true);
    setPendingAction(null);
    setSelectedIds(new Set());
    setToast({ type: 'success', message: ACTIONS[type].done(count) });
  };

  const renderList = (list, badge) => (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
      <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100">
        <button onClick={toggleAll} className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-indigo-600">
          {allSelected ? <CheckSquare className="w-5 h-5 text-indigo-600" />
            : someSelected ? <MinusSquare className="w-5 h-5 text-indigo-600" />
            : <Square className="w-5 h-5 text-gray-400" />}
          {allSelected ? 'Махни избора' : 'Избери всички'}
        </button>
        <span className="text-sm font-semibold text-gray-500">
          {someSelected ? `Избрани: ${selectedVisible.length} от ${list.length}` : `Общо: ${list.length}`}
        </span>
      </div>
      {someSelected && (
        <div className="flex gap-2 px-4 py-3 bg-indigo-50 border-b border-gray-100">
          {Object.entries(ACTIONS).map(([type, a]) => (
            <button key={type} onClick={() => requestAction(type)}
              className={`flex-1 py-2 px-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r ${a.btn} hover:shadow-md`}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
      <div className="divide-y divide-gray-100">
        {list.map(task => {
          const habit = habitMap[task.habitId];
          if (!habit) return null;
          const checked = selectedIds.has(task.id);
          return (
            <div key={task.id} className={`flex items-center ${checked ? 'bg-indigo-50' : ''}`}>
              <button onClick={() => toggleOne(task.id)} className="pl-4 pr-1 py-3 shrink-0" aria-label="Избери задачата">
                {checked ? <CheckSquare className="w-5 h-5 text-indigo-600" /> : <Square className="w-5 h-5 text-gray-400" />}
              </button>
              <button
                onClick={() => onNavigateToCalendar(task.date, task.habitId)}
                className="flex-1 flex items-center justify-between px-3 py-3 hover:bg-gray-50 transition-colors text-left"
              >
                <div>
                  <div className="text-sm font-semibold text-gray-800">{habit.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{formatDisplayDate(task.date)}</div>
                </div>
                {badge(task)}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );

  const missedBadge = (task) => (
    <span className={`text-xs px-3 py-1 rounded-full font-semibold ${
      task.status === 'missed' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
    }`}>
      {task.status === 'missed' ? 'пропусната' : 'частична'}
    </span>
  );

  const unlinkedBadge = (task) => (
    task.habitInactive
      ? <span className="text-xs px-3 py-1 rounded-full font-semibold bg-gray-200 text-gray-600">неактивна</span>
      : <span className="text-xs px-3 py-1 rounded-full font-semibold bg-teal-100 text-teal-700">отработена</span>
  );

  return (
    <div className="space-y-4">

      <div className="bg-white rounded-2xl shadow-lg p-4">
        <div className="flex gap-2 mb-3">
          <button onClick={() => changeView('missed')}
            className={`flex-1 py-2 px-3 rounded-xl text-sm font-semibold transition-all ${
              view === 'missed'
                ? 'bg-gradient-to-r from-red-400 to-orange-400 text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Пропуснати
          </button>
          <button onClick={() => changeView('unlinked')}
            className={`flex-1 py-2 px-3 rounded-xl text-sm font-semibold transition-all ${
              view === 'unlinked'
                ? 'bg-gradient-to-r from-teal-400 to-teal-500 text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Отработени (без връзка)
          </button>
        </div>
        <div className="flex gap-2">
          {PERIODS.map(p => (
            <button key={p.id} onClick={() => setPeriod(p.id)}
              className={`flex-1 py-2 px-3 rounded-xl text-sm font-semibold transition-all ${
                period === p.id
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {(view === 'missed' ? missedTasks.length > 0 : unlinkedTasks.length > 0) && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Търси задача..."
            className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-400 focus:outline-none bg-white"
          />
        </div>
      )}

      {view === 'missed' ? (
        missedTasks.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="text-5xl mb-3">🎉</div>
            <p className="text-lg font-semibold text-gray-700">Няма пропуснати задачи</p>
            <p className="text-gray-500 mt-1 text-sm">за избрания период</p>
          </div>
        ) : filteredMissedTasks.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <p className="text-gray-500">Няма намерени задачи</p>
          </div>
        ) : renderList(filteredMissedTasks, missedBadge)
      ) : (
        unlinkedTasks.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="text-5xl mb-3">✅</div>
            <p className="text-lg font-semibold text-gray-700">Няма отработени без връзка</p>
            <p className="text-gray-500 mt-1 text-sm">за избрания период</p>
          </div>
        ) : filteredUnlinkedTasks.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <p className="text-gray-500">Няма намерени задачи</p>
          </div>
        ) : renderList(filteredUnlinkedTasks, unlinkedBadge)
      )}

      {pendingAction && (
        <ConfirmModal
          title={ACTIONS[pendingAction.type].title}
          message={ACTIONS[pendingAction.type].message(pendingAction.count)}
          confirmLabel="Да, приложи"
          isDestructive={!!ACTIONS[pendingAction.type].destructive}
          onConfirm={applyAction}
          onClose={() => setPendingAction(null)}
        />
      )}

      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </div>
  );
}
