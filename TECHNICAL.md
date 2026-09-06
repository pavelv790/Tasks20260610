# TECHNICAL.md — Техническо описание на проекта „Моите задачи“

> Този документ описва само това, което реално се вижда в кода в тази папка
> (`C:\Users\Dell\Downloads\Projects AI\Tasks20260701`). Няма предположения за
> външни системи.

---

## 1. Технологии

| Слой | Какво се използва | Файл / доказателство |
|------|-------------------|----------------------|
| UI библиотека | **React 19** (функционални компоненти + hooks) | `package.json`, `src/main.jsx` |
| Бъндлър / dev сървър | **Vite 8** (`@vitejs/plugin-react`) | `package.json`, `vite.config.js` |
| Стилове | **Tailwind CSS 4** през `@tailwindcss/vite` | `package.json`, класове в `.jsx` |
| PWA | **vite-plugin-pwa** (service worker, manifest, offline), `registerType: 'prompt'` — обновяването иска потвърждение (виж раздел 8) | `vite.config.js`, `public/sw.js`, `dist/manifest.webmanifest` |
| Икони | **lucide-react** | навсякъде в компонентите |
| Ефект „конфети“ | **canvas-confetti** | `src/hooks/useConfetti.js` |
| Съхранение на данни | **IndexedDB** (една база `habitTrackerDB`, един store `appData`) | `src/utils/storage.js` |
| Нотификации | Web Notifications API | `src/hooks/useNotifications.js` |
| Линтер | ESLint 10 | `eslint.config.js` |

Няма бекенд, няма мрежови заявки за данни. Всичко живее локално в браузъра (IndexedDB).
Резервните копия също се пазят в същия IndexedDB store с ключове `backup_<timestamp>`
(последните 5), плюс ръчен export/import на `.json` файл (`src/utils/exportImport.js`).

---

## 2. Обща структура

```
src/
  main.jsx                     — входна точка, монтира <App/>
  App.jsx                      — държи ЦЯЛОТО състояние (data) и всички handler-и;
                                 навигация между 5-те екрана; auto-запис (debounce 1 сек);
                                 авто-генериране на задачи при старт; дедупликация на задачи
  components/
    today/
      TodayScreen.jsx          — екран „Днес“ (задачи за избран ден, drag&drop подредба, бележки)
      TaskActions.jsx          — общата логика за отмятане на задача (completions / subtasks /
                                 просто „изпълнено“ / „пропусни“ / „нулирай“). Ползва се в
                                 „Днес“, календара и при еднократните задачи.
                                 Props `hideSkip` (крие „Пропусни“) и `onDelete` (бутон „Изтрий“).
      TodoList.jsx             — секция „Еднократни задачи“ в „Днес“ (само за днешния ден):
                                 списък за отмятане, анимация при изпълнение + toast „Върни“
      TodoModal.jsx            — създаване / редакция на еднократна задача (име, описание,
                                 брой изпълнения, подзадачи) — без правило/напомняне/цвят
    habits/
      HabitsScreen.jsx         — списък със задачи (навици), пренареждане
      HabitModal.jsx           — създаване/редакция на задача + правило за повторение
      HabitCard.jsx            — картичка на задача в списъка
      MissedScreen.jsx         — екран „Пропуснати и Отработени“ (два таба)
      ArchiveScreen.jsx        — архив (в SettingsModal)
    calendar/
      CalendarScreen.jsx       — месечен календар по избрана задача, цветове по състояние
      DayModal.jsx             — прозорец за един ден: отмятане, „наваксай на друга дата“,
                                 „свържи с отработен ден“, бележка
      MakeupPicker.jsx         — избор на дата за наваксване (makeup)
    statistics/StatisticsScreen.jsx — статистики / серии
    settings/SettingsModal.jsx — backup/restore, import/export, архив, изтриване
    ui/                        — дребни модали и контроли (Toast, Confirm, DateInput, Help…)
      InstallPrompt.jsx        — банер „Инсталирай приложението“
      UpdatePrompt.jsx         — изскачащ прозорец „Налична е нова версия“ (виж раздел 8)
  hooks/
    useConfetti.js             — конфети при завършване
    useNotifications.js        — планира браузър-нотификации по reminderTime
  utils/
    storage.js                — IndexedDB чети/пиши, backup-и
    dateUtils.js              — формат/сравнение на дати (всичко се нормализира до полунощ)
    ruleEngine.js             — доказва дали дадена ДАТА попада в дадено ПРАВИЛО
    taskGenerator.js          — генерира задачи за месец; маркира „пропуснати“; прилага смяна на правило
    habitUtils.js             — статус-помощници: isTaskCompleted / hasTaskProgress /
                                 getEffectiveStatus / getProgressText / createTaskObject / resetTaskProgress
    calendarStates.js         — превръща (дата, задача, правило) в едно от 14-те визуални състояния C1–C14
    constants.js              — цветове, суфикси за редни числа
    exportImport.js           — валидиране и сглобяване на .json export/import
```

### Навигация
`App.jsx` → `NAV_ITEMS`: `today`, `habits`, `calendar`, `statistics`, `missed`.
Единственото глобално състояние е в `App.jsx` (`data = { habits, tasks, rules, archivedHabits }`
+ `dayOrders`). Всеки екран получава данните и callback-и надолу през props; промените
се вдигат нагоре и се записват в IndexedDB с 1-секунден debounce.

---

## 3. Модел на данните

Всичко е в един обект, записан под ключ `main` в IndexedDB:

```js
{
  habits: [ Habit, ... ],
  tasks:  [ Task,  ... ],
  rules:  [ Rule,  ... ],
  archivedHabits: [ { habit, rule, tasks, archivedAt }, ... ],
  todos:  [ Todo,  ... ],   // еднократни задачи (виж 3.4)
  dayOrders: { "YYYY-MM-DD": [habitId, habitId, ...] }   // ръчна подредба за конкретен ден
}
```

### 3.1 Habit (задача-навик) — виж `HabitModal.jsx`
```js
{
  id: "habit_...",
  name: string,
  description?: string,
  color: string,                 // hex от constants.COLORS
  isDefault: boolean,            // само една може да е „по подразбиране“
  timesPerDay: number,          // ≥ 1. Ако > 1 → задачата има масив completions
  subtasksCount: number,        // ≥ 0. Ако > 0 → задачата има масив subtasks
  subtaskNames: string[],
  reminderTime: "HH:MM" | null,  // за нотификации
  manualOrder?: number
}
```

### 3.2 Rule (правило за повторение) — виж `ruleEngine.js`
```js
{
  id: "rule_...",
  habitId: "habit_...",
  isActive: boolean,
  startDate: "YYYY-MM-DD",
  type: "simple" | "complex",

  // when type === "simple":
  simplePattern: "today" | "daily" | "every_other_day" | "custom_interval"
               | "monthly" | "yearly",
  customInterval?: number,       // за custom_interval — на всеки N дни
  monthlyDay?: number,           // за monthly — ден от месеца (клипва се към последния ден)
  yearlyMonth?: number, yearlyDay?: number,

  // when type === "complex":
  complexDays?: number[]         // дни от седмицата, 0=Пон … 6=Нед
}
```
`doesDateMatchRule(date, rule)` е единственият източник на истина „този ден влиза ли в правилото“.
Датите преди `startDate` и неактивните правила винаги връщат `false`.

### 3.3 Task (конкретна инстанция за един ден) — виж `habitUtils.createTaskObject`
```js
{
  id: "task_...",
  habitId: "habit_...",
  date: "YYYY-MM-DD",
  status: "pending" | "partial" | "completed" | "missed" | "makeup",

  completions: [ { index: 1, completed: bool, timestamp } , ... ],  // само ако timesPerDay > 1
  subtasks:    [ { index: 1, name, completed: bool, timestamp } , ... ], // само ако subtasksCount > 0

  makeupForDate:  "YYYY-MM-DD" | null,   // „този ден се наваксва на друга дата“
  makeupFromDate: "YYYY-MM-DD" | null,   // „този ден Е наваксване за друга (пропусната) дата“

  createdBy: "rule" | "manual",
  ruleId: "rule_..." | null,
  manuallyReset?: true,   // потребителят ръчно е нулирал → checkMissedTasks не го пипа
  note?: string,
  completedAt?: string
}
```

**Важно:** `status` е записан низ, но „истината“ за прогреса е в масивите
`completions` / `subtasks`. На много места UI-ът смята статуса динамично
(`getEffectiveStatus`, `calendarStates.js`), но не навсякъде — виж раздел 5.

### 3.4 Todo (еднократна задача) — виж `habitUtils.createTodoObject`
```js
{
  id: "todo_...",
  name: string,
  description: string | null,
  timesPerDay: number,           // ≥ 1
  subtasksCount: number,         // ≥ 0
  subtaskNames: string[],
  completions: [ { index, completed, timestamp }, ... ],  // само ако timesPerDay > 1
  subtasks:    [ { index, name, completed, timestamp }, ... ], // само ако subtasksCount > 0
  status: "pending" | "partial" | "completed",
  note: string,
  createdAt: number,             // Date.now()
  createdDate: "YYYY-MM-DD",     // само информативно (за сортиране); НЕ е насрочване
  completedAt: string | null
}
```
- **Напълно независими** от `habits` / `rules` / `tasks`. Не влизат в календара,
  статистиката, „Пропуснати“ или архива.
- Живеят в `data.todos`, пазят се в същия IndexedDB запис, влизат в JSON export и backup-и.
- Нямат дата → показват се в екран „Днес“ **само когато е избран днешният ден**
  (`isTodaySelected` в `TodayScreen`) и остават там всеки следващ ден, докато не бъдат
  отметнати или изтрити („пренасяне“).
- Отмятането ползва същия `TaskActions` (с `hideSkip` — без „Пропусни“; и `onDelete`).
- При пълно изпълнение: `status:"completed"`, конфети, ~1.15 s анимация „изчезва“
  (`animate-todo-done` в `index.css`), после `Toast` „Изпълнена“ с бутон „Върни“ (5 s).
  „Върни“ → връща snapshot-а отпреди последното отмятане (`onSave`); изтичане на toast-а
  или „✕“ → `onDelete` (твърдо триене).
- Завършените todo записи се изчистват при следващо зареждане на приложението
  (`App.jsx`: `todos.filter(t => t.status !== 'completed')` при load и при import).
- Редакция (`TodoModal` в edit режим): `buildTodoArrays` преизгражда масивите, като пази
  наличните отметки; `computeTodoStatus` преизчислява статуса.

---

## 4. Логика за повтарящи се задачи и статуси

### 4.1 Генериране на задачи
`taskGenerator.generateTasksForMonth(habit, rules, existing, year, month, allowPastDates)`:
за всеки ден от месеца, ако денят пасва на активно правило и още няма задача за
`habitId+date`, създава нова `Task` със `status:"pending"`.

Извиква се от:
- `App.jsx` при старт (за предходния, текущия и следващия месец);
- `TodayScreen.jsx` при смяна на избрания ден;
- `CalendarScreen.jsx` при смяна на месеца.

### 4.2 Маркиране на „пропуснати“ — `checkMissedTasks(tasks)`
Минава през всички задачи и за всяка:
1. ако `status` е вече `completed` или `missed` → **не пипа**;
2. ако `isTaskCompleted(task)` (всички completions/subtasks направени) →
   `status = "completed"` *(добавено при поправката от 2026-09-01 — виж раздел 7)*;
3. ако `manuallyReset` → не пипа;
4. ако `makeupFromDate` (това е makeup ден) → не пипа;
5. ако датата е днес или в бъдещето → не пипа;
6. иначе (минал ден, незавършена): ако има **поне едно** отметнато
   completion/subtask → `status = "partial"`, инак → `status = "missed"`.

> Стъпка 6 брои само „поне едно“. Стъпка 2 е тази, която затваря дупката за
> напълно завършена многократна задача — иначе `checkMissedTasks` не може да върне
> `status:"completed"` и „остарял“ `partial` остава замразен. Освен това
> `TaskActions.toggleCompletion` записва `completed` директно в момента на кликане.

### 4.3 Състояния за календара — `calendarStates.js` (C1–C14)
`getCalendarDayState(date, task, rule)` връща едно от:

| Код | Значение |
|-----|----------|
| C1  | Бъдещ ден от правилото, още без задача |
| C2  | Минал ден от правилото, пропуснат (червено) |
| C3  | Денят не е в правилото, няма задача |
| C4  | Завършен (обикновена задача) |
| C5  | Makeup ден, незавършен |
| C6  | Този ден се наваксва другаде (оранжево, заключено) |
| C7  | Makeup ден, завършен |
| C8  | Многократна задача, част от изпълненията направени (`done/total`) |
| C9  | Многократна задача, всички изпълнения направени |
| C10 | Подзадачи частично завършени |
| C11 | Makeup + част от изпълненията |
| C12 | Makeup + всички изпълнения |
| C13 | Makeup + подзадачи частично |
| C14 | Отработен ден „без връзка“ (ръчно, извън правилото) |

За многократни задачи логиката тук брои коректно:
`done = completions.filter(c => c.completed).length`, `allDone = done === total`.

### 4.4 Статус-помощници — `habitUtils.js`
- `isTaskCompleted(task)` — **проверява ВСИЧКИ**: `completions.every(c => c.completed)`;
  ако няма completions → `subtasks.every(...)`; инак `status === "completed"`.
- `hasTaskProgress(task)` — има ли **поне едно** отметнато.
- `getEffectiveStatus(task)` — динамичен статус за визуализация
  (`completed` / `partial` / `missed` / `makeup` / `pending`), смятан от масивите.
- `getProgressText(task)` — текст „2/3“.

### 4.5 Отмятане — `TaskActions.jsx`
- `toggleCompletion(index)` — обръща едно изпълнение; после
  `allDone = updated.every(c => c.completed)` →
  `status: allDone ? 'completed' : someDone ? 'partial' : 'pending'`.
- `toggleSubtask` / `completeAllSubtasks` — при задача, която има И completions:
  завършването на всички подзадачи отмята **едно** следващо completion и нулира
  подзадачите за следващото; `status` става `completed` само ако всички
  completions са направени.
- `markCompleted` / `markMissed` / `reset` — прости преходи; `reset` слага
  `manuallyReset: true`.

### 4.6 Смяна на правило — `applyRuleChange(...)`
Два режима: „само за бъдещи дати“ и „за всички дати“. И в двата: пазят се само
завършените задачи (`isTaskCompleted`), останалите минали pending/partial се
трият/презалагат, генерират се нови за новото правило, накрая `checkMissedTasks`.

---

## 5. Екран „Пропуснати“ и логика за „надробяване“ (makeup days)

### 5.1 Екран „Пропуснати и Отработени“ — `MissedScreen.jsx`
Два таба: **„Пропуснати“** и **„Отработени (без връзка)“**, плюс филтър за период
(всички / тази седмица / този месец) и търсачка по име.

**Кои задачи влизат в таб „Пропуснати“** (`missedTasks`, ред ~28–56):
```
за всяка task t:
  1. ако t.status НЕ е 'missed' И НЕ е 'partial' → изключи
  2. ако isTaskCompleted(t) → изключи   (добавено 2026-09-01 — виж раздел 7)
  3. ако t.makeupFromDate (t е makeup ден) → изключи
  4. ако t.makeupForDate: намери задачата на датата за наваксване;
     ако тя isTaskCompleted(...) → изключи
  5. ако t.date === днес и t.status !== 'missed' → изключи
  6. филтър по период
```
Стъпка 1 гледа само **записания низ `t.status`**. Стъпка 2 подсигурява екрана и
срещу „остарял“ `status` — ако всички completions/subtasks са отметнати,
задачата не се показва, независимо какво пише в `status`. Останалите екрани
(календар, „Днес“) и без това смятат статуса динамично.

**Таб „Отработени (без връзка)“** (`unlinkedTasks`): задачи с
`createdBy === 'manual'` и без makeup връзка.

Клик върху ред → отваря календара на тази дата за тази задача (`onNavigateToCalendar`).

### 5.2 „Надробяване“ / наваксване (makeup)
Идеята: пропуснат ден от правило може да бъде „наваксан“ на друг ден.

- В `DayModal` → бутон **„Наваксай на друга дата“** отваря `MakeupPicker`.
- `handleMakeupSelect(targetDate)`:
  - оригиналният ден получава `makeupForDate = targetStr` (и в календара става C6 —
    „наваксва се на …“, заключен);
  - целевият ден получава `makeupFromDate = <оригинала>` и `status = 'makeup'`
    (в календара C5/C7 — „Наваксва за …“).
- Прогресът вече се управлява от makeup деня (целевия), не от оригинала.
- **„Свържи с отработен ден“** (`UnlinkedPicker`): вместо нова дата, свързва
  пропуснатия ден със съществуващ ръчно отработен ден (`createdBy:'manual'`).
- Нулиране (`handleReset` в `DayModal`) разваля makeup връзките от двата края и
  връща оригинала на `missed`/`pending` според това дали е минал.

**Как makeup се отразява на „Пропуснати“:** оригиналният пропуснат ден изчезва от
списъка веднага (стъпка 2 или 3 на филтъра) щом получи `makeupForDate` и makeup
задачата е завършена. Ако makeup задачата НЕ е завършена, оригиналът пак се
показва (стъпка 3 не изключва).

---

## 6. Известни слаби места (към момента на този документ)

- ~~`MissedScreen` се доверява на записания `t.status`, не на `completions`.~~
  **Поправено 2026-09-01** — добавена е проверка `isTaskCompleted(t)` във филтъра
  (раздел 5.1, стъпка 2). Стъпка 1 все още гледа низа `status`, но напълно
  завършените задачи вече се изключват независимо от него.
- ~~`checkMissedTasks` е асиметрична — може да сложи `'partial'`/`'missed'`, но
  никога `'completed'`.~~ **Поправено 2026-09-01** — добавена е стъпка
  `if (isTaskCompleted(task)) return { ...task, status: 'completed' }` (раздел 4.2).
  Сега „остарял“ `partial` върху завършена задача се самопоправя при следващото
  преизчисляване (старт на приложението, разлистване на календара, запис на бележка).
- Възможни дублирани `Task` записи за един `habitId+date`; `dedupeTasksByHabitDate`
  пази първия „смислен“ по ред в масива → резултатът може да зависи от подредбата.
  *(още не е адресирано)*

---

## 7. История на поправките

### 2026-09-06 — Еднократни задачи (todos)

**Какво:** нова възможност за създаване на еднократни задачи („списък за отмятане“ за
деня), които изчезват след изпълнение. Създават се от екран „Днес“ с бутон
„Създай еднократна задача“.

**Подход:** отделна колекция `data.todos`, независима от `habits`/`rules`/`tasks` —
за да не влиза в календар, статистика, „Пропуснати“ и архив и да не се пипа сложната
rule логика. Пълен модел — виж раздел 3.4.

| Файл | Промяна |
|------|---------|
| `src/utils/storage.js` | `todos: []` в `EMPTY_DATA` и в мапинга при `loadAppData` |
| `src/utils/exportImport.js` | `validateAppData` валидира `todos` по избор (обратно съвместимо) |
| `src/utils/habitUtils.js` | нови: `createTodoObject`, `buildTodoArrays`, `computeTodoStatus`; импорт на `formatDate` |
| `src/App.jsx` | `todos` в state; `handleTodoSave` (upsert по id) / `handleTodoDelete`; чисти `completed` todos при load и import; включва `todos` в clear/import; подава props към `TodayScreen` |
| `src/components/today/TaskActions.jsx` | нови props `hideSkip` (крие „Пропусни“) и `onDelete` (бутон „Изтрий задачата“) — обратно съвместими |
| `src/components/today/TodayScreen.jsx` | рендва `<TodoList>` над списъка с повтарящи се задачи, само когато `isTodaySelected`; търсачката филтрира и todos |
| `src/components/today/TodoList.jsx` | **нов** — секцията, прозорецът за действия (`TaskActions`), анимация при изпълнение + `Toast` „Върни“ |
| `src/components/today/TodoModal.jsx` | **нов** — създаване/редакция |
| `src/index.css` | нов keyframe `animate-todo-done` |
| `src/components/ui/HelpModal.jsx` | нова секция „📝 Еднократни задачи“ |

**Бележки:**
- „Изтрий задачата“ при todo е без потвърждение (за разлика от навиците) — еднократната
  задача няма история за пазене.
- Undo прозорецът е 5 s; анимацията „изчезва“ ~1.15 s.

**Проверка:** `npm run build` минава. `npm run lint` — без нови предупреждения в
засегнатите файлове (остават само отпреди съществуващите в други файлове).

### 2026-09-01 — Многократна задача остава в „Пропуснати“ след пълно завършване

**Симптом:** задача с `timesPerDay > 1`; едното изпълнение отметнато, другото не →
задачата влиза в „Пропуснати“ (правилно). След като по-късно се отметне и второто
изпълнение, задачата продължава да се вижда в „Пропуснати“, макар че календарът я
показва като завършена. Понякога изобщо не се маха, понякога се маха — зависи от
това през кой път е минало завършването.

**Причина:** „свършена ли е задачата“ се пази на две места — низът `status` и
реалните отметки `completions`. Екран „Пропуснати“ филтрира само по низа `status`.
Низът се сменя на `"completed"` за многократна задача единствено в момента на
кликане в `TaskActions.toggleCompletion`. `checkMissedTasks` (вика се при старт,
при разлистване на календара, при запис на бележка) можеше да сваля статуса към
`"partial"`/`"missed"`, но никога да го вдига към `"completed"` → веднъж
„заседнал“ `partial` оставаше завинаги, а „Пропуснати“ продължаваше да показва
задачата.

**Поправка (2 промени, и двете ползват вече импортирания `isTaskCompleted`):**

| Файл | Промяна |
|------|---------|
| `src/components/habits/MissedScreen.jsx` (~ред 31) | Във филтъра на `missedTasks`, веднага след проверката за `t.status`, добавено `if (isTaskCompleted(t)) return false;` |
| `src/utils/taskGenerator.js` → `checkMissedTasks` (~ред 51) | Веднага след `if (['completed','missed'].includes(task.status)) return task;` добавено `if (isTaskCompleted(task)) return { ...task, status: 'completed' };` |

**Ефект:** напълно завършена задача повече не се показва в „Пропуснати“, а старите
счупени записи се самопоправят при първото следващо преизчисляване. Не се крият
реално частични или пропуснати задачи — `isTaskCompleted` връща `true` само когато
всяко completion/subtask е `completed: true`.

**Проверка:** `npm run build` минава. `npm run lint` показва само отпреди
съществуващи предупреждения (вкл. неизползвани импорти `isPastDate` /
`hasTaskProgress` в `taskGenerator.js`), несвързани с поправката.

### 2026-09-01 — Потвърждение преди обновяване на PWA

Досега `vite-plugin-pwa` беше с `registerType: 'autoUpdate'` — новата версия се
слагаше безшумно. По желание е добавен изскачащ прозорец за потвърждение.

| Файл | Промяна |
|------|---------|
| `vite.config.js` | `registerType: 'autoUpdate'` → `registerType: 'prompt'` |
| `src/components/ui/UpdatePrompt.jsx` | нов компонент — модал „Налична е нова версия“ с бутони „Обнови сега“ / „По-късно“; ползва `useRegisterSW` от `virtual:pwa-register/react`; на всеки час вика `registration.update()` докато приложението е отворено |
| `src/App.jsx` | импорт + `<UpdatePrompt />` до `<InstallPrompt />` |
| `src/components/ui/HelpModal.jsx` | нов ред „Обновяване“ в секцията „📲 Инсталиране като приложение“ |

Подробно поведение — виж раздел 8.

---

## 8. Обновяване на PWA (Vercel)

**Хостинг:** Vercel. Всеки `git push` към production клона задейства нов деплой;
чак тогава промените стигат до телефона (само `git commit` не прави нищо).
Локалната папка `dist/` е в git и се пресъздава с `npm run build` — не е нужно да
се качва ръчно, Vercel билдва сам.

**Поток на обновяване след деплой (с `registerType: 'prompt'`):**

1. При отваряне на приложението (с интернет) service worker-ът сверява `sw.js`
   със сървъра. Докато приложението стои отворено, `UpdatePrompt` допълнително
   проверява на всеки час.
2. Ако има нова версия, тя се тегли на заден план и се появява модалът
   **„Налична е нова версия“**.
3. **„Обнови сега“** → `updateServiceWorker(true)` активира новия service worker и
   презарежда страницата. **„По-късно“** (или Escape) → модалът се скрива и ще се
   появи пак при следващото засичане.
4. Данните (IndexedDB) не се влияят от обновяването.

**Първото обновяване след смяната от `autoUpdate` на `prompt`:** старият service
worker все още е с логиката „autoUpdate“, затова той ще инсталира новата версия
веднъж безшумно (както досега). Прозорецът за потвърждение важи от следващото
обновяване нататък.

**Ако телефонът „заседне“ на стара версия:** затвори приложението напълно (от
app switcher-а, особено на iPhone) и го отвори пак 1–2 пъти с интернет.
Краен вариант е деинсталиране/повторно инсталиране или изчистване на данните за
сайта — но първо направи JSON backup от „Настройки“, защото това трие IndexedDB.
