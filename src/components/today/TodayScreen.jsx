import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Search, Plus } from 'lucide-react';
import { formatDate, formatDisplayDateWithToday, MONTH_NAMES_BG_CAP, WEEKDAY_NAMES_BG, toMidnight } from '../../utils/dateUtils';
import { generateTasksForMonth, checkMissedTasks } from '../../utils/taskGenerator';
import { getEffectiveStatus, getProgressText, isTaskCompleted, isEntirelyInactive } from '../../utils/habitUtils';
import { getCalendarDayState } from '../../utils/calendarStates';
import TaskActions from './TaskActions';
import TodoRow from './TodoRow';
import TodoModal from './TodoModal';
import Toast from '../ui/Toast';

export default function TodayScreen({ habits, tasks, rules, todos = [], onTasksUpdate, onTaskNoteUpdate, onHabitsReorder, onTodoSave, onTodoDelete, onHabitInactivityChange, dayOrders, onDayOrdersChange }) {
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
  const [completingTodoId, setCompletingTodoId] = useState(null);
  const [undoTodo,       setUndoTodo]       = useState(null);
  const [showCreateTodo, setShowCreateTodo] = useState(false);
  const followingTodayRef = useRef(true);

  useEffect(() => {
    if (expandedNote === null) return;
    const handler = (e) => {
      const toggleBtn = e.target.closest('[data-note-toggle]');
      if (toggleBtn && toggleBtn.getAttribute('data-note-toggle') === String(expandedNote)) return;
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

  const today          = toMidnight(new Date());
  const selDay         = toMidnight(selectedDate);
  const isTodaySelected = selDay.getTime() === today.getTime();

  const isSearching = searchQuery.trim().length > 0;
  const q = searchQuery.trim().toLowerCase();
  const todayStr = formatDate(new Date());

  // ── Еднократни задачи за този ден (+ пренасяне на просрочените в „Днес") ──
  const todoBelongsHere = (t) => {
    const d = t.date ?? todayStr;
    if (d === dateStr) return true;
    if (isTodaySelected && d < todayStr && t.status !== 'completed') return true;
    return false;
  };
  const ordTodo = (t) => t.order ?? t.createdAt ?? 0;
  const dayTodos = todos
    .filter(t => t.status !== 'completed' || t.id === completingTodoId)
    .filter(todoBelongsHere)
    .sort((a, b) => ordTodo(a) - ordTodo(b));

  // ── Общ ред: навици (по подредба) + еднократни, после евент. ръчна подредба за деня ──
  const naturalRefs = [
    ...sortedHabits.map(h => ({ kind: 'habit', id: h.id })),
    ...dayTodos.map(t => ({ kind: 'todo', id: t.id })),
  ];
  const dayOrderList = dayOrders[dateStr];
  const orderedRefs = dayOrderList
    ? [...naturalRefs].sort((a, b) => {
        const ia = dayOrderList.indexOf(a.id);
        const ib = dayOrderList.indexOf(b.id);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      })
    : naturalRefs;

  // ── Видими елементи (скрити: завършени навици, липсващи задачи, наваксани дни) ──
  const items = orderedRefs.map(ref => {
    if (ref.kind === 'todo') {
      const todo = todos.find(t => t.id === ref.id);
      if (!todo) return null;
      if (todo.status === 'completed' && todo.id !== completingTodoId) return null;
      return { kind: 'todo', id: ref.id, todo };
    }
    const habit = habits.find(h => h.id === ref.id);
    const task  = tasksForDate.find(t => t.habitId === ref.id);
    if (!habit || !task) return null;
    const status = getEffectiveStatus(task);
    const isInert = (!!habit.inactive || isEntirelyInactive(task)) && !isTaskCompleted(task);
    if (!isInert) {
      if (status === 'completed' && !task.makeupFromDate) return null;
      if (isTaskCompleted(task) && task.makeupFromDate) return null;
      if (task.makeupForDate) {
        const makeupTask = tasks.find(t => t.date === task.makeupForDate && t.habitId === ref.id);
        if (makeupTask && isTaskCompleted(makeupTask)) return null;
      }
    }
    return { kind: 'habit', id: ref.id, habit, task, status, isInert };
  }).filter(Boolean);

  const filteredItems = isSearching
    ? items.filter(it => (it.kind === 'habit' ? it.habit.name : it.todo.name).toLowerCase().includes(q))
    : items;

  // Живи обекти за отворения прозорец (за да реагира веднага на промени в неактивността)
  const modalHabit = selectedEntry ? (habits.find(h => h.id === selectedEntry.habit.id) ?? selectedEntry.habit) : null;
  const modalTask  = selectedEntry ? (tasks.find(t => t.id === selectedEntry.task.id) ?? selectedEntry.task) : null;

  const handleToggleInactive = ({ scope, index }) => {
    if (!modalHabit || !onHabitInactivityChange) return;
    let patch;
    let reactivating;
    if (scope === 'task') {
      reactivating = !!modalHabit.inactive;
      patch = { inactive: !modalHabit.inactive };
    } else if (scope === 'completion') {
      const cur = modalHabit.inactiveCompletions ?? [];
      reactivating = cur.includes(index);
      patch = { inactiveCompletions: cur.includes(index) ? cur.filter(i => i !== index) : [...cur, index] };
    } else {
      const cur = modalHabit.inactiveSubtasks ?? [];
      reactivating = cur.includes(index);
      patch = { inactiveSubtasks: cur.includes(index) ? cur.filter(i => i !== index) : [...cur, index] };
    }
    onHabitInactivityChange(modalHabit.id, patch);
    // Прозорецът остава отворен САМО при „направи цялата задача неактивна" — там излиза
    // важен надпис. Всичко друго (брой изпълнения / подзадачи; всяко „върни активно")
    // затваря, като при отмятане (виж handleTaskUpdate).
    const keepOpen = scope === 'task' && !reactivating;
    if (!keepOpen) setTimeout(() => closeModal(), 300);
  };

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
  
  // Пренареждане в общия ред (навици + еднократни); пише пълния ред в dayOrders[dateStr]
  const moveItem = (id, direction) => {
    if (isSearching) return;
    const visibleIds = items.map(it => it.id);
    const vIdx = visibleIds.indexOf(id);
    const targetIdx = vIdx + direction;
    if (vIdx === -1 || targetIdx < 0 || targetIdx >= visibleIds.length) return;
    const targetId = visibleIds[targetIdx];

    const full = orderedRefs.map(r => r.id);
    const i = full.indexOf(id);
    const j = full.indexOf(targetId);
    [full[i], full[j]] = [full[j], full[i]];
    onDayOrdersChange(prev => ({ ...prev, [dateStr]: full }));
  };

  const handleDragStart = (e, id) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e, targetId) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) { setDraggedId(null); return; }
    const full = orderedRefs.map(r => r.id);
    const dragIdx   = full.indexOf(draggedId);
    const targetIdx = full.indexOf(targetId);
    if (dragIdx === -1 || targetIdx === -1) { setDraggedId(null); return; }
    const reordered = [...full];
    const [moved]   = reordered.splice(dragIdx, 1);
    reordered.splice(targetIdx, 0, moved);
    onDayOrdersChange(prev => ({ ...prev, [dateStr]: reordered }));
    setDraggedId(null);
  };

  // Еднократна задача е завършена → кратка анимация, после toast „Върни"
  const handleTodoComplete = (snapshot) => {
    setCompletingTodoId(snapshot.id);
    setTimeout(() => {
      setCompletingTodoId(null);
      setUndoTodo(snapshot);
    }, 1200);
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
        {items.length === 0 ? (
          <div className="bg-gradient-to-br from-blue-100 to-cyan-100 rounded-2xl shadow-lg p-8 text-center">
            {tasksForDate.length === 0 ? (
              <><div className="text-6xl mb-4">🔭</div><p className="text-xl font-semibold text-gray-600">Няма задачи за този ден</p></>
            ) : tasksForDate.some(t => getEffectiveStatus(t) === 'missed') ? (
              <><div className="text-6xl mb-4">🔭</div><p className="text-xl font-semibold text-gray-600">Няма активни задачи</p></>
            ) : (
              <><div className="text-6xl mb-4">🎉</div><p className="text-xl font-semibold text-green-600">Браво! Всичко е завършено!</p><p className="text-gray-500 mt-2">Днес си го направил страхотно! 💪</p></>
            )}
          </div>
        ) : filteredItems.length === 0 ? (
          <p className="text-center text-gray-500 py-6">Няма намерени задачи</p>
        ) : (
          filteredItems.map((it, idx) => {
            if (it.kind === 'todo') {
              return (
                <TodoRow
                  key={it.id}
                  todo={it.todo}
                  dateStr={dateStr}
                  onSave={onTodoSave}
                  onDelete={onTodoDelete}
                  onComplete={handleTodoComplete}
                  completing={completingTodoId === it.id}
                  isSearching={isSearching}
                  isFirst={idx === 0}
                  isLast={idx === filteredItems.length - 1}
                  onMoveUp={() => moveItem(it.id, -1)}
                  onMoveDown={() => moveItem(it.id, 1)}
                  draggable={!isSearching}
                  onDragStart={e => !isSearching && handleDragStart(e, it.id)}
                  onDragOver={e => !isSearching && e.preventDefault()}
                  onDrop={e => !isSearching && handleDrop(e, it.id)}
                  isDragging={draggedId === it.id}
                />
              );
            }
            const { habit, task, status } = it;

            if (it.isInert) {
              return (
                <div
                  key={task.id}
                  draggable={!isSearching}
                  onDragStart={e => !isSearching && handleDragStart(e, habit.id)}
                  onDragOver={e => !isSearching && e.preventDefault()}
                  onDrop={e => !isSearching && handleDrop(e, habit.id)}
                  className={`w-full bg-gray-100 border border-gray-300 rounded-xl shadow-md p-4 transition-all opacity-75 ${draggedId === habit.id ? 'opacity-50 scale-95' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-gray-400 cursor-grab active:cursor-grabbing text-lg leading-none pt-1">⋮⋮</span>
                    <div
                      className="flex-1 min-w-0 text-left cursor-pointer"
                      onClick={() => { setSelectedEntry({ habit, task }); setModalNote(task.note || ''); setShowDayModal(true); }}
                    >
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-bold text-gray-600 truncate">{habit.name}</h3>
                        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-gray-500 bg-gray-200 rounded px-1.5 py-0.5">
                          неактивна
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 font-semibold">⏸ Неактивна</p>
                    </div>
                    <div className="flex flex-col gap-0.5 ml-1">
                      <button
                        onClick={() => moveItem(habit.id, -1)}
                        disabled={isSearching || idx === 0}
                        className="p-0.5 hover:bg-white hover:bg-opacity-50 rounded transition-colors disabled:opacity-30 text-xs leading-none"
                        title="Премести нагоре"
                      >▲</button>
                      <button
                        onClick={() => moveItem(habit.id, 1)}
                        disabled={isSearching || idx === filteredItems.length - 1}
                        className="p-0.5 hover:bg-white hover:bg-opacity-50 rounded transition-colors disabled:opacity-30 text-xs leading-none"
                        title="Премести надолу"
                      >▼</button>
                    </div>
                  </div>
                </div>
              );
            }

            const progressText = getProgressText(task);
            const activeRule = rules.find(r => r.habitId === habit.id && r.isActive);
            const dayState = getCalendarDayState(selectedDate, task, activeRule);

            const isLight = dayState.bgColor === 'bg-gray-50' || dayState.bgColor.includes('from-white') || dayState.bgColor === 'bg-white';
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
            else if (status === 'inactive') { statusIcon = '⏸'; statusText = 'Неактивна'; }

            return (
              <div key={task.id} draggable={!isSearching}
                onDragStart={e => !isSearching && handleDragStart(e, habit.id)}
                onDragOver={e => !isSearching && e.preventDefault()}
                onDrop={e => !isSearching && handleDrop(e, habit.id)}
                className={`w-full ${bgColor} rounded-xl shadow-md p-4 transition-all hover:shadow-lg ${draggedId === habit.id ? 'opacity-50 scale-95' : ''}`}
                style={{
                  ...(dayState.bgColor.includes('gradient') ? { background: 'linear-gradient(to bottom right, white, #86efac)' } : {}),
                  ...(dayState.bgColor === 'bg-white' ? { background: 'white' } : {}),
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
                              autoFocus
                              value={noteValues[task.id] ?? task.note ?? ''}
                              onChange={e => { e.stopPropagation(); setNoteValues(prev => ({ ...prev, [task.id]: e.target.value })); }}
                              onClick={e => e.stopPropagation()}
                              onFocus={e => { const v = e.target.value; e.target.setSelectionRange(v.length, v.length); }}
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
                      data-note-toggle={task.id}
                      onClick={e => {
                        e.stopPropagation();
                        setExpandedNote(prev => {
                          if (prev === task.id) {
                            const val = noteValues[task.id] ?? task.note ?? '';
                            if (val !== (task.note || '')) {
                              onTasksUpdate([{ ...task, note: val }]);
                            }
                            return null;
                          }
                          return task.id;
                        });
                      }}
                      className="text-sm leading-none opacity-60 hover:opacity-100"
                      title="Бележка"
                    >📝</button>
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => moveItem(habit.id, -1)}
                        disabled={isSearching || idx === 0}
                        className="p-0.5 hover:bg-white hover:bg-opacity-50 rounded transition-colors disabled:opacity-30 text-xs leading-none"
                        title="Премести нагоре"
                      >▲</button>
                      <button
                        onClick={() => moveItem(habit.id, 1)}
                        disabled={isSearching || idx === filteredItems.length - 1}
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

      {/* Създаване на еднократна задача — под списъка */}
      <button
        onClick={() => setShowCreateTodo(true)}
        className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold shadow-md hover:shadow-lg flex items-center justify-center gap-2 transition-shadow"
      >
        <Plus className="w-5 h-5" />
        Създай еднократна задача
      </button>

      {showCreateTodo && (
        <TodoModal
          todo={null}
          date={dateStr}
          onSave={(t) => { onTodoSave(t); setShowCreateTodo(false); }}
          onClose={() => setShowCreateTodo(false)}
        />
      )}

      {undoTodo && (
        <Toast
          type="success"
          duration={5000}
          message={
            <span className="flex items-center gap-3 whitespace-nowrap">
              Изпълнена
              <button
                onClick={() => { onTodoSave(undoTodo); setUndoTodo(null); }}
                className="underline font-bold bg-white/20 px-2 py-0.5 rounded-lg hover:bg-white/30"
              >
                Върни
              </button>
            </span>
          }
          onClose={() => { onTodoDelete(undoTodo.id); setUndoTodo(null); }}
        />
      )}

      {showDayModal && selectedEntry && (
        <div className="fixed inset-0 bg-gradient-to-br from-cyan-400 via-teal-300 to-emerald-300 bg-opacity-80 flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-br from-blue-100 to-purple-100 rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">{modalHabit.name}</h2>
                  <p className="text-sm text-gray-500">{formatDisplayDateWithToday(selectedDate)}</p>
                </div>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">✕</button>
              </div>

              {modalTask.makeupFromDate && (
                <div className="bg-orange-100 border-2 border-orange-400 rounded-xl p-4 mb-4">
                  <p className="font-bold text-orange-800">↻ Наваксване</p>
                  <p className="text-sm text-orange-700">За дата: {modalTask.makeupFromDate}</p>
                </div>
              )}

              {modalTask.makeupForDate ? (
                <div className="bg-orange-100 border-2 border-orange-400 rounded-xl p-4 text-center">
                  <div className="text-4xl mb-2">🔒</div>
                  <p className="font-bold text-orange-800">Този ден се наваксва</p>
                  <p className="text-sm text-orange-700 mt-1">На: {modalTask.makeupForDate}</p>
                </div>
              ) : (
                <TaskActions
                  task={modalTask}
                  onUpdate={handleTaskUpdate}
                  isMakeup={!!modalTask.makeupFromDate}
                  onToggleInactive={onHabitInactivityChange ? handleToggleInactive : null}
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