// MakeupPicker.jsx
import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate, MONTH_NAMES_BG_CAP, WEEKDAY_NAMES_BG, toMidnight, isPastDate } from '../../utils/dateUtils';
import { doesDateMatchRule } from '../../utils/ruleEngine';

export default function MakeupPicker({ currentDate, habit, allTasks, rule, onSelect, onClose }) {
  const [pickerDate, setPickerDate] = useState(new Date());

  const currentDateStr = formatDate(currentDate);

  const currentInRule = rule ? doesDateMatchRule(toMidnight(new Date(currentDate)), rule) : false;

  const isValidTarget = (date) => {
    const dateStr = formatDate(date);
    if (dateStr === currentDateStr) return { valid: false, reason: 'same' };
    if (!rule) return { valid: false, reason: 'no-rule' };

    const dateInRule = doesDateMatchRule(date, rule);

    if (currentInRule) {
      // От ден с правило → търсим дни БЕЗ правило
      if (dateInRule) return { valid: false, reason: 'outside-rule' };
    } else {
      // От ден без правило → търсим дни ОТ правило
      if (!dateInRule) return { valid: false, reason: 'outside-rule' };
      const existing = allTasks.find(t => t.date === dateStr && t.habitId === habit.id);
      if (!existing) return { valid: false, reason: 'no-task' };
      if (existing.status === 'completed') return { valid: false, reason: 'completed' };
      if (existing.makeupForDate) return { valid: false, reason: 'already-target' };
      if (existing.makeupFromDate) return { valid: false, reason: 'already-target' };
      return { valid: true, task: existing };
    }

    // Ден без правило като цел — не е нужна задача да съществува
    const existing = allTasks.find(t => t.date === dateStr && t.habitId === habit.id);
    if (existing?.status === 'completed') return { valid: false, reason: 'completed' };
    if (existing?.makeupFromDate) return { valid: false, reason: 'already-target' };
    if (existing?.makeupForDate) return { valid: false, reason: 'already-target' };

    return { valid: true, task: existing || null };
  };

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

  const today = toMidnight(new Date());

  return (
    <div className="mt-4 p-4 bg-orange-50 rounded-xl border-2 border-orange-200">
      <p className="text-sm font-semibold text-gray-700 mb-3">📅 Избери коя дата наваксваш</p>

      <div className="bg-white rounded-xl p-3 mb-3">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setPickerDate(d => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n; })} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="font-bold text-gray-800">
            {MONTH_NAMES_BG_CAP[pickerDate.getMonth()]} {pickerDate.getFullYear()}
          </span>
          <button onClick={() => setPickerDate(d => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n; })} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <button onClick={() => setPickerDate(new Date())} className="w-full py-2 mb-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm rounded-lg font-semibold">
          Днес
        </button>

        <div className="grid grid-cols-7 gap-1 mb-2">
          {WEEKDAY_NAMES_BG.map((d, i) => (
            <div key={i} className="text-center font-bold text-xs text-gray-600 py-1">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {pickerDays.map((day, i) => {
            if (!day.current) return (
              <div key={i} className="aspect-square flex items-center justify-center text-gray-300 text-sm">{day.date}</div>
            );

            const v         = isValidTarget(day.full);
            const checkDate = toMidnight(day.full);
            const isToday   = checkDate.getTime() === today.getTime();
            const isCurrent = formatDate(day.full) === currentDateStr;

            let bg     = 'bg-gray-100 border-gray-300 text-gray-400';
            let cursor = 'cursor-not-allowed';

            if (v.valid) {
              const isPast = checkDate < today;
              const status = v.task?.status;
              if (status === 'missed')        bg = 'bg-red-100 border-red-400 text-gray-800';
              else if (isPast)                bg = 'bg-yellow-100 border-yellow-400 text-gray-800';
              else                            bg = 'bg-blue-100 border-blue-400 text-gray-800';
              cursor = 'cursor-pointer hover:scale-105 hover:shadow-md';
            } else if (v.reason === 'completed')      bg = 'bg-green-100 border-green-300 text-gray-400 line-through';
            else if (v.reason === 'already-target')   bg = 'bg-orange-100 border-orange-300 text-gray-400';
            else if (isCurrent)                       bg = 'bg-indigo-100 border-purple-400 text-indigo-600 font-bold';

            return (
              <button key={i}
                onClick={() => v.valid && onSelect(day.full)}
                disabled={!v.valid}
                className={`aspect-square flex items-center justify-center rounded-lg border-2 text-sm font-semibold transition-all ${bg} ${cursor} ${isToday ? 'ring-2 ring-indigo-500' : ''}`}
              >
                {day.date}
              </button>
            );
          })}
        </div>
      </div>

      {/* Легенда */}
      <div className="space-y-1 text-xs text-gray-600 mb-3">
        <div className="flex items-center gap-2"><div className="w-4 h-4 bg-red-100 border-2 border-red-400 rounded" /><span>Пропуснато</span></div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 bg-yellow-100 border-2 border-yellow-400 rounded" /><span>Минало незавършено</span></div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 bg-blue-100 border-2 border-blue-400 rounded" /><span>Бъдещо</span></div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 bg-green-100 border-2 border-green-300 rounded" /><span className="line-through">Вече завършено</span></div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 bg-orange-100 border-2 border-orange-300 rounded" /><span>Вече наваксвано</span></div>
      </div>

      <button onClick={onClose} className="w-full py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300">
        Затвори
      </button>
    </div>
  );
}