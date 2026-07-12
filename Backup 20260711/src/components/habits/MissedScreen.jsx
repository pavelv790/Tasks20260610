import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { toMidnight, formatDate } from '../../utils/dateUtils';
import { isTaskCompleted } from '../../utils/habitUtils';

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

export default function MissedScreen({ habits, tasks, onNavigateToCalendar }) {
  const [period, setPeriod] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [view, setView] = useState('missed');

  const missedTasks = useMemo(() => {
    const today = toMidnight(new Date());

    return tasks
      .filter(t => {
        if (t.status !== 'missed' && t.status !== 'partial') return false;
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

  return (
    <div className="space-y-4">

      <div className="bg-white rounded-2xl shadow-lg p-4">
        <div className="flex gap-2 mb-3">
          <button onClick={() => setView('missed')}
            className={`flex-1 py-2 px-3 rounded-xl text-sm font-semibold transition-all ${
              view === 'missed'
                ? 'bg-gradient-to-r from-red-400 to-orange-400 text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Пропуснати
          </button>
          <button onClick={() => setView('unlinked')}
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
        ) : (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-500">Общо: {filteredMissedTasks.length}</span>
            </div>
            <div className="divide-y divide-gray-100">
              {filteredMissedTasks.map(task => {
                const habit = habitMap[task.habitId];
                if (!habit) return null;
                return (
                  <button
                    key={task.id}
                    onClick={() => onNavigateToCalendar(task.date, task.habitId)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div>
                      <div className="text-sm font-semibold text-gray-800">{habit.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{formatDisplayDate(task.date)}</div>
                    </div>
                    <span className={`text-xs px-3 py-1 rounded-full font-semibold ${
                      task.status === 'missed'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-orange-100 text-orange-700'
                    }`}>
                      {task.status === 'missed' ? 'пропусната' : 'частична'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )
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
        ) : (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-500">Общо: {filteredUnlinkedTasks.length}</span>
            </div>
            <div className="divide-y divide-gray-100">
              {filteredUnlinkedTasks.map(task => {
                const habit = habitMap[task.habitId];
                if (!habit) return null;
                return (
                  <button
                    key={task.id}
                    onClick={() => onNavigateToCalendar(task.date, task.habitId)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div>
                      <div className="text-sm font-semibold text-gray-800">{habit.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{formatDisplayDate(task.date)}</div>
                    </div>
                    <span className="text-xs px-3 py-1 rounded-full font-semibold bg-teal-100 text-teal-700">
                      отработена
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )
      )}
    </div>
  );
}