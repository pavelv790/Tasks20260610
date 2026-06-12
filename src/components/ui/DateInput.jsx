import { useState, useEffect, useRef } from 'react';
import { Calendar } from 'lucide-react';

// Компонент за въвеждане на дата: дд / мм / гггг
// Използва refs вместо document.getElementById — работи коректно
// дори когато има два DateInput на един екран едновременно.
export default function DateInput({ value, onChange, label, className = '' }) {
  const parse = (str) => {
    if (!str) return { day: '', month: '', year: '' };
    const [y, m, d] = str.split('-');
    return { day: d ?? '', month: m ?? '', year: y ?? '' };
  };

  const [fields, setFields] = useState(() => parse(value));
  const [error,  setError]  = useState('');

  const dayRef   = useRef(null);
  const monthRef = useRef(null);
  const yearRef  = useRef(null);

  useEffect(() => {
    setFields(parse(value));
  }, [value]);

  const validateAndSave = (day, month, year) => {
    if (!day && !month && !year) { setError(''); return; }
    if (!day || !month || !year) { setError(''); return; }

    const d = parseInt(day), m = parseInt(month), y = parseInt(year);

    if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) {
      setError('Невалидна дата'); return;
    }

    const date = new Date(y, m - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
      setError('Невалидна дата'); return;
    }

    setError('');
    onChange(`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`);
  };

  const focusAndSelect = (ref) => {
    setTimeout(() => { ref.current?.focus(); ref.current?.select(); }, 0);
  };

  const handleDayChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 2);
    setFields(p => ({ ...p, day: val }));
    if (val.length === 2 || val.length === 0) validateAndSave(val, fields.month, fields.year);
    if (val.length === 2) focusAndSelect(monthRef);
  };

  const handleMonthChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 2);
    setFields(p => ({ ...p, month: val }));
    if (val.length === 2 || val.length === 0) validateAndSave(fields.day, val, fields.year);
    if (val.length === 2) focusAndSelect(yearRef);
  };

  const handleYearChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
    setFields(p => ({ ...p, year: val }));
    validateAndSave(fields.day, fields.month, val);
  };

  const handleKeyDown = (e, prevRef) => {
    if (e.key === 'Backspace' && e.target.value === '' && prevRef) {
      prevRef.current?.focus();
      setTimeout(() => {
        const len = prevRef.current?.value.length ?? 0;
        prevRef.current?.setSelectionRange(len, len);
      }, 0);
    }
  };

  const handleFocus = (e) => setTimeout(() => e.target.select(), 0);
  const handleDayBlur = () => {
    const d = fields.day;
    if (d.length === 1 && parseInt(d) >= 1) {
      const padded = d.padStart(2, '0');
      setFields(p => ({ ...p, day: padded }));
      validateAndSave(padded, fields.month, fields.year);
    }
  };

  const handleMonthBlur = () => {
    const m = fields.month;
    if (m.length === 1 && parseInt(m) >= 1) {
      const padded = m.padStart(2, '0');
      setFields(p => ({ ...p, month: padded }));
      validateAndSave(fields.day, padded, fields.year);
    }
  };

  return (
    <div>
      {label && <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>}
      <div className={`flex items-center gap-2 bg-white border-2 ${
        error ? 'border-red-400' : 'border-gray-200'
      } rounded-xl px-3 py-3 focus-within:border-purple-400 ${className}`}>

        <input
          ref={dayRef}
          type="text" inputMode="numeric"
          value={fields.day}
          onChange={handleDayChange}
          onKeyDown={e => handleKeyDown(e, null)}
          onFocus={handleFocus}
          onBlur={handleDayBlur}
          placeholder="дд" maxLength={2}
          className="w-12 text-center bg-transparent border-none focus:outline-none font-semibold text-lg"
        />
        <span className="text-gray-400 font-semibold">/</span>

        <input
          ref={monthRef}
          type="text" inputMode="numeric"
          value={fields.month}
          onChange={handleMonthChange}
          onKeyDown={e => handleKeyDown(e, dayRef)}
          onFocus={handleFocus}
          onBlur={handleMonthBlur}
          placeholder="мм" maxLength={2}
          className="w-12 text-center bg-transparent border-none focus:outline-none font-semibold text-lg"
        />
        <span className="text-gray-400 font-semibold">/</span>

        <input
          ref={yearRef}
          type="text" inputMode="numeric"
          value={fields.year}
          onChange={handleYearChange}
          onKeyDown={e => handleKeyDown(e, monthRef)}
          onFocus={handleFocus}
          placeholder="гггг" maxLength={4}
          className="w-16 text-center bg-transparent border-none focus:outline-none font-semibold text-lg"
        />

        <Calendar className="w-5 h-5 text-gray-400 ml-auto" />
      </div>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}