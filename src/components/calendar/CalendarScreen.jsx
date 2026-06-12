// CalendarScreen.jsx
import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate, MONTH_NAMES_BG_CAP, WEEKDAY_NAMES_BG, toMidnight } from '../../utils/dateUtils';
import { generateTasksForMonth, checkMissedTasks } from '../../utils/taskGenerator';
import { getCalendarDayStateWithRing as getCalendarDayState } from '../../utils/calendarStates';
import { doesDateMatchRule } from '../../utils/ruleEngine';
import DayModal from './DayModal';

export default function CalendarScreen({ habits, tasks, rules, onTasksUpdate, initialTarget, onTargetConsumed }) {
  const [selectedHabitId, setSelectedHabitId] = useState(
    initialTarget?.habitId || habits.find(h => h.isDefault)?.id || habits[0]?.id || null
  );
  const [currentDate,     setCurrentDate]     = useState(
    initialTarget ? new Date(initialTarget.date + 'T00:00:00') : new Date()
  );
  const [selectedDay,     setSelectedDay]      = useState(null);
  const [showDayModal,    setShowDayModal]     = useState(false);
  const [showMonthPicker, setShowMonthPicker]  = useState(false);
  const [pickerYear,      setPickerYear]       = useState(new Date().getFullYear());
  useEffect(() => {
    if (initialTarget) onTargetConsumed?.();
  }, []);

  const activeHabit = habits.find(h => h.id === selectedHabitId);
  const activeRule  = rules.find(r => r.habitId === selectedHabitId && r.isActive);

  // Генерираме задачи при смяна на месец
  useEffect(() => {
    if (!selectedHabitId || !activeHabit || !activeRule) return;

    const year  = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const monthStart = new Date(year, month, 1);
    const monthEnd   = new Date(year, month + 1, 0);
    const hasTasksInMonth = tasks.some(t => {
      if (t.habitId !== selectedHabitId) return false;
      const d = new Date(t.date);
      return d >= monthStart && d <= monthEnd;
    });

    if (hasTasksInMonth) return;

    const newTasks = generateTasksForMonth(activeHabit, [activeRule], tasks, year, month, true);
    if (newTasks.length > 0) {
      const withMissed = checkMissedTasks([...tasks, ...newTasks]);
      onTasksUpdate(withMissed, true);
    }
  }, [currentDate, selectedHabitId]);

  // Навигация
  const goToPrevMonth = () => setCurrentDate(d => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n; });
  const goToNextMonth = () => setCurrentDate(d => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n; });
  const goToToday     = () => setCurrentDate(new Date());

  // Генерираме дните на месеца
  const calendarDays = (() => {
    const year     = currentDate.getFullYear();
    const month    = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const total    = new Date(year, month + 1, 0).getDate();
    const start    = firstDay === 0 ? 6 : firstDay - 1;
    const days     = [];

    for (let i = 0; i < start; i++) days.push(null);
    for (let i = 1; i <= total; i++) days.push(new Date(year, month, i));
    return days;
  })();

  // Обновяване на задачи
  const handleTasksUpdate = (updatedTasks, keepOpen) => {
    onTasksUpdate(updatedTasks);
    if (!keepOpen) setShowDayModal(false);
  };

  const monthYear = `${MONTH_NAMES_BG_CAP[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  const todayStr  = formatDate(new Date());

  if (habits.length === 0) {
    return (
      <div className="bg-white rounded-3xl shadow-xl p-8 text-center">
        <div className="text-6xl mb-4">📁</div>
        <p className="text-xl font-semibold text-gray-700">Няма задачи</p>
        <p className="text-gray-500 mt-2">Добави задача от раздел „Задачи"</p>
      </div>
    );
  }

  const hasManualOrder = habits.some(h => h.manualOrder != null);
  const sortedHabits = [...habits].sort((a, b) => {
    if (hasManualOrder) {
      const oa = a.manualOrder ?? 999, ob = b.manualOrder ?? 999;
      if (oa !== ob) return oa - ob;
    }
    return a.name.localeCompare(b.name, 'bg');
  });

  return (
    <div className="space-y-4">

      {/* Избор на задача */}
      <div className="bg-gradient-to-br from-blue-100 to-cyan-100 rounded-2xl shadow-lg p-4">
        <label className="block text-sm font-semibold text-gray-700 mb-2">Избери задача</label>
        <select
          value={selectedHabitId || ''}
          onChange={e => setSelectedHabitId(e.target.value)}
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-400 focus:outline-none font-semibold"
        >
          {sortedHabits.map(h => (
            <option key={h.id} value={h.id}>{h.name}</option>
          ))}
        </select>
      </div>

      {/* Навигация */}
      <div className="bg-gradient-to-br from-blue-100 to-cyan-100 rounded-2xl shadow-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={goToPrevMonth} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronLeft className="w-6 h-6 text-gray-700" />
          </button>
          <button
            onClick={() => setShowMonthPicker(true)}
            className="px-4 py-2 bg-white rounded-lg shadow-md hover:shadow-lg transition-all font-bold text-gray-800"
          >
            📅 {monthYear}
          </button>
          <button onClick={goToNextMonth} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronRight className="w-6 h-6 text-gray-700" />
          </button>
        </div>
        <button onClick={goToToday} className="w-full py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg font-semibold hover:shadow-lg transition-shadow">
          Днес
        </button>
      </div>

      {/* Календарна мрежа */}
      <div className="bg-gradient-to-br from-blue-100 to-cyan-100 rounded-2xl shadow-lg p-4">
        {/* Заглавия */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {WEEKDAY_NAMES_BG.map((d, i) => (
            <div key={i} className="text-center font-bold text-sm text-gray-600 py-2">{d}</div>
          ))}
        </div>

        {/* Дни */}
        <div className="grid grid-cols-7 gap-2">
          {calendarDays.map((date, idx) => {
            if (!date) return <div key={idx} className="aspect-square" />;

            const dateStr  = formatDate(date);
            const task     = tasks.find(t => t.habitId === selectedHabitId && t.date === dateStr);
            const dayState = getCalendarDayState(date, task, activeRule);
            const isToday  = dateStr === todayStr;

            const isLight = dayState.bgColor === 'bg-gray-50' || dayState.bgColor.includes('from-white') || dayState.bgColor === 'bg-white';
            const textColor = isLight ? 'text-gray-800' : 'text-white';

            const ringStyle = isToday
              ? {}
              : dayState.ring
              ? { borderColor: '#16a34a', borderWidth: '2px', borderStyle: 'solid' }
              : dayState.unlinkedRing
              ? { borderColor: '#a855f7', borderWidth: '4px', borderStyle: 'solid' }
              : {};

            

            return (
              <div
                key={idx}
                onClick={() => { setSelectedDay({ date, task: task || null }); setShowDayModal(true); }}
                className={`aspect-square flex flex-col rounded-lg transition-all cursor-pointer relative font-semibold hover:scale-105 ${
  !dayState.bgColor.includes('gradient') && !dayState.bgColor.includes('cyan') && !dayState.bgColor.includes('teal')
    ? dayState.bgColor : ''
} ${textColor} ${isToday ? 'ring-2 ring-indigo-500' : ''}`}
style={{
  ...ringStyle,
  ...(dayState.bgColor.includes('gradient') ? { background: 'linear-gradient(to bottom right, white, #86efac)' } : {}),
  ...(dayState.bgColor === 'bg-white' ? { background: 'white' } : {}),
  ...(dayState.unlinkedRing && dayState.bgColor === 'bg-green-400' ? { background: '#4ade80' } : {}),
  ...(dayState.unlinkedRing && dayState.bgColor === 'bg-green-300' ? { background: '#86efac' } : {}),
  ...(dayState.unlinkedRing && dayState.bgColor.includes('gradient') ? { background: 'linear-gradient(to bottom right, white, #86efac)' } : {}),
}}
              >
                
                {/* Номер */}
                <div className="absolute top-1 left-1 z-20">
                  <span className="text-sm font-bold">{date.getDate()}</span>
                </div>

                {/* Бележка точка */}
                {task?.note && (
                  <div className="absolute top-1 right-1 z-20 text-[10px] leading-none">📝</div>
                )}

                {/* Completion text */}
                {dayState.completionText && (
                  <div className="flex-1 flex items-center justify-center z-10">
                    <span className="text-xs font-bold">{dayState.completionText}</span>
                  </div>
                )}

                {/* Label */}
                {dayState.label && (
                  <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5 z-20">
                    <span className={`text-[9px] font-bold block text-center leading-tight ${isLight ? 'text-gray-800' : 'text-white'}`}>
                      {dayState.label}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Легенда */}
        <div className="mt-4 pt-4 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-500">
            Избрана задача: <span className="font-bold" style={{ color: activeHabit?.color }}>
              {activeHabit?.name}
            </span>
          </p>
        </div>
      </div>

      {/* Month Picker */}
      {showMonthPicker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-blue-100 to-purple-100 rounded-3xl shadow-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <button onClick={() => setPickerYear(y => Math.max(1970, y - 1))} className="p-2 hover:bg-white rounded-lg transition-all">
                <ChevronLeft className="w-6 h-6 text-gray-700" />
              </button>
              <h3 className="text-2xl font-bold text-gray-800">{pickerYear}</h3>
              <button onClick={() => setPickerYear(y => Math.min(2100, y + 1))} className="p-2 hover:bg-white rounded-lg transition-all">
                <ChevronRight className="w-6 h-6 text-gray-700" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {MONTH_NAMES_BG_CAP.map((m, i) => {
                const isCurrent = i === currentDate.getMonth() && pickerYear === currentDate.getFullYear();
                return (
                  <button key={i}
                    onClick={() => { setCurrentDate(new Date(pickerYear, i, 1)); setShowMonthPicker(false); }}
                    className={`py-3 rounded-xl font-semibold text-gray-800 transition-all bg-white border-2 border-gray-200 hover:bg-indigo-50 hover:border-indigo-400 ${isCurrent ? 'ring-2 ring-indigo-500 bg-indigo-100' : ''}`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
            <button onClick={() => setShowMonthPicker(false)} className="w-full py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300">
              Затвори
            </button>
          </div>
        </div>
      )}

      {/* Day Modal */}
      {showDayModal && selectedDay && (
        <DayModal
          date={selectedDay.date}
          task={tasks.find(t => t.habitId === selectedHabitId && t.date === formatDate(selectedDay.date)) || null}
          habit={activeHabit}
          allTasks={tasks}
          rules={rules}
          onTasksUpdate={handleTasksUpdate}
          onClose={() => setShowDayModal(false)}
          onCloseWithNote={(note, task) => {
            if (note !== (task?.note || '') && task) {
              const updatedTask = { ...task, note };
              const updated = tasks.map(t => t.id === updatedTask.id ? updatedTask : t);
              onTasksUpdate(updated, true);
            }
            setShowDayModal(false);
          }}
        />
      )}
    </div>
  );
}