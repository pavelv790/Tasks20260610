import { useMemo, useState } from 'react';
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

  const habitMap = useMemo(() => {
    const m = {};
    habits.forEach(h => { m[h.id] = h; });
    return m;
  }, [habits]);

  return (
    <div className="space-y-4">

      <div className="bg-white rounded-2xl shadow-lg p-4">
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

      {missedTasks.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="text-5xl mb-3">🎉</div>
          <p className="text-lg font-semibold text-gray-700">Няма пропуснати задачи</p>
          <p className="text-gray-500 mt-1 text-sm">за избрания период</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-500">Общо: {missedTasks.length}</span>
          </div>
          <div className="divide-y divide-gray-100">
            {missedTasks.map(task => {
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
      )}
    </div>
  );
}