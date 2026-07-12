  import { useState, useEffect, useRef } from 'react';
  import { Calendar, BarChart3, Folder, Archive } from 'lucide-react';
  import { loadAppData, saveAppData, clearAppData } from './utils/storage';
  import { checkMissedTasks, generateTasksForMonth, applyRuleChange } from './utils/taskGenerator';
  import { generateId } from './utils/habitUtils';
  import { formatDate, toMidnight } from './utils/dateUtils';
  import { useNotifications } from './hooks/useNotifications';

  // Екрани — ще се попълват в следващите етапи
  import HabitsScreen     from './components/habits/HabitsScreen';
  import TodayScreen      from './components/today/TodayScreen';
  import CalendarScreen   from './components/calendar/CalendarScreen';
  import StatisticsScreen from './components/statistics/StatisticsScreen';
  import ArchiveScreen    from './components/habits/ArchiveScreen';
  import MissedScreen     from './components/habits/MissedScreen';
  import SettingsModal    from './components/settings/SettingsModal';
  import InstallPrompt    from './components/ui/InstallPrompt';
  import NotificationPermissionModal from './components/ui/NotificationPermissionModal';
  import AlertModal from './components/ui/AlertModal';

  // ─────────────────────────────────────────────────────────
  // Навигационни табове
  // ─────────────────────────────────────────────────────────
  const NAV_ITEMS = [
    { id: 'today',      label: 'Днес',       Icon: Calendar  },
    { id: 'habits',     label: 'Задачи',     Icon: Folder    },
    { id: 'calendar',   label: 'Календар',   Icon: Calendar  },
    { id: 'statistics', label: 'Статистика', Icon: BarChart3 },
    { id: 'missed',     label: 'Пропуснати\u00A0и Отработени', Icon: Archive   },
  ];

  // ─────────────────────────────────────────────────────────
  function App() {
    const [activeTab, setActiveTab] = useState('today');
    const [showSettings, setShowSettings] = useState(false);
    const [showNotificationModal, setShowNotificationModal] = useState(false);
    const [alert, setAlert] = useState(null); // { title, message }

    // ── Данни ────────────────────────────────────────────
    const [data, setData] = useState({
    habits: [], tasks: [], rules: [], archivedHabits: []
  });
  const [dataLoaded, setDataLoaded] = useState(false);
    const [dayOrders, setDayOrders] = useState({});
    const [dayOrdersLoaded, setDayOrdersLoaded] = useState(false);
    const [calendarTarget, setCalendarTarget] = useState(null); // { date, habitId }
    useEffect(() => {
      loadAppData().then(loaded => {
        const { dayOrders: loadedDayOrders, ...rest } = loaded;
        setData(rest);
        setDayOrders(loadedDayOrders ?? {});
        setDayOrdersLoaded(true);
        setDataLoaded(true);
      });
    }, []);

    // Нотификации
    useNotifications(data.habits, data.tasks);

    // Запазваме при всяка промяна (debounced — чака 1 сек след последната промяна)
    const saveTimerRef = useRef(null);
    useEffect(() => {
      if (!dataLoaded || !dayOrdersLoaded) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveAppData({ ...data, dayOrders });
      }, 1000);
      return () => clearTimeout(saveTimerRef.current);
    }, [data, dayOrders, dataLoaded, dayOrdersLoaded]);

    // Питаме за нотификации при първо зареждане
    useEffect(() => {
      if ('Notification' in window && Notification.permission === 'default') {
        const declined = localStorage.getItem('notificationsDeclined');
        if (!declined) {
          const t = setTimeout(() => setShowNotificationModal(true), 3000);
          return () => clearTimeout(t);
        }
      }
    }, []);

    // Автоматично генериране на задачи при стартиране
    useEffect(() => {
      if (!dataLoaded || data.habits.length === 0) return;

      const today = new Date();
      let newTasks = [];

      data.habits.forEach(habit => {
        const rules = data.rules.filter(r => r.habitId === habit.id && r.isActive);
        if (rules.length === 0) return;

        // Генерираме за текущия и следващия месец
        [-1, 0, 1].forEach(offset => {
          const d = new Date(today.getFullYear(), today.getMonth() + offset, 1);
          const generated = generateTasksForMonth(
            habit, rules, [...data.tasks, ...newTasks],
            d.getFullYear(), d.getMonth(), false
          );
          newTasks = [...newTasks, ...generated];
        });
      });

      if (newTasks.length > 0) {
        setData(prev => {
          const combined  = [...prev.tasks, ...newTasks];
          const withMissed = checkMissedTasks(combined);
          return { ...prev, tasks: withMissed };
        });
      } else {
        // Само проверяваме за пропуснати
        setData(prev => ({
          ...prev,
          tasks: checkMissedTasks(prev.tasks),
        }));
      }
    }, [dataLoaded]); // При зареждане на данните

    // ── Handlers ────────────────────────────────────────

    // Обновява задачи
    const handleTasksUpdate = (updatedTasks, fullReplace = false) => {
    setData(prev => {
      const noteMap = new Map(prev.tasks.filter(t => t.note).map(t => [t.id, t.note]));
      if (fullReplace) {
        const merged = updatedTasks.map(t => {
          if (t.note !== undefined) return t;
          const note = noteMap.get(t.id);
          return note ? { ...t, note } : t;
        });
        return { ...prev, tasks: merged };
      }
      const updatedMap = new Map(updatedTasks.map(t => [t.id, t]));
      const merged = prev.tasks.map(t => {
        const updated = updatedMap.get(t.id);
        if (!updated) return t;
        if (updated.note !== undefined) return updated;
        const note = noteMap.get(t.id);
        return note ? { ...updated, note } : updated;
      });
      const newTasks = updatedTasks.filter(t => !prev.tasks.some(p => p.id === t.id));
      return { ...prev, tasks: [...merged, ...newTasks] };
    });
  };

    const handleTaskNoteUpdate = (taskId, note) => {
      setData(prev => ({
        ...prev,
        tasks: prev.tasks.map(t => t.id === taskId ? { ...t, note } : t),
      }));
    };

    // Запазва задача + правило (нов или редактиран)
    const handleHabitSave = (habit, rule, applyToAll, futureOnly) => {
      setData(prev => {
        // Обновяваме или добавяме задача
        const habitExists = prev.habits.some(h => h.id === habit.id);
        const updatedHabits = habitExists
          ? prev.habits.map(h => h.id === habit.id ? habit : h)
          : [...prev.habits, habit];

        // Ако isDefault е true — изваждаме го от останалите
        const normalizedHabits = habit.isDefault
          ? updatedHabits.map(h => h.id === habit.id ? h : { ...h, isDefault: false })
          : updatedHabits;

        // Обновяваме правилата
        const oldRule = prev.rules.find(r => r.habitId === habit.id && r.isActive) ?? null;
        const filteredRules = prev.rules.filter(r => r.habitId !== habit.id);
        const updatedRules  = rule ? [...filteredRules, rule] : filteredRules;

        // Прилагаме промяната на правилото върху задачите само ако правилото се е сменило
        let updatedTasks = prev.tasks;
        if (rule) {
          const isExistingHabit = prev.habits.some(h => h.id === habit.id);
          if (!isExistingHabit) {
            // Нова задача — генерираме задачи от началото
            updatedTasks = applyRuleChange(prev.tasks, habit, rule, rule.startDate);
          } else if (typeof applyToAll === 'string') {
            // Редактиране с променено правило — applyToAll е дата string
            updatedTasks = applyRuleChange(prev.tasks, habit, rule, applyToAll, futureOnly, oldRule);
          } else {
            // Правилото не се е сменило — обновяваме completions/subtasks на съществуващите задачи
            updatedTasks = prev.tasks.map(task => {
              if (task.habitId !== habit.id) return task;

              // Обновяваме completions ако timesPerDay се е сменил
              let completions = task.completions ?? [];
              if (habit.timesPerDay > 1) {
                if (completions.length !== habit.timesPerDay) {
                  // Ако старата задача е completed но без completions масив (timesPerDay беше 1)
                  // — маркираме първото като завършено
                  const wasCompleted = task.status === 'completed' || (completions.length > 0 && completions[0]?.completed);
                  completions = Array.from({ length: habit.timesPerDay }, (_, i) => ({
                    index: i + 1,
                    completed: completions[i]?.completed ?? (i === 0 ? wasCompleted : false),
                    timestamp: completions[i]?.timestamp ?? null,
                  }));
                }
              } else {
                completions = [];
              }

              // Обновяваме subtasks ако subtasksCount се е сменил
              let subtasks = task.subtasks ?? [];
              if (habit.subtasksCount > 0) {
                if (subtasks.length !== habit.subtasksCount) {
                  subtasks = Array.from({ length: habit.subtasksCount }, (_, i) => ({
                    index: i + 1,
                    name: habit.subtaskNames?.[i] || `Подзадача ${i + 1}`,
                    completed: subtasks[i]?.completed ?? false,
                    timestamp: subtasks[i]?.timestamp ?? null,
                  }));
                } else {
                  // Само обновяваме имената
                  subtasks = subtasks.map((s, i) => ({
                    ...s,
                    name: habit.subtaskNames?.[i] || `Подзадача ${i + 1}`,
                  }));
                }
              } else {
                subtasks = [];
              }

              // Преизчисляваме статуса според новите completions/subtasks
              let newStatus = task.status;
              if (completions.length > 0) {
                const allDone = completions.every(c => c.completed);
                const someDone = completions.some(c => c.completed);
                newStatus = allDone ? 'completed' : someDone ? 'partial' : (task.status === 'missed' ? 'missed' : 'pending');
              } else if (subtasks.length > 0) {
                const allDone = subtasks.every(s => s.completed);
                const someDone = subtasks.some(s => s.completed);
                newStatus = allDone ? 'completed' : someDone ? 'partial' : (task.status === 'missed' ? 'missed' : 'pending');
              }

              return { ...task, completions, subtasks, status: newStatus };
            });
          }
        }

        return {
          ...prev,
          habits: normalizedHabits,
          rules:  updatedRules,
          tasks:  updatedTasks,
        };
      });

      
    };

    // Изтрива задача и всичките й задачи/правила
    const handleHabitDelete = (habitId) => {
      setData(prev => ({
        ...prev,
        habits: prev.habits.filter(h => h.id !== habitId),
        tasks:  prev.tasks.filter(t => t.habitId !== habitId),
        rules:  prev.rules.filter(r => r.habitId !== habitId),
      }));
    };

    // Архивира задача
    const handleHabitArchive = (habitId) => {
      setData(prev => {
        const habit = prev.habits.find(h => h.id === habitId);
        const rule  = prev.rules.find(r => r.habitId === habitId && r.isActive) ?? null;
        const tasks = prev.tasks.filter(t => t.habitId === habitId);

        if (!habit) return prev;

        const archived = {
          habit,
          rule,
          tasks,
          archivedAt: Date.now(),
        };

        return {
          ...prev,
          habits:         prev.habits.filter(h => h.id !== habitId),
          tasks:          prev.tasks.filter(t => t.habitId !== habitId),
          rules:          prev.rules.filter(r => r.habitId !== habitId),
          archivedHabits: [...prev.archivedHabits, archived],
        };
      });
    };

    // Разархивира задача
    const handleHabitUnarchive = (archivedAt) => {
      setData(prev => {
        const entry = prev.archivedHabits.find(a => a.archivedAt === archivedAt);
        if (!entry) return prev;

        // Даваме нов ID за да избегнем конфликти
        const newHabitId = generateId('habit');
        const habit = { ...entry.habit, id: newHabitId };
        const rule  = entry.rule  ? { ...entry.rule,  habitId: newHabitId, id: generateId('rule') } : null;
        const tasks = entry.tasks.map(t => ({ ...t, habitId: newHabitId, id: generateId('task') }));

        return {
          ...prev,
          habits:         [...prev.habits, habit],
          rules:          rule ? [...prev.rules, rule] : prev.rules,
          tasks:          [...prev.tasks, ...tasks],
          archivedHabits: prev.archivedHabits.filter(a => a.archivedAt !== archivedAt),
        };
      });
    };

    // Изтрива архивирана задача завинаги
    const handleArchivedDelete = (archivedAt) => {
      setData(prev => ({
        ...prev,
        archivedHabits: prev.archivedHabits.filter(a => a.archivedAt !== archivedAt),
      }));
    };

    // Обновява подредбата на задачите
    const handleHabitsReorder = (reorderedHabits) => {
      setData(prev => ({ ...prev, habits: reorderedHabits }));
    };

    // Изчиства всичко
    const handleClearAll = () => {
    setData({ habits: [], tasks: [], rules: [], archivedHabits: [] });
    clearAppData();
  };

    // Импортира данни
    const handleDataImport = (importedData) => {
      setData(importedData);
    };

    // Нотификации
    const handleAllowNotifications = () => {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          setAlert({ title: '✅ Напомнянията са активирани!', message: 'Ще получаваш напомняния в зададените часове.' });
        }
        setShowNotificationModal(false);
      });
    };

    const handleDeclineNotifications = () => {
      localStorage.setItem('notificationsDeclined', Date.now().toString());
      setShowNotificationModal(false);
    };

    // ── Render ──────────────────────────────────────────
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-cyan-400 via-teal-300 to-emerald-300">

        {/* Header */}
        <header className="bg-white shadow-lg rounded-b-3xl p-6 mb-4">
          <div className="flex justify-between items-center">
            <div className="flex-1" />
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 text-center">
              Моите задачи
            </h1>
            <div className="flex-1 flex justify-end">
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 rounded-xl bg-white hover:bg-gray-100 transition-all shadow-md"
                title="Настройки"
              >
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 px-4 pb-24 overflow-y-auto">
          <div className="max-w-md mx-auto">

            {!dataLoaded && (
              <div className="flex items-center justify-center py-20">
                <div className="text-gray-400 text-sm">Зареждане...</div>
              </div>
            )}

            {dataLoaded && activeTab === 'today' && (
              <TodayScreen
                habits={data.habits}
                tasks={data.tasks}
                rules={data.rules}
                onTasksUpdate={handleTasksUpdate}
                onTaskNoteUpdate={handleTaskNoteUpdate}
                onHabitsReorder={handleHabitsReorder}
                dayOrders={dayOrders}
                onDayOrdersChange={setDayOrders}
              />
            )}

            {dataLoaded && activeTab === 'habits' && (
              <HabitsScreen
                habits={data.habits}
                rules={data.rules}
                onSave={handleHabitSave}
                onDelete={handleHabitDelete}
                onArchive={handleHabitArchive}
                onReorder={handleHabitsReorder}
              />
            )}

            {dataLoaded && activeTab === 'calendar' && (
              <CalendarScreen
                habits={data.habits}
                tasks={data.tasks}
                rules={data.rules}
                onTasksUpdate={handleTasksUpdate}
                initialTarget={calendarTarget}
                onTargetConsumed={() => setCalendarTarget(null)}
              />
            )}

            {dataLoaded && activeTab === 'statistics' && (
              <StatisticsScreen
                habits={data.habits}
                tasks={data.tasks}
                rules={data.rules}
              />
            )}
            {dataLoaded && activeTab === 'missed' && (
              <MissedScreen
                habits={data.habits}
                tasks={data.tasks}
                onNavigateToCalendar={(date, habitId) => {
                  setCalendarTarget({ date, habitId });
                  setActiveTab('calendar');
                }}
              />
            )}

            
          </div>
        </main>

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white shadow-2xl rounded-t-3xl z-40">
          <div className="max-w-md mx-auto px-2 py-3">
            <div className="flex justify-around items-center">
              {NAV_ITEMS.map(({ id, label, Icon }) => {
                const isActive = activeTab === id;
                return (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={`flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all duration-300 transform ${
                      isActive
                        ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg scale-105'
                        : 'text-gray-500 hover:bg-gray-100 hover:scale-105'
                    }`}
                  >
                    <span className="text-xs font-semibold">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Modals */}
        {showSettings && (
          <SettingsModal
            data={data}
            onClose={() => setShowSettings(false)}
            onImport={handleDataImport}
            onClearAll={handleClearAll}
            onUnarchive={handleHabitUnarchive}
            onArchivedDelete={handleArchivedDelete}
          />
        )}

        {showNotificationModal && (
          <NotificationPermissionModal
            onAllow={handleAllowNotifications}
            onDecline={handleDeclineNotifications}
          />
        )}

        {alert && (
          <AlertModal
            title={alert.title}
            message={alert.message}
            onClose={() => setAlert(null)}
          />
        )}

        <InstallPrompt />
      </div>
    );
  }

  export default App;
