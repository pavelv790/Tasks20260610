import { useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate, formatDisplayDate, toMidnight, isPastDate, MONTH_NAMES_BG_CAP, WEEKDAY_NAMES_BG } from '../../utils/dateUtils';
import { doesDateMatchRule } from '../../utils/ruleEngine';
import { createTaskObject, resetTaskProgress, generateId } from '../../utils/habitUtils';
import { checkMissedTasks } from '../../utils/taskGenerator';
import TaskActions from '../today/TaskActions';
import MakeupPicker from './MakeupPicker';

export default function DayModal({ date, task, habit, allTasks, rules, onTasksUpdate, onClose }) {
  const [showMakeupPicker,   setShowMakeupPicker]   = useState(false);
  const [showUnlinkedPicker, setShowUnlinkedPicker] = useState(false);
  const [note, setNote] = useState(task?.note || '');

  const saveNote = () => {
    if (note === (task?.note || '')) return;
    const updatedTask = task
      ? { ...task, note }
      : { ...createTaskObject(habit, dateStr, rule?.id), note, createdBy: 'manual' };
    let updated = allTasks.find(t => t.id === updatedTask.id)
      ? allTasks.map(t => t.id === updatedTask.id ? updatedTask : t)
      : [...allTasks, updatedTask];
    onTasksUpdate(checkMissedTasks(updated), true);
  };

  const handleClose = () => {
    saveNote();
    onClose();
  };

  const rule          = rules.find(r => r.habitId === habit.id && r.isActive);
  const dateStr       = formatDate(date);
  const inRule        = rule ? doesDateMatchRule(date, rule) : false;
  const isMakeupDay   = !!task?.makeupFromDate;
  const isBeingMadeUp = !!task?.makeupForDate;
  const effectiveTask = task?.manuallyReset ? null : task;

  const handleTaskUpdate = (updatedTask, ...extra) => {
    const taskWithNote = note !== (task?.note || '')
      ? { ...updatedTask, note }
      : updatedTask;
    let updated = allTasks.map(t => t.id === taskWithNote.id ? taskWithNote : t);
    if (!allTasks.find(t => t.id === taskWithNote.id)) updated = [...updated, taskWithNote];
    extra.forEach(t => {
      if (!t) return;
      const idx = updated.findIndex(x => x.id === t.id);
      if (idx >= 0) updated[idx] = t;
      else updated.push(t);
    });
    onTasksUpdate(checkMissedTasks(updated));
  };

  const handleReset = () => {
    if (!task) return;
    let updatedTask = { ...resetTaskProgress(task), makeupFromDate: null, makeupForDate: null };
    let extra = [];
    if (task.createdBy === 'manual' && !inRule && !task.makeupFromDate && !task.makeupForDate) {
      if (note.trim() !== '') {
        const resetWithNote = { ...updatedTask, note };
        const updated = allTasks.map(t => t.id === task.id ? resetWithNote : t);
        onTasksUpdate(checkMissedTasks(updated));
      } else {
        onTasksUpdate(checkMissedTasks(allTasks.filter(t => t.id !== task.id)));
      }
      onClose();
      return;
    }

    if (task.makeupFromDate) {
      const source = allTasks.find(t => t.date === task.makeupFromDate && t.habitId === habit.id);
      if (source) {
        const sourceDate = toMidnight(new Date(source.date));
        extra.push({ ...source, makeupForDate: null, status: isPastDate(sourceDate) ? 'missed' : 'pending' });
      }
      if (!inRule) {
        const updated = allTasks.filter(t => t.id !== task.id);
        const withExtra = updated.map(t => extra.find(e => e.id === t.id) || t);
        saveNote();
        onTasksUpdate(checkMissedTasks(withExtra));
        onClose();
        return;
      }
    }

    if (task.makeupForDate) {
      const makeupTask = allTasks.find(t => t.date === task.makeupForDate && t.habitId === habit.id);
      if (makeupTask) {
        const makeupInRule = rule ? doesDateMatchRule(new Date(makeupTask.date), rule) : false;
        if (!makeupInRule) {
          extra.push({ _delete: true, id: makeupTask.id });
        } else {
          extra.push({ ...resetTaskProgress(makeupTask), makeupFromDate: null });
        }
      }
    }

    let updated = allTasks.map(t => t.id === updatedTask.id ? updatedTask : t);
    extra.forEach(e => {
      if (e._delete) { updated = updated.filter(t => t.id !== e.id); return; }
      const idx = updated.findIndex(t => t.id === e.id);
      if (idx >= 0) updated[idx] = e;
    });
    saveNote();
    onTasksUpdate(checkMissedTasks(updated));
    onClose();
  };

  const handleMakeupSelect = (targetDate) => {
    const targetStr  = formatDate(targetDate);
    let targetTask = allTasks.find(t => t.date === targetStr && t.habitId === habit.id);

    const updates = [];

    if (task?.makeupFromDate) {
      const oldSource = allTasks.find(t => t.date === task.makeupFromDate && t.habitId === habit.id);
      if (oldSource) {
        const oldDate = toMidnight(new Date(oldSource.date));
        updates.push({ ...oldSource, makeupForDate: null, status: isPastDate(oldDate) ? 'missed' : 'pending' });
      }
    }

    if (!targetTask) {
      targetTask = createTaskObject(habit, targetStr, rule?.id);
    }

    const currentTask = task || createTaskObject(habit, dateStr, rule?.id);
    if (inRule) {
  // От ден с правило → текущият се наваксва, избраният наваксва
  updates.push({ ...currentTask, makeupForDate: targetStr, status: currentTask.status === 'missed' ? 'missed' : currentTask.status });
  updates.push({ ...targetTask, makeupFromDate: dateStr, status: 'makeup' });
    } else {
      // От ден без правило → текущият наваксва, избраният се наваксва
      updates.push({ ...currentTask, makeupFromDate: targetStr, status: currentTask.status === 'completed' ? 'completed' : 'pending' });
      updates.push({ ...targetTask, makeupForDate: dateStr });
    }

    let updated = [...allTasks];
    updates.forEach(u => {
      const idx = updated.findIndex(t => t.id === u.id);
      if (idx >= 0) updated[idx] = u;
      else updated.push(u);
    });

    onTasksUpdate(checkMissedTasks(updated));
    setShowMakeupPicker(false);
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-cyan-400 via-teal-300 to-emerald-300 bg-opacity-80 flex items-center justify-center p-4 z-50">
      <div className="bg-gradient-to-br from-blue-100 to-purple-100 rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">

          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: habit.color }} />
              <div>
                <h2 className="text-xl font-bold text-gray-800">{habit.name}</h2>
                <p className="text-sm text-gray-500">{formatDisplayDate(date)}</p>
              </div>
            </div>
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Няма задача — празен ден */}
          {!effectiveTask && !inRule && (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">🔭</div>
              <p className="text-gray-600 mb-6">Няма планирана задача за този ден</p>
              <button
                onClick={() => setShowMakeupPicker(true)}
                className="w-full py-4 bg-gradient-to-r from-orange-400 to-orange-500 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-shadow mb-3"
              >
                ➕ Наваксай задача тук
              </button>
              <button
                onClick={() => {
                  const newTask = {
                    ...createTaskObject(habit, dateStr, null),
                    status: 'pending',
                    createdBy: 'manual',
                  };
                  handleTaskUpdate(newTask);
                  onClose();
                }}
                className="w-full py-4 bg-gradient-to-r from-teal-400 to-teal-500 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-shadow"
              >
                ✓ Отработи сега (без връзка)
              </button>
            </div>
          )}

          {/* Ден от правилото без задача */}
          {!effectiveTask && inRule && !task?.manuallyReset && (
            <div className="text-center py-4">
              <p className="text-gray-600 mb-4">Задачата все още не е генерирана.</p>
              <button
                onClick={() => setShowMakeupPicker(true)}
                className="w-full py-3 bg-gradient-to-r from-orange-400 to-orange-500 text-white rounded-xl font-semibold hover:shadow-lg"
              >
                ➕ Наваксай задача тук
              </button>
            </div>
          )}

          {/* Нулиран ден от правилото */}
          {!effectiveTask && inRule && task?.manuallyReset && (
            <div>
              <TaskActions
                task={task}
                onUpdate={t => { handleTaskUpdate(t); onClose(); }}
                isMakeup={false}
              />
              <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                {task?.status !== 'completed' && (
                  <button
                    onClick={() => setShowMakeupPicker(true)}
                    className="w-full py-2 bg-gradient-to-r from-orange-400 to-orange-500 text-white rounded-xl font-semibold text-sm hover:shadow-lg"
                  >
                    ↻ Наваксай на друга дата
                  </button>
                )}
                {task?.status !== 'completed' && allTasks.some(t => t.habitId === habit.id && t.createdBy === 'manual' && !t.makeupFromDate && !t.makeupForDate && t.date !== dateStr) && (
                  <button
                    onClick={() => setShowUnlinkedPicker(true)}
                    className="w-full py-2 bg-gradient-to-r from-teal-400 to-teal-500 text-white rounded-xl font-semibold text-sm hover:shadow-lg"
                  >
                    🔗 Свържи с отработен ден
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Денят се наваксва другаде */}
          {effectiveTask && isBeingMadeUp && (
            <div>
              <div className="bg-orange-100 border-2 border-orange-400 rounded-xl p-4 text-center mb-4">
                <div className="text-4xl mb-2">🔒</div>
                <p className="font-bold text-orange-800">Този ден се наваксва</p>
                <p className="text-sm text-orange-700 mt-1">На: {task.makeupForDate}</p>
                <p className="text-xs text-gray-600 mt-2">Прогресът се управлява от деня на наваксване</p>
              </div>
              <button onClick={handleReset} className="w-full py-3 bg-gradient-to-r from-gray-400 to-gray-500 text-white rounded-xl font-semibold hover:shadow-lg transition-shadow">
                🔄 Нулирай задачата
              </button>
            </div>
          )}

          {/* Makeup ден */}
          {effectiveTask && isMakeupDay && (
            <div>
              <div className="bg-orange-100 border-2 border-orange-400 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">↻</span>
                  <div>
                    <p className="font-bold text-orange-800">Наваксване</p>
                    <p className="text-sm text-orange-700">За дата: {task.makeupFromDate}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowMakeupPicker(true)}
                  className="w-full mt-2 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold text-sm"
                >
                  ✏️ Промени датата за наваксване
                </button>
              </div>
              <TaskActions
                task={task}
                onUpdate={t => { handleTaskUpdate(t); onClose(); }}
                isMakeup={true}
              />
              <div className="mt-3">
                <button onClick={handleReset} className="w-full py-3 bg-gradient-to-r from-gray-400 to-gray-500 text-white rounded-xl font-semibold hover:shadow-lg transition-shadow">
                  🔄 Нулирай задачата
                </button>
              </div>
            </div>
          )}

          {/* Отработен без връзка */}
          {effectiveTask && !isMakeupDay && !isBeingMadeUp && effectiveTask.createdBy === 'manual' && !inRule && (
            <div>
              <div className="bg-teal-100 border-2 border-teal-400 rounded-xl p-4 text-center mb-4">
                <div className="text-4xl mb-2">✓</div>
                <p className="font-bold text-teal-800">Отработен без връзка</p>
                <p className="text-xs text-gray-600 mt-1">Можеш да свържеш с ден от правилото</p>
              </div>
              <TaskActions
                task={task}
                onUpdate={t => { handleTaskUpdate(t); onClose(); }}
                isMakeup={true}
              />
              <div className="mt-3 space-y-2">
                <button
                  onClick={() => setShowMakeupPicker(true)}
                  className="w-full py-3 bg-gradient-to-r from-teal-400 to-teal-500 text-white rounded-xl font-semibold hover:shadow-lg transition-shadow"
                >
                  🔗 Свържи с ден от правилото
                </button>
                <button onClick={handleReset} className="w-full py-3 bg-gradient-to-r from-gray-400 to-gray-500 text-white rounded-xl font-semibold hover:shadow-lg transition-shadow">
                  🔄 Нулирай задачата
                </button>
              </div>
            </div>
          )}

          {/* Обикновен ден */}
          {effectiveTask && !isMakeupDay && !isBeingMadeUp && !(effectiveTask.createdBy === 'manual' && !inRule) && (
            <div>
              <TaskActions
                task={task}
                onUpdate={t => { handleTaskUpdate(t); onClose(); }}
                isMakeup={false}
              />
              <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                {!task?.makeupForDate && task?.status !== 'completed' && (
                <button
                  onClick={() => setShowMakeupPicker(true)}
                  className="w-full py-2 bg-gradient-to-r from-orange-400 to-orange-500 text-white rounded-xl font-semibold text-sm hover:shadow-lg"
                >
                  ↻ Наваксай на друга дата
                </button>
                )}
                {task?.status !== 'completed' && allTasks.some(t => t.habitId === habit.id && t.createdBy === 'manual' && !t.makeupFromDate && !t.makeupForDate && t.date !== dateStr) && (
                  <button
                    onClick={() => setShowUnlinkedPicker(true)}
                    className="w-full py-2 bg-gradient-to-r from-teal-400 to-teal-500 text-white rounded-xl font-semibold text-sm hover:shadow-lg"
                  >
                    🔗 Свържи с отработен ден
                  </button>
                )}
              </div>
            </div>
          )}
          {/* Бележка */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <label className="block text-sm font-semibold text-gray-700 mb-1">📝 Бележка</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Добави бележка за този ден..."
              rows={2}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-indigo-400 focus:outline-none resize-none bg-white bg-opacity-80"
            />
          </div>

          {/* Makeup Picker */}
          {showMakeupPicker && (
            <MakeupPicker
              currentDate={date}
              habit={habit}
              allTasks={allTasks}
              rule={rule}
              onSelect={handleMakeupSelect}
              onClose={() => setShowMakeupPicker(false)}
            />
          )}

          {/* Unlinked Picker */}
          {showUnlinkedPicker && (
            <UnlinkedPicker
              currentDate={date}
              habit={habit}
              allTasks={allTasks}
              onSelect={(unlinkedTask) => {
                const updatedCurrent  = { ...task, makeupForDate: unlinkedTask.date };
                const updatedUnlinked = { ...unlinkedTask, makeupFromDate: dateStr };
                handleTaskUpdate(updatedCurrent, updatedUnlinked);
                setShowUnlinkedPicker(false);
                onClose();
              }}
              onClose={() => setShowUnlinkedPicker(false)}
            />
          )}

        </div>
      </div>
    </div>
  );
}

function UnlinkedPicker({ currentDate, habit, allTasks, onSelect, onClose }) {
  const [pickerDate, setPickerDate] = useState(new Date());
  const currentDateStr = formatDate(currentDate);

  const unlinkedTasks = allTasks.filter(t =>
    t.habitId === habit.id &&
    !t.makeupFromDate &&
    !t.makeupForDate &&
    t.createdBy === 'manual' &&
    t.date !== currentDateStr
  );

  const pickerDays = (() => {
    const year      = pickerDate.getFullYear();
    const month     = pickerDate.getMonth();
    const firstDay  = new Date(year, month, 1).getDay();
    const total     = new Date(year, month + 1, 0).getDate();
    const start     = firstDay === 0 ? 6 : firstDay - 1;
    const prevTotal = new Date(year, month, 0).getDate();
    const days      = [];

    for (let i = start - 1; i >= 0; i--)
      days.push({ date: prevTotal - i, current: false, full: new Date(year, month - 1, prevTotal - i) });
    for (let i = 1; i <= total; i++)
      days.push({ date: i, current: true, full: new Date(year, month, i) });
    let next = 1;
    while (days.length < 42)
      days.push({ date: next++, current: false, full: new Date(year, month + 1, next - 1) });
    return days;
  })();

  return (
    <div className="mt-4 p-4 bg-teal-50 rounded-xl border-2 border-teal-200">
      <p className="text-sm font-semibold text-gray-700 mb-3">🔗 Избери кой отработен ден да се свърже</p>

      <div className="bg-white rounded-xl p-3 mb-3">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setPickerDate(d => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n; })}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="font-bold text-gray-800">
            {MONTH_NAMES_BG_CAP[pickerDate.getMonth()]} {pickerDate.getFullYear()}
          </span>
          <button
            onClick={() => setPickerDate(d => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n; })}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
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

            const dStr       = formatDate(day.full);
            const isUnlinked = unlinkedTasks.some(t => t.date === dStr);
            const isCurrent  = dStr === currentDateStr;

            let bg = 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed';
            if (isUnlinked) bg = 'bg-teal-100 border-teal-400 text-gray-800 cursor-pointer hover:scale-105';
            if (isCurrent)  bg = 'bg-indigo-100 border-purple-400 text-indigo-600 font-bold cursor-not-allowed';

            return (
              <button
                key={i}
                onClick={() => {
                  if (!isUnlinked) return;
                  const t = unlinkedTasks.find(t => t.date === dStr);
                  if (t) onSelect(t);
                }}
                disabled={!isUnlinked}
                className={`aspect-square flex items-center justify-center rounded-lg border-2 text-sm font-semibold transition-all ${bg}`}
              >
                {day.date}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1 text-xs text-gray-600 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-teal-100 border-2 border-teal-400 rounded" />
          <span>Отработен ден без връзка</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-100 border-2 border-gray-200 rounded" />
          <span>Не е отработен</span>
        </div>
      </div>

      <button
        onClick={onClose}
        className="w-full py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300"
      >
        Затвори
      </button>
    </div>
  );
}