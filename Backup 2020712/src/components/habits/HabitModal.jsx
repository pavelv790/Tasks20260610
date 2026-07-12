import { useState } from 'react';
import { X } from 'lucide-react';
import { generateId } from '../../utils/habitUtils';
import { COLORS, WEEKDAY_COLORS } from '../../utils/constants';
import { WEEKDAY_NAMES_BG } from '../../utils/dateUtils';
import { formatDate } from '../../utils/dateUtils';
import DateInput from '../ui/DateInput';

// ─────────────────────────────────────────────────────────
// Помощни функции (извън компонента за чистота)
// ─────────────────────────────────────────────────────────

const ruleHasChanged = (oldRule, newRule) => {
  if (!oldRule) return true;
  if (oldRule.type !== newRule.type) return true;
  if (oldRule.startDate !== newRule.startDate) return true;
  if (newRule.type === 'simple') {
    if (oldRule.simplePattern !== newRule.simplePattern) return true;
    if (newRule.simplePattern === 'custom_interval' && oldRule.customInterval !== newRule.customInterval) return true;
    if (newRule.simplePattern === 'monthly'         && oldRule.monthlyDay    !== newRule.monthlyDay)    return true;
    if (newRule.simplePattern === 'yearly'          &&
        (oldRule.yearlyMonth !== newRule.yearlyMonth || oldRule.yearlyDay !== newRule.yearlyDay)) return true;
  }
  if (newRule.type === 'complex') {
    return JSON.stringify([...(oldRule.complexDays ?? [])].sort()) !==
           JSON.stringify([...(newRule.complexDays ?? [])].sort());
  }
  return false;
};

const habitHasChanged = (oldHabit, oldRule, newHabit, newRule) => {
  if (!oldHabit) return true;
  if (oldHabit.name         !== newHabit.name)         return true;
  if (oldHabit.isDefault    !== newHabit.isDefault)     return true;
  if (oldHabit.timesPerDay  !== newHabit.timesPerDay)   return true;
  if (oldHabit.subtasksCount !== newHabit.subtasksCount) return true;
  if (oldHabit.reminderTime !== newHabit.reminderTime)  return true;
  if ((oldHabit.description ?? null) !== (newHabit.description ?? null)) return true;
  if (JSON.stringify(oldHabit.subtaskNames ?? []) !== JSON.stringify(newHabit.subtaskNames ?? [])) return true;
  return ruleHasChanged(oldRule, newRule);
};

// ─────────────────────────────────────────────────────────
export default function HabitModal({ habit, existingRule, habits, onSave, onClose }) {
  const isEditing = !!habit;

  // ── Форма — данни за задача ──────────────────────────
  const [name,          setName]          = useState(habit?.name          ?? '');
  const [isDefault,     setIsDefault]     = useState(habit?.isDefault     ?? false);
  const [timesPerDay,   setTimesPerDay]   = useState(habit?.timesPerDay   ?? 1);
  const [subtasksCount, setSubtasksCount] = useState(habit?.subtasksCount ?? 0);
  const [subtaskNames,  setSubtaskNames]  = useState(habit?.subtaskNames  ?? []);
  const [reminderTime,  setReminderTime]  = useState(habit?.reminderTime  ?? null);
  const [color,         setColor]         = useState(habit?.color ?? COLORS[Math.floor(Math.random() * COLORS.length)]);
  const [description,   setDescription]   = useState(habit?.description   ?? '');

  // ── Форма — правило ──────────────────────────────────
  const [ruleType,       setRuleType]       = useState(existingRule?.type          ?? 'simple');
  const [simplePattern,  setSimplePattern]  = useState(existingRule?.simplePattern ?? 'daily');
  const [customInterval, setCustomInterval] = useState(existingRule?.customInterval ?? 2);
  const [complexDays,    setComplexDays]    = useState(existingRule?.complexDays   ?? []);
  const [monthlyDay,     setMonthlyDay]     = useState(existingRule?.monthlyDay    ?? 1);
  const [yearlyMonth,    setYearlyMonth]    = useState(existingRule?.yearlyMonth   ?? 0);
  const [yearlyDay,      setYearlyDay]      = useState(existingRule?.yearlyDay     ?? 1);
  const [startDate,      setStartDate]      = useState(existingRule?.startDate     ?? formatDate(new Date()));

  // ── UI state ─────────────────────────────────────────
  const [error,           setError]           = useState('');
  const [showWarning,     setShowWarning]      = useState(false);
  const [pendingSave,     setPendingSave]      = useState(null);

  // ── Напомняне — hour/minute inputs ───────────────────
  const reminderHour   = reminderTime ? reminderTime.split(':')[0] : '';
  const reminderMinute = reminderTime ? reminderTime.split(':')[1] : '';

  const setReminderHour = (h) => {
    if (h === '') { setReminderTime(null); return; }
    setReminderTime(`${h}:${reminderMinute || '00'}`);
  };
  const setReminderMinute = (m) => {
    setReminderTime(`${reminderHour || '00'}:${m}`);
  };
  const normalizeReminder = () => {
    if (!reminderTime) return;
    const [h, m] = reminderTime.split(':');
    const hh = String(Math.min(23, parseInt(h) || 0)).padStart(2, '0');
    const mm = String(Math.min(59, parseInt(m) || 0)).padStart(2, '0');
    setReminderTime(`${hh}:${mm}`);
  };

  // ── Подзадачи ────────────────────────────────────────
  const handleSubtasksCountChange = (val) => {
    const count = Math.max(0, parseInt(val) || 0);
    setSubtasksCount(count);
    const names = [...subtaskNames];
    while (names.length < count) names.push('');
    setSubtaskNames(names.slice(0, count));
  };

  const toggleComplexDay = (idx) => {
    setComplexDays(prev =>
      prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx]
    );
  };

  // ── Запазване ────────────────────────────────────────
  const buildObjects = () => {
    const habitId = habit?.id ?? generateId('habit');

    const newHabit = {
      id:           habitId,
      name:         name.trim(),
      color,
      isDefault,
      timesPerDay:  Math.max(1, parseInt(timesPerDay) || 1),
      subtasksCount: Math.max(0, parseInt(subtasksCount) || 0),
      subtaskNames,
      reminderTime: reminderTime || null,
      description:  description.trim() || null,
      createdAt:    habit?.createdAt ?? Date.now(),
      order:        habit?.order     ?? 999,
      manualOrder:  habit?.manualOrder ?? undefined,
    };

    const ruleChanged = ruleHasChanged(existingRule, {
      type: ruleType, simplePattern, customInterval,
      monthlyDay, yearlyMonth, yearlyDay, complexDays, startDate,
    });

    const newRule = {
      id:             ruleChanged ? generateId('rule') : existingRule.id,
      habitId,
      type:           ruleType,
      simplePattern:  ruleType === 'simple'  ? simplePattern  : null,
      customInterval: simplePattern === 'custom_interval' ? customInterval : null,
      monthlyDay:     simplePattern === 'monthly'         ? monthlyDay     : null,
      yearlyMonth:    simplePattern === 'yearly'          ? yearlyMonth    : null,
      yearlyDay:      simplePattern === 'yearly'          ? yearlyDay      : null,
      complexDays:    ruleType === 'complex' ? complexDays : [],
      startDate,
      isActive: true,
    };

    return { newHabit, newRule };
  };

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) { setError('Името е задължително'); return; }

    const duplicate = habits.some(h => h.name.toLowerCase() === trimmed.toLowerCase() && h.id !== habit?.id);
    if (duplicate) { setError(`Задача с име "${trimmed}" вече съществува`); return; }

    if (ruleType === 'complex' && complexDays.length === 0) {
      setError('Изберете поне един ден от седмицата'); return;
    }

    const { newHabit, newRule } = buildObjects();

    if (isEditing) {
      const changed = habitHasChanged(habit, existingRule, newHabit, newRule);
      if (!changed) { setError('Няма направени промени'); return; }

      // Питаме потребителя само ако правилото се е променило
      if (ruleHasChanged(existingRule, newRule)) {
        setPendingSave({ newHabit, newRule });
        setShowWarning(true);
        return;
      }
    }

    onSave(newHabit, newRule, true);
  };

  const confirmSave = (applyToAll) => {
    if (!pendingSave) return;
    const applyFromDate = applyToAll ? pendingSave.newRule.startDate : formatDate(new Date());
    onSave(pendingSave.newHabit, pendingSave.newRule, applyFromDate, !applyToAll);
    setShowWarning(false);
  };

  // ── Render ───────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-cyan-400 via-teal-300 to-emerald-300 bg-opacity-90 flex items-center justify-center p-4 z-50">
      <div className="bg-gradient-to-br from-blue-100 to-purple-100 rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">

          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-800">
              {isEditing ? 'Редактирай задача' : 'Нова задача'}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Бутони горе */}
          <div className="flex gap-3 mb-6">
            <button onClick={onClose} className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300">
              Откажи
            </button>
            <button onClick={handleSubmit} className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-semibold hover:shadow-lg">
              Запази
            </button>
          </div>

          {error && <p className="text-red-500 text-sm mb-4 font-semibold">{error}</p>}

          <div className="space-y-5">

            {/* Име */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Име на задачата</label>
              <input
                type="text"
                value={name}
                onChange={e => { setName(e.target.value); setError(''); }}
onFocus={e => e.target.select()}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-400 focus:outline-none"
                placeholder="Напр. Плуване"
autoFocus
              />
            </div>
            {/* Описание */}
<div>
  <label className="block text-sm font-semibold text-gray-700 mb-2">Описание (незадължително)</label>
  <textarea
    value={description}
    onChange={e => setDescription(e.target.value)}
    onFocus={e => e.target.select()}
    rows={3}
    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-400 focus:outline-none resize-none"
    placeholder="Напр. В колко часа има най-малко хора в басейна"
  />
</div>

            {/* От кога */}
            <DateInput
              value={startDate}
              onChange={setStartDate}
              label="От кога да започне правилото?"
            />

            {/* Пъти на ден */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Колко пъти на ден?</label>
              <input
                type="number" min="1"
                value={timesPerDay}
                onChange={e => setTimesPerDay(Math.max(1, parseInt(e.target.value) || 1))}
onFocus={e => e.target.select()}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-400 focus:outline-none"
              />
            </div>

            {/* Подзадачи */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Подзадачи (0 = без подзадачи)</label>
              <input
                type="number" min="0"
                value={subtasksCount}
                onChange={e => handleSubtasksCountChange(e.target.value)}
onFocus={e => e.target.select()}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-400 focus:outline-none"
              />
              {subtasksCount > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-gray-600">Имена на подзадачите (незадължително):</p>
                  {Array.from({ length: subtasksCount }, (_, i) => (
                    <input
                      key={i}
                      type="text"
                      value={subtaskNames[i] ?? ''}
                      onChange={e => {
                        const names = [...subtaskNames];
                        names[i] = e.target.value;
                        setSubtaskNames(names);
                      }}
                      placeholder={`Подзадача ${i + 1}`}
                      maxLength={50}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-indigo-400 focus:outline-none text-sm"
                    />
                  ))}
                  <p className="text-gray-400 text-xs">Ако оставиш празно, ще се номерира автоматично</p>
                </div>
              )}
            </div>

            {/* Напомняне */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">🔔 Напомняне (незадължително)</label>
              {reminderTime && (
                <button
                  onClick={() => setReminderTime(null)}
                  className="mb-2 px-3 py-1 text-sm bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                >
                  ✕ Премахни напомнянето
                </button>
              )}
              <div className="flex items-center gap-2 bg-white border-2 border-gray-200 rounded-xl px-3 py-3 focus-within:border-indigo-400">
                <input
                  type="text" inputMode="numeric"
                  value={reminderHour}
                  onChange={e => setReminderHour(e.target.value.replace(/\D/g,'').slice(0,2))}
onFocus={e => e.target.select()}
                  onBlur={normalizeReminder}
                  placeholder="чч" maxLength={2}
                  className="w-12 text-center bg-transparent border-none focus:outline-none font-semibold text-lg"
                />
                <span className="text-gray-400 font-semibold">:</span>
                <input
                  type="text" inputMode="numeric"
                  value={reminderMinute}
                  onChange={e => setReminderMinute(e.target.value.replace(/\D/g,'').slice(0,2))}
onFocus={e => e.target.select()}
                  onBlur={normalizeReminder}
                  placeholder="мм" maxLength={2}
                  className="w-12 text-center bg-transparent border-none focus:outline-none font-semibold text-lg"
                />
                <svg className="w-5 h-5 text-gray-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" strokeWidth="2"/>
                  <path strokeLinecap="round" strokeWidth="2" d="M12 6v6l4 2"/>
                </svg>
              </div>
              <p className="text-xs text-gray-500 mt-1">Ще получаваш напомняне в дните с планирана задача</p>
            </div>

            {/* По подразбиране */}
            <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-xl">
              <span className="text-sm font-semibold text-gray-700">Задай като основна</span>
              <button
                onClick={() => setIsDefault(p => !p)}
                className={`relative w-14 h-8 rounded-full transition-colors ${isDefault ? 'bg-gradient-to-r from-indigo-500 to-purple-500' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 ${isDefault ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>

            {/* Правило за повторение */}
            <div className="border-t-2 border-gray-200 pt-5">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Правило за повторение</h3>
              <div className="space-y-4 bg-gray-50 p-4 rounded-xl">

                {/* Еднократно */}
                <RadioOption value="today" current={ruleType === 'simple' && simplePattern === 'today'}
                  onChange={() => { setRuleType('simple'); setSimplePattern('today'); }} label="⭐ Еднократно" />

                {/* Всеки ден */}
                <RadioOption value="daily" current={ruleType === 'simple' && simplePattern === 'daily'}
                  onChange={() => { setRuleType('simple'); setSimplePattern('daily'); }} label="🌅 Всеки ден" />

                {/* През ден */}
                <RadioOption value="every_other_day" current={ruleType === 'simple' && simplePattern === 'every_other_day'}
                  onChange={() => { setRuleType('simple'); setSimplePattern('every_other_day'); }} label="📅 През ден" />

                {/* Персонализиран интервал */}
                <div>
                  <RadioOption value="custom_interval" current={ruleType === 'simple' && simplePattern === 'custom_interval'}
                    onChange={() => { setRuleType('simple'); setSimplePattern('custom_interval'); }} label="⚙️ Персонализиран интервал" />
                  <div className="ml-6 mt-2">
                    <label className="block text-xs text-gray-600 mb-1">На всеки X дни</label>
                    <input type="number" value={customInterval} min="1" max="9999"
                      onChange={e => setCustomInterval(Math.max(1, parseInt(e.target.value) || 1))}
onFocus={e => e.target.select()}
                      disabled={!(ruleType === 'simple' && simplePattern === 'custom_interval')}
                      className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-400 focus:outline-none disabled:bg-gray-100 disabled:text-gray-400"
                    />
                  </div>
                </div>

                {/* Конкретни дни от седмицата */}
                <div>
                  <RadioOption value="complex" current={ruleType === 'complex'}
                    onChange={() => setRuleType('complex')} label="🗓️ Конкретни дни от седмицата" />
                  <div className="ml-6 flex gap-2 flex-wrap mt-2">
                    {WEEKDAY_NAMES_BG.map((day, idx) => (
                      <button
                        key={idx}
                        onClick={() => { setRuleType('complex'); toggleComplexDay(idx); }}
                        disabled={ruleType !== 'complex'}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                          complexDays.includes(idx) && ruleType === 'complex'
                            ? 'text-white shadow-md scale-105'
                            : 'bg-white text-gray-600 hover:bg-gray-100'
                        } ${ruleType !== 'complex' ? 'opacity-50 cursor-not-allowed' : ''}`}
                        style={complexDays.includes(idx) && ruleType === 'complex' ? { backgroundColor: WEEKDAY_COLORS[idx] } : {}}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Всеки месец */}
                <div>
                  <RadioOption value="monthly" current={ruleType === 'simple' && simplePattern === 'monthly'}
                    onChange={() => { setRuleType('simple'); setSimplePattern('monthly'); }} label="📆 Всеки месец" />
                  <div className="ml-6 mt-2">
                    <label className="block text-xs text-gray-600 mb-1">На кое число?</label>
                    <input type="number" value={monthlyDay} min="1" max="31"
                      onChange={e => setMonthlyDay(Math.max(1, Math.min(31, parseInt(e.target.value) || 1)))}
onFocus={e => e.target.select()}
                      disabled={!(ruleType === 'simple' && simplePattern === 'monthly')}
                      className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-400 focus:outline-none disabled:bg-gray-100 disabled:text-gray-400"
                    />
                    <p className="text-xs text-gray-500 mt-1">* За месеци с по-малко дни се използва последният наличен ден</p>
                  </div>
                </div>

                {/* Всяка година */}
                <div>
                  <RadioOption value="yearly" current={ruleType === 'simple' && simplePattern === 'yearly'}
                    onChange={() => { setRuleType('simple'); setSimplePattern('yearly'); }} label="🗓️ Всяка година" />
                  <div className="ml-6 mt-2 space-y-2">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Месец:</label>
                      <select value={yearlyMonth} onChange={e => setYearlyMonth(parseInt(e.target.value))}
                        disabled={!(ruleType === 'simple' && simplePattern === 'yearly')}
                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-400 focus:outline-none disabled:bg-gray-100 disabled:text-gray-400"
                      >
                        {['Януари','Февруари','Март','Април','Май','Юни','Юли','Август','Септември','Октомври','Ноември','Декември'].map((m,i) => (
                          <option key={i} value={i}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Ден:</label>
                      <input type="number" value={yearlyDay} min="1" max="31"
                        onChange={e => setYearlyDay(Math.max(1, Math.min(31, parseInt(e.target.value) || 1)))}
onFocus={e => e.target.select()}
                        disabled={!(ruleType === 'simple' && simplePattern === 'yearly')}
                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-400 focus:outline-none disabled:bg-gray-100 disabled:text-gray-400"
                      />
                      <p className="text-xs text-gray-500 mt-1">* За 29 февр. в невисокосни години се използва 28 февр.</p>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Предупредителен модал при редакция */}
      {showWarning && (
        <div className="fixed inset-0 bg-gradient-to-br from-cyan-400 via-teal-300 to-emerald-300 bg-opacity-90 flex items-center justify-center p-4 z-[60]">
          <div className="bg-gradient-to-br from-orange-100 to-red-100 rounded-3xl shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">⚠️ Промяна на правило</h2>
              <button onClick={() => setShowWarning(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <p className="text-gray-700 mb-6 text-center font-medium">
              Промените в правилото ще засегнат задачите. Какво да направим с минали дати?
            </p>
            <div className="space-y-3">
              <button
                onClick={() => confirmSave(true)}
                className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-bold hover:shadow-lg"
              >
                ✓ Приложи за всички дати (от началото на правилото)
              </button>
              <button
                onClick={() => confirmSave(false)}
                className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-semibold hover:shadow-lg"
              >
                ✓ Приложи само за бъдещи дати
              </button>
              <button
                onClick={() => setShowWarning(false)}
                className="w-full py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300"
              >
                Откажи
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Малък helper компонент за radio бутон
function RadioOption({ current, onChange, label }) {
  return (
    <label className="flex items-center gap-2 p-3 bg-white rounded-lg cursor-pointer hover:bg-indigo-50">
      <input type="radio" checked={current} onChange={onChange} className="w-4 h-4 accent-indigo-500" />
      <span className="font-medium">{label}</span>
    </label>
  );
}
