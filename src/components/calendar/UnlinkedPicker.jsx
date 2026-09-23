import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate, MONTH_NAMES_BG_CAP, WEEKDAY_NAMES_BG } from '../../utils/dateUtils';

export default function UnlinkedPicker({ currentDate, habit, allTasks, onSelect, onClose }) {
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
