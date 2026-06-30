import { useState, useMemo } from 'react';
import DateInput from '../ui/DateInput';
import SearchableSelect from '../ui/SearchableSelect';
import { doesDateMatchRule } from '../../utils/ruleEngine';
import { isTaskCompleted } from '../../utils/habitUtils';
import { toMidnight, formatDate } from '../../utils/dateUtils';
import { getNextRuleDate } from '../../utils/ruleEngine';

const PERIODS = [
  { id: 'week',   label: 'Тази седмица' },
  { id: 'month',  label: 'Този месец'   },
  { id: '30days', label: 'Последните 30 дни' },
  { id: 'year',   label: 'Тази година'  },
  { id: 'all',    label: 'Всички'       },
  { id: 'custom', label: 'Избери период' },
];

export default function StatisticsScreen({ habits, tasks, rules }) {
  const defaultHabit = habits.find(h => h.isDefault) || habits[0];
  const [selectedId,    setSelectedId]    = useState(defaultHabit?.id || null);
  const [period,        setPeriod]        = useState('month');
  const [customFrom,    setCustomFrom]    = useState('');
  const [customTo,      setCustomTo]      = useState('');

  const hasManualOrder = habits.some(h => h.manualOrder != null);
  const sortedHabits = [...habits].sort((a, b) => {
    if (hasManualOrder) {
      const oa = a.manualOrder ?? 999, ob = b.manualOrder ?? 999;
      if (oa !== ob) return oa - ob;
    }
    return a.name.localeCompare(b.name, 'bg');
  });

  const getDateRange = () => {
    const today = toMidnight(new Date());
    switch (period) {
      case 'week': {
        const start = new Date(today);
        const day   = today.getDay();
        start.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        return { from: start, to: end };
      }
      case 'month':
        return { from: new Date(today.getFullYear(), today.getMonth(), 1), to: new Date(today.getFullYear(), today.getMonth() + 1, 0) };
      case '30days': {
        const start = new Date(today);
        start.setDate(today.getDate() - 29);
        return { from: start, to: today };
      }
      case 'year':
        return { from: new Date(today.getFullYear(), 0, 1), to: new Date(today.getFullYear(), 11, 31) };
      case 'custom':
        return {
          from: customFrom ? toMidnight(new Date(customFrom)) : null,
          to:   customTo   ? toMidnight(new Date(customTo))   : null,
        };
      default:
        return { from: null, to: null };
    }
  };

  const stats = useMemo(() => {
    if (!selectedId) return null;
    const { from, to } = getDateRange();
    const today = toMidnight(new Date());

    const activeRule = rules.find(r => r.habitId === selectedId && r.isActive);
    const habitTasks = tasks.filter(t => t.habitId === selectedId);
    const taskMap = new Map(habitTasks.map(t => [t.date, t]));

    // Дни от правилото в периода
    const ruleDaysInPeriod = [];
    if (activeRule) {
      const startD = toMidnight(new Date(Math.max(
        (from ?? toMidnight(new Date(activeRule.startDate))).getTime(),
        toMidnight(new Date(activeRule.startDate)).getTime()
      )));
      const endD = to ?? today;
      let cur = new Date(startD);
      while (cur <= endD) {
        if (doesDateMatchRule(cur, activeRule)) {
          ruleDaysInPeriod.push(formatDate(cur));
        }
        cur.setDate(cur.getDate() + 1);
      }
    }

    const ruleDaysSet = new Set(ruleDaysInPeriod);

    // Задачи в периода
    const tasksInPeriod = habitTasks.filter(t => {
      const d = toMidnight(new Date(t.date));
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });

    // Completed: всички задачи в периода (от правилото, makeup, без връзка) които са completed
    const completed = tasksInPeriod.filter(t => isTaskCompleted(t)).length;

    // Missed: дни от правилото в периода, missed или partial,
    // чийто makeup ден НЕ е completed
    const missed = ruleDaysInPeriod.filter(dateStr => {
      const task = taskMap.get(dateStr);
      if (!task) return false;
      if (task.status !== 'missed' && task.status !== 'partial') return false;
      if (task.makeupForDate) {
        const makeupTask = taskMap.get(task.makeupForDate);
        if (makeupTask && isTaskCompleted(makeupTask)) return false;
      }
      return true;
    }).length;

    const todayStr = formatDate(today);
    const ruleTotal = ruleDaysInPeriod.filter(dateStr => {
      if (dateStr <= todayStr) return true;
      const task = taskMap.get(dateStr);
      return task && task.status === 'missed';
    }).length;
    const total = ruleDaysInPeriod.length;
    const rate = ruleTotal > 0 ? Math.round((completed / ruleTotal) * 100) : 0;

    const partial = tasksInPeriod.filter(t => t.status === 'partial').length;

    // Поредица: от днес назад до началото на периода
    // Днес от правилото, pending и не missed и не наваксван → не прекъсва
    // Всеки друг минал ден от правилото без completed → прекъсва
    // Ден извън правилото, completed → брои се, не прекъсва
    let streak = 0;
    if (activeRule) {
      const periodStart = from ?? toMidnight(new Date(activeRule.startDate));

      const completedDatesSet = new Set(
        tasksInPeriod.filter(t => isTaskCompleted(t)).map(t => t.date)
      );

      let cur = new Date(today);
      let counting = true;

      while (counting && cur >= periodStart) {
        const curStr = formatDate(cur);
        const inRule = doesDateMatchRule(cur, activeRule);

        if (inRule) {
          const task = taskMap.get(curStr);
          const isToday = curStr === todayStr;
          if (completedDatesSet.has(curStr)) {
            streak++;
          } else if (isToday && task?.status !== 'missed' && !task?.makeupForDate) {
            // днес, от правилото, не е missed и не се наваксва другаде — не прекъсва
          } else {
            counting = false;
          }
        } else {
          if (completedDatesSet.has(curStr)) {
            streak++;
          }
        }

        cur.setDate(cur.getDate() - 1);
      }
    }

    return { completed, missed, partial, total, rate, streak };
  }, [selectedId, period, customFrom, customTo, tasks, rules]);

  if (habits.length === 0) {
    return (
      <div className="bg-white rounded-3xl shadow-xl p-8 text-center">
        <div className="text-6xl mb-4">📊</div>
        <p className="text-xl font-semibold text-gray-700">Няма задачи</p>
        <p className="text-gray-500 mt-2">Добави задача от раздел „Задачи"</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Избор на задача */}
      <div className="bg-gradient-to-br from-blue-100 to-cyan-100 rounded-2xl shadow-lg p-4">
        <label className="block text-sm font-semibold text-gray-700 mb-2">Избери задача за статистика</label>
        <SearchableSelect
          options={sortedHabits}
          value={selectedId}
          onChange={setSelectedId}
        />
      </div>

      {/* Избор на период */}
      <div className="bg-gradient-to-br from-blue-100 to-cyan-100 rounded-2xl shadow-lg p-4">
        <label className="block text-sm font-semibold text-gray-700 mb-3">Избери период</label>
        <div className="grid grid-cols-2 gap-2">
          {PERIODS.map(p => (
            <button key={p.id} onClick={() => setPeriod(p.id)}
              className={`py-3 px-4 rounded-xl font-semibold transition-all ${
                period === p.id
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {period === 'custom' && (
          <div className="mt-4 space-y-3">
            <DateInput value={customFrom} onChange={setCustomFrom} label="От дата:" />
            <DateInput value={customTo}   onChange={setCustomTo}   label="До дата:" />
          </div>
        )}
      </div>

      {/* Резултати */}
      {stats && stats.total > 0 ? (
        <div className="space-y-4">

          <div className="bg-gradient-to-br from-green-400 to-green-500 rounded-2xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-4xl">✓</span>
              <span className="text-5xl font-bold">{stats.completed}</span>
            </div>
            <p className="text-sm opacity-90">Изпълнени задачи</p>
            <p className="text-xs opacity-75 mt-1">{Math.round((stats.completed / stats.total) * 100)}% от всички</p>
          </div>

          <div className="bg-gradient-to-br from-red-400 to-red-500 rounded-2xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-4xl">✗</span>
              <span className="text-5xl font-bold">{stats.missed}</span>
            </div>
            <p className="text-sm opacity-90">Пропуснати задачи</p>
            <p className="text-xs opacity-75 mt-1">{Math.round((stats.missed / stats.total) * 100)}% от всички</p>
          </div>

          <div className={`rounded-2xl shadow-lg p-6 text-white ${
            stats.rate >= 80 ? 'bg-gradient-to-br from-green-400 to-green-500' :
            stats.rate >= 50 ? 'bg-gradient-to-br from-orange-400 to-orange-500' :
                               'bg-gradient-to-br from-red-400 to-red-500'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-4xl">📊</span>
              <span className="text-5xl font-bold">{stats.rate}%</span>
            </div>
            <p className="text-sm opacity-90">Процент успеваемост</p>
            {stats.partial > 0 && (
              <p className="text-xs opacity-75 mt-1">Частично: {stats.partial} задачи</p>
            )}
          </div>

          <div className="bg-gradient-to-br from-indigo-400 to-purple-500 rounded-2xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-4xl">🔥</span>
              <span className="text-5xl font-bold">{stats.streak}</span>
            </div>
            <p className="text-sm opacity-90">Текуща поредица</p>
          </div>

        </div>
      ) : (
        <div className="bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl shadow-lg p-6 text-center">
          <div className="text-6xl mb-4">🔭</div>
          <p className="text-xl font-semibold text-gray-700">Няма данни</p>
          <p className="text-gray-500 mt-2">Няма задачи за избрания период</p>
        </div>
      )}
    </div>
  );
}