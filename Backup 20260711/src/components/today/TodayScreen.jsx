import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Search } from 'lucide-react';
import { formatDate, formatDisplayDateWithToday, MONTH_NAMES_BG_CAP, WEEKDAY_NAMES_BG, toMidnight } from '../../utils/dateUtils';
import { generateTasksForMonth, checkMissedTasks } from '../../utils/taskGenerator';
import { getEffectiveStatus, getProgressText, isTaskCompleted } from '../../utils/habitUtils';
import { getCalendarDayState } from '../../utils/calendarStates';
import TaskActions from './TaskActions';

export default function TodayScreen({ habits, tasks, rules, onTasksUpdate, onTaskNoteUpdate, onHabitsReorder, dayOrders, onDayOrdersChange }) {
  const [selectedDate,   setSelectedDate]   = useState(new Date());
  const [showDayModal,   setShowDayModal]   = useState(false);
  const [selectedEntry,  setSelectedEntry]  = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerDate,     setPickerDate]     = useState(new Date());
  const [draggedId,      setDraggedId]      = useState(null);
  const [expandedInfo,   setExpandedInfo]   = useState(null);
  const [expandedNote,   setExpandedNote]   = useState(null);
  const [noteValues,     setNoteValues]     = useState({});
  const [modalNote,      setModalNote]      = useState('');
  const [searchQuery,    setSearchQuery]    = useState('');
  const followingTodayRef = useRef(true);

  useEffect(() => {
    if (expandedNote === null) return;
    const handler = (e) => {
          if (!e.target.closest('[data-note-container]')) {
            const task = tasks.find(t => t.id === expandedNote);
            if (task) {
              const val = noteValues[task.id] ?? task.note ?? '';
              if (val !== (task.note || '')) {
                onTasksUpdate([{ ...task, note: val }]);
              }
            }
        setExpandedNote(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [expandedNote, noteValues, tasks]);

  useEffect(() => {
    const checkDate = () => {
      if (!followingTodayRef.current) return;
      const now = new Date();
      setSelectedDate(prev => (formatDate(prev) === formatDate(now) ? prev : now));
    };
    const interval = setInterval(checkDate, 60000);
    document.addEventListener('visibilitychange', checkDate);
    window.addEventListener('focus', checkDate);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', checkDate);
      window.removeEventListener('focus', checkDate);
    };
  }, []);
  
  useEffect(() => {
    if (habits.length === 0) return;
    const year  = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    let newTasks = [];

    habits.forEach(habit => {
      const habitRules = rules.filter(r => r.habitId === habit.id && r.isActive);
      const generated  = generateTasksForMonth(habit, habitRules, [...tasks, ...newTasks], year, month, false);
      newTasks = [...newTasks, ...generated];
    });

    if (newTasks.length > 0) {
      const combined   = [...tasks, ...newTasks];
      const withMissed = checkMissedTasks(combined);
      onTasksUpdate(withMissed, true);
    }
  }, [selectedDate, habits.length, rules.length]);

  const goToPrev  = () => { followingTodayRef.current = false; setSelectedDate(d => { const n = new Date(d); n.setDate(n.getDate() - 1); return n; }); };
  const goToNext  = () => { followingTodayRef.current = false; setSelectedDate(d => { const n = new Date(d); n.setDate(n.getDate() + 1); return n; }); };
  const goToToday = () => { followingTodayRef.current = true; setSelectedDate(new Date()); };

  const dateStr      = formatDate(selectedDate);
  const tasksForDate = tasks.filter(t => t.date === dateStr);

  const hasManualOrder = habits.some(h => h.manualOrder != null);
  const sortedHabits = [...habits].sort((a, b) => {
    if (hasManualOrder) {
      const oa = a.manualOrder ?? 999, ob = b.manualOrder ?? 999;
      if (oa !== ob) return oa - ob;
    }
    return a.name.localeCompare(b.name, 'bg');
  });

  const dayOrder = dayOrders[dateStr];
  const sortedForDay = dayOrder
    ? [...sortedHabits].sort((a, b) => {
        const ia = dayOrder.indexOf(a.id);
        const ib = dayOrder.indexOf(b.id);
        const oa = ia === -1 ? 999 : ia;
        const ob = ib === -1 ? 999 : ib;
        return oa - ob;
      })
    : sortedHabits;

  const today          = toMidnight(new Date());
  const selDay         = toMidnight(selectedDate);
  const isTodaySelected = selDay.getTime() === today.getTime();

  const entries = sortedForDay
    .map(habit => {
      const task = tasksForDate.find(t => t.habitId === habit.id);
      if (!task) return null;
      const status = getEffectiveStatus(task);
      if (status === 'completed' && !task.makeupFromDate) return null;
      if (isTaskCompleted(task) && task.makeupFromDate) return null;
      if (task.makeupForDate) {
        const makeupTask = tasks.find(t => t.date === task.makeupForDate && t.habitId === habit.id);
        if (makeupTask && isTaskCompleted(makeupTask)) return null;
      }
      return { habit, task, status };
    })
    .filter(Boolean);

  const isSearching = searchQuery.trim().length > 0;
  const filteredEntries = isSearching
    ? entries.filter(({ habit }) => habit.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : entries;

  const handleTaskUpdate = (updatedTask) => {
    const withNote = modalNote !== (updatedTask.note || '')
      ? { ...updatedTask, note: modalNote }
      : updatedTask;
    onTasksUpdate([withNote]);
    setTimeout(() => setShowDayModal(false), 300);
  };

  const closeModal = () => {
    const taskId = selectedEntry?.task?.id;
    const currentTask = tasks.find(t => t.id === taskId);
    if (taskId && currentTask && modalNote !== (currentTask.note || '')) {
      onTasksUpdate([{ ...currentTask, note: modalNote }]);
    }
    setShowDayModal(false);
  };
  
    const moveEntry = (habitId, direction) => {
    const idx = sortedForDay.findIndex(h => h.id === habitId);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= sortedForDay.length) return;
    const reordered = [...sortedForDay];
    const [moved] = reordered.splice(idx, 1);
    reordered.splice(newIdx, 0, moved);
    onDayOrdersChange(prev => ({ ...prev, [dateStr]: reordered.map(h => h.id) }));
  };

  const handleDragStart = (e, habitId) => {
    setDraggedId(habitId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e, targetHabitId) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetHabitId) { setDraggedId(null); return; }
    const dragIdx   = sortedForDay.findIndex(h => h.id === draggedId);
    const targetIdx = sortedForDay.findIndex(h => h.id === targetHabitId);
    const reordered = [...sortedForDay];
    const [moved]   = reordered.splice(dragIdx, 1);
    reordered.splice(targetIdx, 0, moved);
    onDayOrdersChange(prev => ({ ...prev, [dateStr]: reordered.map(h => h.id) }));
    setDraggedId(null);
  };

  const pickerDays = (() => {
    const year     = pickerDate.getFullYear();
    const month    = pickerDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const total    = new Date(year, month + 1, 0).getDate();
    const start    = firstDay === 0 ? 6 : firstDay - 1;
    const days     = [];
    const prevTotal = new Date(year, month, 0).getDate();

    for (let i = start - 1; i >= 0; i--) {
      days.push({ date: prevTotal - i, current: false, full: new Date(year, month - 1, prevTotal - i) });
    }
    for (let i = 1; i <= total; i++) {
      days.push({ date: i, current: true, full: new Date(year, month, i) });
    }
    let next = 1;
    while (days.length < 42) {
      days.push({ date: next, current: false, full: new Date(year, month + 1, next) });
      next++;
    }
    return days;
  })();

  return (
    <div className="space-y-4">

      <div className="bg-gradient-to-br from-blue-100 to-cyan-100 rounded-2xl shadow-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <button onClick={goToPrev} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronLeft className="w-6 h-6 text-gray-700" />
          </button>

          <button
            onClick={() => setShowDatePicker(p => !p)}
            className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Calendar className="w-5 h-5 text-indigo-500" />
            <h2 className="text-lg font-bold text-gray-800">
              {formatDisplayDateWithToday(selectedDate)}
            </h2>
          </button>

          <button onClick={goToNext} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronRight className="w-6 h-6 text-gray-700" />
          </button>
        </div>

        <button
          onClick={goToToday}
          className={`w-full py-2 text-white rounded-lg font-semibold hover:shadow-lg transition-shadow ${
            isTodaySelected
              ? 'bg-gradient-to-r from-indigo-500 to-purple-500'
              : 'bg-gradient-to-r from-orange-500 to-amber-500'
          }`}
        >
          {isTodaySelected ? 'Днес' : '⬅ Отиди на Днес'}
        </button>

        <p className="text-xs text-gray-600 text-center mt-2">
          💡 Дръпни с drag-and-drop за пренареждане
        </p>

        {showDatePicker && (
          <div className="mt-4 p-3 bg-gray-50 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => setPickerDate(d => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n; })} className="p-2 hover:bg-gray-200 rounded-lg">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="font-bold text-gray-800">
                {MONTH_NAMES_BG_CAP[pickerDate.getMonth()]} {pickerDate.getFullYear()}
              </span>
              <button onClick={() => setPickerDate(d => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n; })} className="p-2 hover:bg-gray-200 rounded-lg">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-2">
              {WEEKDAY_NAMES_BG.map((d, i) => (
                <div key={i} className="text-center font-bold text-xs text-gray-600 py-1">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {pickerDays.map((day, i) => {
                if (!day.current) return (
                  <div key={i} className="aspect-square flex items-center justify-center text-gray-300 text-sm">
                    {day.date}
                  </div>
                );
                const isSel = formatDate(day.full) === dateStr;
                const isTod = formatDate(day.full) === formatDate(new Date());
                return (
                  <button key={i}
                    onClick={() => { followingTodayRef.current = isTod; setSelectedDate(day.full); setShowDatePicker(false); }}
                    className={`aspect-square flex items-center justify-center rounded-lg text-sm font-semibold transition-all
                      ${isSel ? 'bg-indigo-500 text-white ring-2 ring-indigo-300' : ''}
                      ${isTod && !isSel ? 'ring-2 ring-indigo-400' : ''}
                      ${!isSel && !isTod ? 'hover:bg-gray-200' : ''}`}
                  >
                    {day.date}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

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

      <div className="space-y-2">
        {entries.length === 0 ? (
          <div className="bg-gradient-to-br from-blue-100 to-cyan-100 rounded-2xl shadow-lg p-8 text-center">
            {tasksForDate.length === 0 ? (
              <><div className="text-6xl mb-4">🔭</div><p className="text-xl font-semibold text-gray-600">Няма задачи за този ден</p></>
            ) : tasksForDate.some(t => getEffectiveStatus(t) === 'missed') ? (
              <><div className="text-6xl mb-4">🔭</div><p className="text-xl font-semibold text-gray-600">Няма активни задачи</p></>
            ) : (
              <><div className="text-6xl mb-4">🎉</div><p className="text-xl font-semibold text-green-600">Браво! Всичко е завършено!</p><p className="text-gray-500 mt-2">Днес си го направил страхотно! 💪</p></>
            )}
          </div>
        ) : filteredEntries.length === 0 ? (
          <p className="text-center text-gray-500 py-6">Няма намерени задачи</p>
        ) : (
          filteredEntries.map(({ habit, task, status }) => {
            const progressText = getProgressText(task);
            const activeRule = rules.find(r => r.habitId === habit.id && r.isActive);
            const dayState = getCalendarDayState(selectedDate, task, activeRule);

            const isLight = dayState.bgColor === 'bg-gray-50' || dayState.bgColor.includes('from-white');
            const textColor = isLight ? 'text-gray-800' : 'text-white';

            let bgColor;
            if (dayState.bgColor.includes('gradient')) {
              bgColor = '';
            } else {
              bgColor = dayState.bgColor;
            }

            let statusIcon = '⏱', statusText = 'Предстоящо', statusColor = isLight ? 'text-gray-600' : 'text-white';
            if (status === 'partial') { statusIcon = '⏳'; statusText = 'В процес'; }
            else if (status === 'makeup') { statusIcon = '↻'; statusText = 'Наваксване'; }
            else if (status === 'missed') { statusIcon = '✗'; statusText = 'Пропуснато'; }

            return (
              <div key={task.id} draggable={!isSearching}
                onDragStart={e => !isSearching && handleDragStart(e, habit.id)}
                onDragOver={e => !isSearching && e.preventDefault()}
                onDrop={e => !isSearching && handleDrop(e, habit.id)}
                className={`w-full ${bgColor} rounded-xl shadow-md p-4 transition-all hover:shadow-lg ${draggedId === habit.id ? 'opacity-50 scale-95' : ''}`}
                style={{
                  ...(dayState.bgColor.includes('gradient') ? { background: 'linear-gradient(to bottom right, white, #86efac)' } : {}),
                  ...(dayState.ring ? { borderColor: '#a855f7', borderWidth: '2px', borderStyle: 'solid' } : {}),
                }}
              >
                <div className="flex items-start gap-2">
                  <span className="text-gray-400 cursor-grab active:cursor-grabbing text-lg leading-none pt-1">⋮⋮</span>
                  <div className="flex-1 text-left cursor-pointer" onClick={() => { setSelectedEntry({ habit, task }); setModalNote(task.note || ''); setShowDayModal(true); }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className={`font-bold ${textColor}`}>{habit.name}</h3>
                        <p className={`text-sm ${statusColor} font-semibold`}>{statusIcon} {statusText}</p>
                        {expandedInfo === task.id && habit.description && (
                          <p className="text-xs mt-1 text-gray-600 bg-white bg-opacity-70 rounded-lg px-2 py-1">{habit.description}</p>
                        )}
                        {expandedNote === task.id && (
                          <div data-note-container>
                            <textarea
                              value={noteValues[task.id] ?? task.note ?? ''}
                              onChange={e => { e.stopPropagation(); setNoteValues(prev => ({ ...prev, [task.id]: e.target.value })); }}
                              onClick={e => e.stopPropagation()}
                              placeholder="Бележка за този ден..."
                              rows={2}
                              className="w-full mt-1 px-2 py-1 border-2 border-gray-200 rounded-lg text-xs text-gray-700 bg-white bg-opacity-80 focus:border-indigo-400 focus:outline-none resize-none"
                            />
                          </div>
                        )}
                      </div>
                      {progressText && (
                        <span className={`text-lg font-bold px-3 py-1 rounded-full shadow ${isLight ? 'text-gray-700 bg-white' : 'text-gray-700 bg-white bg-opacity-80'}`}>
                          {progressText}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-1">
                    {habit.description && (
                      <button
                        onClick={e => { e.stopPropagation(); setExpandedInfo(prev => prev === task.id ? null : task.id); }}
                        className="text-sm leading-none opacity-60 hover:opacity-100"
                        title="Описание"
                      >ℹ️</button>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); setExpandedNote(prev => prev === task.id ? null : task.id); }}
                      className="text-sm leading-none opacity-60 hover:opacity-100"
                      title="Бележка"
                    >📝</button>
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => moveEntry(habit.id, -1)}
                        disabled={isSearching || entries.findIndex(e => e.habit.id === habit.id) === 0}
                        className="p-0.5 hover:bg-white hover:bg-opacity-50 rounded transition-colors disabled:opacity-30 text-xs leading-none"
                        title="Премести нагоре"
                      >▲</button>
                      <button
                        onClick={() => moveEntry(habit.id, 1)}
                        disabled={isSearching || entries.findIndex(e => e.habit.id === habit.id) === entries.length - 1}
                        className="p-0.5 hover:bg-white hover:bg-opacity-50 rounded transition-colors disabled:opacity-30 text-xs leading-none"
                        title="Премести надолу"
                      >▼</button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showDayModal && selectedEntry && (
        <div className="fixed inset-0 bg-gradient-to-br from-cyan-400 via-teal-300 to-emerald-300 bg-opacity-80 flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-br from-blue-100 to-purple-100 rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">{selectedEntry.habit.name}</h2>
                  <p className="text-sm text-gray-500">{formatDisplayDateWithToday(selectedDate)}</p>
                </div>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">✕</button>
              </div>

              {selectedEntry.task.makeupFromDate && (
                <div className="bg-orange-100 border-2 border-orange-400 rounded-xl p-4 mb-4">
                  <p className="font-bold text-orange-800">↻ Наваксване</p>
                  <p className="text-sm text-orange-700">За дата: {selectedEntry.task.makeupFromDate}</p>
                </div>
              )}

              {selectedEntry.task.makeupForDate ? (
                <div className="bg-orange-100 border-2 border-orange-400 rounded-xl p-4 text-center">
                  <div className="text-4xl mb-2">🔒</div>
                  <p className="font-bold text-orange-800">Този ден се наваксва</p>
                  <p className="text-sm text-orange-700 mt-1">На: {selectedEntry.task.makeupForDate}</p>
                </div>
              ) : (
                <TaskActions
                  task={selectedEntry.task}
                  onUpdate={handleTaskUpdate}
                  isMakeup={!!selectedEntry.task.makeupFromDate}
                />
              )}

              <div className="mt-4 pt-4 border-t border-gray-200">
                <label className="block text-sm font-semibold text-gray-700 mb-1">📝 Бележка</label>
                <textarea
                  value={modalNote}
                  onChange={e => setModalNote(e.target.value)}
                  placeholder="Добави бележка за този ден..."
                  rows={2}
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-indigo-400 focus:outline-none resize-none bg-white bg-opacity-80"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}