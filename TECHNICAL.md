# TECHNICAL.md — Техническо описание на проекта „Моите задачи“

> Този документ описва само това, което реално се вижда в кода в тази папка
> (`C:\Users\Dell\Downloads\Projects AI\Tasks20260901`). Няма предположения за
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
| Съхранение на данни | **IndexedDB** (една база `habitTrackerDB`, един store `appData`); данните са разделени на **профили** — по ключ `profileData_<id>` за всеки, плюс `profilesMeta` за списъка и активния профил (виж раздел 3.5) | `src/utils/storage.js` |
| Нотификации | Web Notifications API | `src/hooks/useNotifications.js` |
| Линтер | ESLint 10 | `eslint.config.js` |

Няма бекенд, няма мрежови заявки за данни. Всичко живее локално в браузъра (IndexedDB).
Резервните копия са **per-profile** — ключове `backup_<profileId>_<timestamp>` (последните 5
за всеки профил), плюс ръчен export/import на `.json` файл (`src/utils/exportImport.js`).

---

## 2. Обща структура

```
src/
  main.jsx                     — входна точка, монтира <App/>
  App.jsx                      — държи ЦЯЛОТО състояние (data) и всички handler-и;
                                 навигация между 5-те екрана; auto-запис (debounce 1 сек,
                                 записва в АКТИВНИЯ профил); авто-генериране на задачи при
                                 старт / смяна на профил; дедупликация на задачи;
                                 handler-и за еднократни задачи (handleTodoSave/handleTodoDelete),
                                 чисти завършените todos при load/import;
                                 профили: state `profiles` + `activeProfileId`, `loadProfileInto`,
                                 `switchProfile`, handleProfileCreate/Rename/Delete (виж раздел 3.5)
  components/
    today/
      TodayScreen.jsx          — екран „Днес“. Един ОБЩ списък: навици + еднократни задачи,
                                 смесени и подредени заедно (`orderedRefs` — виж раздел 4.7).
                                 Държи `dayTodos` (филтър `todoBelongsHere` по `date` + пренасяне
                                 на просрочените), пренареждането (`moveItem` / drag) пише
                                 общия ред в `dayOrders[dateStr]`; анимацията + toast „Върни“
                                 при завършена еднократна задача; бутон „Създай еднократна
                                 задача“ под списъка
      TaskActions.jsx          — общата логика за отмятане на задача (completions / subtasks /
                                 просто „изпълнено“ / „пропусни“ / „нулирай“). Ползва се в
                                 „Днес“, календара и при еднократните задачи.
                                 Props `hideSkip` (крие „Пропусни“) и `onDelete` (бутон „Изтрий“).
      TodoRow.jsx              — един ред за еднократна задача в общия списък (форма като
                                 обикновените карти + жълт фон и етикет „ЕДНОКРАТНА“). Собствен
                                 прозорец за действия, редакция и инлайн 📝 бележка (клик извън
                                 полето записва). При пълно изпълнение вика `onComplete(snapshot)`,
                                 а TodayScreen пуска анимацията + toast
      TodoModal.jsx            — създаване / редакция на еднократна задача (име, описание,
                                 брой изпълнения, подзадачи, `date`) — без правило/напомняне/цвят
    habits/
      HabitsScreen.jsx         — списък със задачи (навици), пренареждане
      HabitModal.jsx           — създаване/редакция на задача + правило за повторение
      HabitCard.jsx            — картичка на задача в списъка (клик върху името отваря
                                 модала за редакция — същото като бутона ✏️)
      MissedScreen.jsx         — екран „Пропуснати и Отработени“ (два таба)
      ArchiveScreen.jsx        — архив (в SettingsModal)
    calendar/
      CalendarScreen.jsx       — месечен календар по избрана задача, цветове по състояние
      DayModal.jsx             — прозорец за един ден: отмятане, „наваксай на друга дата“,
                                 „свържи с отработен ден“, бележка
      MakeupPicker.jsx         — избор на дата за наваксване (makeup)
    statistics/StatisticsScreen.jsx — статистики / серии
    profiles/
      ProfileSwitcher.jsx     — модал за профили (икона в хедъра вляво): превключване,
                                създаване, преименуване (инлайн), изтриване (потвърждение;
                                бутонът е неактивен при 1 профил). Виж раздел 3.5
    settings/SettingsModal.jsx — backup/restore, import/export, архив, изтриване.
                                 Всичко важи за АКТИВНИЯ профил; при > 1 профил показва
                                 и „Свали / Изтрий ВСИЧКИ профили“
    ui/                        — дребни модали и контроли (Toast, Confirm, Alert, Delete, Help…)
      InstallPrompt.jsx        — банер „Инсталирай приложението“
      UpdatePrompt.jsx         — изскачащ прозорец „Налична е нова версия“ (виж раздел 8)
      SubtaskEditor.jsx        — редактор на подзадачи: „Добави подзадача“ (+ автофокус),
                                 ▲▼ пренареждане и ✕ премахване вдясно от полето (същият стил
                                 като бутоните в HabitCard). Ползва се в HabitModal и TodoModal
      SearchableSelect.jsx     — dropdown с вградено поле за търсене (филтрира по `includes`,
                                 нечувствително към регистър). Ползва се в CalendarScreen и
                                 StatisticsScreen за избор на задача
      DateInput.jsx            — въвеждане на дата дд/мм/гггг с `useRef` навигация между полетата
                                 (работи и с два DateInput на екрана); select при фокус;
                                 водеща нула при onBlur; валидира реална дата (година 1900–2100)
  hooks/
    useConfetti.js             — `fireConfetti` (стандартно, 2 сек) + `fireGoldenConfetti`
                                 (златно — дефинирано, но в момента неизползвано)
    useNotifications.js        — локални браузър-нотификации докато приложението е отворено:
                                 проверка на всяка минута; праща само ако `habit.reminderTime`
                                 == текущия HH:MM, има незавършена задача за деня; dedup чрез
                                 localStorage ключ `lastNotif_<habitId>_<date>` (мин. 60 сек между
                                 известия). Праща се през service worker `postMessage`, иначе
                                 директно `new Notification`. Няма push/сървър.
  utils/
    storage.js                — IndexedDB чети/пиши, backup-и
    dateUtils.js              — формат/сравнение на дати (всичко се нормализира до полунощ)
    ruleEngine.js             — доказва дали дадена ДАТА попада в дадено ПРАВИЛО
    taskGenerator.js          — генерира задачи за месец; маркира „пропуснати“; прилага смяна на правило
    habitUtils.js             — статус-помощници: isTaskCompleted / hasTaskProgress /
                                 getEffectiveStatus / getProgressText / createTaskObject / resetTaskProgress;
                                 за еднократни задачи: createTodoObject / buildTodoArrays / computeTodoStatus
    calendarStates.js         — превръща (дата, задача, правило) в едно от 14-те визуални състояния C1–C14
    constants.js              — цветове, суфикси за редни числа
    exportImport.js           — валидиране и сглобяване на .json export/import
```

### Навигация
`App.jsx` → `NAV_ITEMS`: `today`, `habits`, `calendar`, `statistics`, `missed`.
Единственото глобално състояние е в `App.jsx` (`data = { habits, tasks, rules, archivedHabits, todos }`
+ `dayOrders` — вече общ ред за навици и еднократни задачи). Всеки екран получава данните и callback-и надолу през props; промените
се вдигат нагоре и се записват в IndexedDB с 1-секунден debounce **в активния профил**.
Профилите (`profiles`, `activeProfileId`) също живеят в `App.jsx` — виж раздел 3.5.

---

## 3. Модел на данните

Данните на един профил са в един обект, записан под ключ `profileData_<profileId>` в
IndexedDB (историческо: до 2026-09-07 имаше един ключ `main` — виж раздел 3.5 и раздел 7):

```js
{
  habits: [ Habit, ... ],
  tasks:  [ Task,  ... ],
  rules:  [ Rule,  ... ],
  archivedHabits: [ { habit, rule, tasks, archivedAt }, ... ],
  todos:  [ Todo,  ... ],   // еднократни задачи (виж 3.4)
  dayOrders: { "YYYY-MM-DD": [id, id, ...] }   // ръчна подредба за деня — id може да е
                                              // habitId ИЛИ todoId (общ списък, виж 4.7)
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
  subtasksCount: number,        // ≥ 0. Ако > 0 → задачата има масив subtasks.
                                //   ВИНАГИ === subtaskNames.length — при запис се извежда
                                //   от SubtaskEditor, не се въвежда отделно.
  subtaskNames: string[],       // празен елемент "" се показва като „Подзадача N“
  reminderTime: "HH:MM" | null,  // за нотификации
  manualOrder?: number,

  // ── Неактивност (виж раздел 4.8) — по избор, обратно съвместими ──
  inactive?: boolean,            // цялата задача е неактивна (заключена, не се брои)
  inactiveCompletions?: number[],// индекси (1-базирани) на неактивни повторения
  inactiveSubtasks?: number[]    // индекси (1-базирани) на неактивни подзадачи
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

  completions: [ { index: 1, completed: bool, timestamp, inactive?: true } , ... ],  // само ако timesPerDay > 1
  subtasks:    [ { index: 1, name, completed: bool, timestamp, inactive?: true } , ... ], // само ако subtasksCount > 0

  makeupForDate:  "YYYY-MM-DD" | null,   // „този ден се наваксва на друга дата“
  makeupFromDate: "YYYY-MM-DD" | null,   // „този ден Е наваксване за друга (пропусната) дата“

  createdBy: "rule" | "manual",
  ruleId: "rule_..." | null,
  manuallyReset?: true,   // потребителят ръчно е нулирал → checkMissedTasks не го пипа
  habitInactive?: true,   // подпечатано от дефиницията: целият навик е неактивен (виж 4.8)
  note?: string,
  completedAt?: string
}
```

`inactive` на елемент от `completions`/`subtasks` и `habitInactive` на задачата се
**подпечатват от дефиницията на навика** (`habit.inactive` / `inactiveCompletions` /
`inactiveSubtasks`) при генериране (`createTaskObject`) и при превключване — само за
задачи с `date >= днес`. Миналото не се пипа. Виж раздел 4.8.

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
  subtasksCount: number,         // ≥ 0. ВИНАГИ === subtaskNames.length (изведено от SubtaskEditor)
  subtaskNames: string[],        // празен елемент "" се показва като „Подзадача N“
  completions: [ { index, completed, timestamp, inactive?: true }, ... ],  // само ако timesPerDay > 1
  subtasks:    [ { index, name, completed, timestamp, inactive?: true }, ... ], // само ако subtasksCount > 0
  status: "pending" | "partial" | "completed",
  inactive?: boolean,            // цялата еднократна задача е неактивна (виж 4.8)
  note: string,                  // бележка (инлайн 📝 на реда + поле в прозореца за действия)
  createdAt: number,             // Date.now()
  order: number,                 // за ръчно пренареждане; по подразбиране = createdAt.
                                 //   ▲▼ на реда разменят `order` между съседните видими todos.
                                 //   Стар запис без `order` пада обратно към createdAt при сортиране.
  date: "YYYY-MM-DD",            // денят, за който е задачата (по подразбиране деня при създаване)
  completedAt: string | null
}
```
- **Напълно независими** от `habits` / `rules` / `tasks`. Не влизат в календара,
  статистиката, „Пропуснати“ или архива.
- Живеят в `data.todos`, пазят се в същия IndexedDB запис, влизат в JSON export и backup-и.
- **Показват се в ОБЩИЯ списък на „Днес“** (не в отделна секция) — с жълт фон и етикет
  „ЕДНОКРАТНА“. Правило за видимост (`TodayScreen.todoBelongsHere`): показва се ако
  `todo.date === разглеждания ден`; **или** ако разглеждаш днес и `todo.date` е минал и
  задачата не е завършена („пренасяне“ на просрочените). Задача за бъдещ ден се вижда само
  на този ден. Стар запис без `date` се третира като „днес“ (fallback).
- `order` вече е само вторичен ключ (естествен ред преди ръчна подредба) — реалната
  подредба в „Днес“ е общата `dayOrders[dateStr]` (виж 4.7).
- Отмятането ползва същия `TaskActions` (с `hideSkip` — без „Пропусни“; и `onDelete`).
  „Нулирай задачата“ може да добави `manuallyReset: true` към todo обекта — без ефект.
- **Затваряне на прозореца за действия като при обикновените задачи:**
  `TodoRow.handleActionUpdate` — след **всяко** отмятане (едно изпълнение, една подзадача,
  „Отбележи като изпълнено“, „Нулирай задачата“) прозорецът се затваря след 300 ms
  (`setTimeout(() => setActionOpen(false), 300)`), точно както `TodayScreen.handleTaskUpdate`
  за навиците. Редът в „Днес“ се пре-рендва с новия прогрес (напр. „1/3“) или изчезва.
  При **пълно** изпълнение вместо това се минава по клона `onComplete(snapshot)` (анимация +
  toast „Върни“ — виж следващата точка). *(добавено 2026-09-07)*
- **Неактивност** (раздел 4.8) важи и тук: `todo.inactive` (цялата) + `inactive` на
  елементите. Превключва се от прозореца за действия (`TodoRow` пише директно чрез
  `onSave`) и от `TodoModal` (секция „Активност“). `computeTodoStatus` връща `pending`
  за неактивна еднократна задача, за да не се чисти при зареждане.
  „⏸ Направи неактивно“ оставя прозореца отворен; „▶ Върни активно“ го затваря след
  300 ms (виж 4.8, „Затваряне на прозореца за действия при това превключване“).
  `TodoRow` рендва модалите (`actionOpen`, `editing`) като братя на реда-`<div>` (в `<>…</>`),
  за да не наследят `opacity-75` на неактивния ред — иначе fixed прозорецът ставаше полупрозрачен.
- При пълно изпълнение: `TodoRow` вика `onComplete(snapshot)`; `TodayScreen` слага
  `completingTodoId` (редът остава видим ~1.15 s с `animate-todo-done`), после показва
  `Toast` „Изпълнена“ с бутон „Върни“ (5 s). „Върни“ → `onTodoSave(snapshot)` (връща
  състоянието отпреди отмятането); изтичане на toast-а → `onTodoDelete` (твърдо триене).
- Завършените todo записи се изчистват при следващо зареждане на приложението
  (`App.jsx`: `todos.filter(t => t.status !== 'completed')` при load и при import).
- Редакция (`TodoModal` в edit режим): `buildTodoArrays` преизгражда масивите, като пази
  наличните отметки; `computeTodoStatus` преизчислява статуса.
- **Бележка:** инлайн 📝 на реда (разгъва поле, записва при клик извън него — `mousedown`
  listener + `data-note-container`/`data-note-toggle`) **и** поле „📝 Бележка“ в прозореца
  за действия (`commitModalNote` записва при затваряне / „Редактирай“ / отмятане). И двете
  пишат `todo.note`.

### 3.5 Профили — виж `storage.js` + `App.jsx` + `components/profiles/ProfileSwitcher.jsx`

Един потребител, различни независими контексти (напр. „Личен“ / „Работа“). Без парола/PIN.

**IndexedDB ключове (store `appData`):**

| Ключ | Съдържание |
|------|-----------|
| `profilesMeta` | `{ activeId, profiles: [{ id, name, color, createdAt }] }` |
| `profileData_<id>` | обектът с данни от раздел 3 (habits/tasks/rules/archivedHabits/todos/dayOrders) |
| `backup_<id>_<ts>` | локално резервно копие на профил `<id>` (последните 5 на профил) |
| `main` | **стар** единствен запис — оставя се недокоснат след миграцията (fallback) |
| `backup_<ts>` | **стари** backup-и — оставят се; копирани веднъж към активния профил |

`id` = `p_<Date.now()>_<random>`. `color` се взима от `PROFILE_COLORS` (пръв свободен).

**Миграция (`storage.js` → `ensureInit` / `runInit`):** пуска се ТОЧНО веднъж за живота на
страницата (кеширан промис `initPromise` — иначе паралелните `loadProfilesMeta` +
`loadAppData` при монтиране се състезават и създават по няколко профила). Ако няма
`profilesMeta`: чете стария `main`, създава профил „Основен“ с неговото съдържание (или
празен), копира старите `backup_<ts>` към `backup_<новияId>_<ts>`, записва `profilesMeta`.
Старият `main` и старите backup-и **не се трият**.

**API на `storage.js`** (всички приемат по избор `profileId`, по подразбиране активния):
`loadProfilesMeta`, `setActiveProfile`, `createProfile`, `renameProfile`, `deleteProfile`
(не позволява 0 профила; трие данните + backup-ите на профила), `loadAppData`, `saveAppData`,
`clearAppData` (нулира данните, профилът остава), `resetAllProfiles` (трие всичко, оставя
един празен „Основен“), `loadAllProfilesExport` / `importAllProfiles` (виж раздел 10),
`saveBackup` / `listBackups` / `loadBackup`.

**`App.jsx`:**
- `loadProfileInto(id)` — `dataLoaded=false` → `setActiveProfile` → `loadAppData` → зарежда в
  state → `dataLoaded=true`. Ползва се от `switchProfile`, изтриване на активния профил,
  import на плик и „Изтрий всички профили“.
- `switchProfile(id)` — прекъсва висящия save-таймер, **записва текущия профил веднага**
  (`saveAppData(..., activeProfileId)`), после `loadProfileInto(id)`. Така недовършеният
  1-сек debounce не отива в грешния профил.
- Save-ефектът пази `profileId = activeProfileId` в момента на планиране и записва точно в
  него; докато `!dataLoaded` (по време на смяна) не записва нищо.
- Ефектът за авто-генериране/`checkMissedTasks` зависи от `[dataLoaded, activeProfileId]` —
  пуска се пак за новия профил.
- Хедърът има чип вляво (цветна точка + име) → отваря `ProfileSwitcher`.

**Изолация:** профилите не споделят нищо в IndexedDB. Habit id-тата са случайни, така че
`localStorage` ключовете за дедуп на нотификации (`lastNotif_<habitId>_<date>`) не се засичат
между профили. `notificationsDeclined` е глобален (по избор).

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
0. ако `task.habitInactive` ИЛИ `isEntirelyInactive(task)` (всичките под-елементи
   неактивни) → **не пипа** (неактивна задача не става „пропусната“); *(добавено 2026-09-07)*
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
| C15 | Неактивна задача (сиво, без рамка) — `habitInactive` или всички под-елементи неактивни, и денят още НЕ е завършен (завършен ден си остава C4/C9). Виж 4.8 |

За многократни задачи логиката тук брои коректно:
`done = completions.filter(c => c.completed).length`, `allDone = done === total`.
Неактивните `completions`/`subtasks` не се броят в `total`/`done` — виж 4.8.

### 4.4 Статус-помощници — `habitUtils.js`
- `isTaskCompleted(task)` — **проверява всички АКТИВНИ**: `completions.filter(c=>!c.inactive).every(...)`;
  ако всички completions са неактивни → пада към активните `subtasks`; инак `status === "completed"`.
  Ако няма нито едно активно нещо за правене → `false` (не се брои за завършена).
- `hasTaskProgress(task)` — има ли **поне едно активно** отметнато.
- `getEffectiveStatus(task)` — динамичен статус за визуализация
  (`completed` / `partial` / `missed` / `makeup` / `pending` / **`inactive`**), смятан от масивите.
  `inactive` се връща само ако задачата е неактивна И още не е завършена.
- `getProgressText(task)` — текст „2/3“ (числителят и знаменателят броят само активните).
- `hasActiveRequirements(task)` / `isEntirelyInactive(task)` — има ли активни под-елементи /
  напълно ли е неактивна (виж 4.8).
- `syncTaskInactivity(task, habit)` — пренася `habit.inactive` / `inactiveCompletions` /
  `inactiveSubtasks` върху `task.habitInactive` и `.inactive` на елементите.

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
- Props `hideSkip` (крие бутона „Пропусни“) и `onDelete` (показва „Изтрий задачата“) —
  ползват се от `TodoRow` за еднократните задачи; при обикновените задачи не се подават.
- Prop `onToggleInactive({ scope: 'task'|'completion'|'subtask', index })` — ако е подаден,
  показва контроли за „неактивно“ (заключени редове + „⏸ Направи неактивна“ /
  „▶ Върни активно“ / „⏸ Направи задачата неактивна“). Всички бутони за отмятане
  („Отбележи всички“, авто-преминаване към следващо completion) работят само с
  активните елементи. Виж раздел 4.8.
  Затваряне на прозореца при това превключване е в извикващия (`TodayScreen`/`TodoRow`):
  „⏸ Направи неактивно“ **оставя прозореца отворен** (надпис за четене), а „▶ Върни
  активно“ **го затваря** след 300 ms — като при отмятане (виж 4.8, „Затваряне на прозореца“).

### 4.8 Неактивност — „заключи, но остави видимо“

**Идея:** дадена задача, повторение или подзадача може да се маркира като
**неактивна** — вижда се в „Днес“, но е заключена (единственото действие е „▶ Върни
активно“), не се брои за завършване и не става „пропусната“ / не влиза в
статистиката. Пример: подзадача „лекарство Х“ става неактивна, докато го няма →
задачата „взимам лекарства“ пак може да се завърши без нея.

**Модел (източник на истината = дефиницията на навика):**
`habit.inactive` (цялата задача) · `habit.inactiveCompletions: number[]` ·
`habit.inactiveSubtasks: number[]` (1-базирани индекси). За еднократните задачи
флаговете живеят направо на `todo` (`todo.inactive` + `inactive` на елементите),
защото са за един ден.

**Подпечатване върху инстанциите:** `createTaskObject` и `syncTaskInactivity`
пренасят това върху `task.habitInactive` и `task.completions[i].inactive` /
`task.subtasks[i].inactive`, за да работят helper-ите без да им подаваме `habit`.

**Forward-only:** превключване от прозореца за действия (`TodayScreen` / `DayModal`)
вика `App.handleHabitInactivityChange(habitId, patch)`, който обновява дефиницията и
пре-подпечатва **само** задачите с `date >= днес`. Миналото остава непокътнато.
Редакцията през `HabitModal` също прилага неактивността само за днес и напред
(в reconcile клона на `handleHabitSave`).

**Ефекти:**
- `isTaskCompleted` / `getEffectiveStatus` / `getProgressText` / `computeTodoStatus`
  броят само активните елементи; „завърши всички“ пропуска неактивните.
- `checkMissedTasks` прескача `habitInactive` / напълно неактивни задачи (раздел 4.2).
- `calendarStates` → C15 „Неактивна“ (сиво, без рамка), но само ако денят още не е
  завършен — вече завършен ден си остава C4/C9.
- `TodayScreen`: неактивната задача е сива заключена карта с етикет „НЕАКТИВНА“;
  завършена задача с неактивен навик пак се скрива (не се показва).
- `StatisticsScreen`: дните с `habitInactive` / напълно неактивни се изключват от
  числител, знаменател, процент и поредица; ако целият навик е неактивен → показва
  „Задачата е неактивна“ вместо числата.
- `MissedScreen`: изключва `habitInactive` / напълно неактивни.
- `HabitCard`: показва „⏸ Неактивна“ или „⏸ Частично неактивна“.
- **Визуален индикатор = само цвят, без задраскване** *(2026-09-07)*: неактивните редове
  за повторение/подзадача в прозореца за действия (`TaskActions`) са сиви
  (`bg-gray-100` + `text-gray-500`); в секция „Активност“ на `HabitModal` / `TodoModal`
  избраните „неактивни“ са тъмно slate (`bg-slate-500 text-white`). Никъде няма
  `line-through` (той остава само за анимацията „при изпълнение“ и „Вече завършено“ в
  `MakeupPicker` — друго значение).

**Затваряне на прозореца за действия при това превключване** *(2026-09-07)*:
- „⏸ Направи неактивно“ (повторение / подзадача / цялата задача) — прозорецът
  **остава отворен**, за да се прочете надписът „Задачата е неактивна…“.
- „▶ Върни активно“ / „▶ Върни като активна“ — прозорецът **се затваря** след 300 ms
  и се връщаме на списъка, точно както при отмятане на задача.
- Реализация: `TodayScreen.handleToggleInactive` и `TodoRow.handleToggleInactive`
  смятат локален флаг `reactivating` (за навик: `scope:'task'` → `!!modalHabit.inactive`;
  `completion`/`subtask` → `cur.includes(index)`; за todo: `!!actionTodo.inactive` /
  `elem.inactive` **преди** превключването) и само при него викат
  `closeModal()` / `setActionOpen(false)` през `setTimeout(…, 300)`.

### 4.6 Смяна на правило — `applyRuleChange(...)`
Два режима: „само за бъдещи дати“ и „за всички дати“. И в двата: пазят се само
завършените задачи (`isTaskCompleted`), останалите минали pending/partial се
трият/презалагат, генерират се нови за новото правило, накрая `checkMissedTasks`.

### 4.7 Общ ред на „Днес“ (навици + еднократни) — `TodayScreen.jsx`
Екран „Днес“ показва навиците и еднократните задачи в **един списък**.

1. `dayTodos` = `todos`, филтрирани по `todoBelongsHere` (по `date` + пренасяне на
   просрочените), сортирани по `order ?? createdAt`.
2. `naturalRefs` = `[...sortedHabits, ...dayTodos]` като `{ kind, id }` (навици по
   `manualOrder`/азбука, после еднократни).
3. Ако има `dayOrders[dateStr]` → `orderedRefs` = `naturalRefs`, стабилно сортирани по
   `dayOrders[dateStr].indexOf(id)` (липсващ id → 999, tie-break = естественият ред).
   `dayOrders[dateStr]` съдържа смесени `habitId` и `todoId`.
4. `items` = `orderedRefs`, резолвнати към пълни обекти и филтрирани (скрити: завършени
   навици, липсващи задачи, наваксани дни, завършени еднократни освен по време на анимация).
5. `moveItem(id, dir)` / `handleDrop` разменят в `orderedRefs.map(r => r.id)` и записват
   целия ред в `dayOrders[dateStr]`. Изключено при активно търсене.

Изтрита еднократна задача може да остави „мъртъв“ id в `dayOrders` — безвреден, сортът
го игнорира (същото важи и за изтрити навици).

---

## 5. Екран „Пропуснати“ и логика за „надробяване“ (makeup days)

### 5.1 Екран „Пропуснати и Отработени“ — `MissedScreen.jsx`
Два таба: **„Пропуснати“** и **„Отработени (без връзка)“**, плюс филтър за период
(всички / тази седмица / този месец) и търсачка по име.

**Кои задачи влизат в таб „Пропуснати“** (`missedTasks`, ред ~28–56):
```
за всяка task t:
  1. ако t.status НЕ е 'missed' И НЕ е 'partial' → изключи
  1б. ако t.habitInactive ИЛИ isEntirelyInactive(t) → изключи (2026-09-07 — виж 4.8)
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

### 2026-09-07 — Екран „Задачи“: клик върху името на карта отваря редакцията

**Какво:** в `HabitsScreen` клик върху името на задача досега отваряше малък попъп само
с пълното име и бутон „Затвори“ (`showFullName` в `HabitCard`). Сега клик върху името
отваря директно модала за редакция — същото като бутона ✏️.

| Файл | Промяна |
|------|---------|
| `src/components/habits/HabitCard.jsx` | `onClick` на контейнера с името: `setShowFullName(true)` → `onEdit(habit)`; махнат `showFullName` state, попъпът за име и импортът на `useState`; `return` вече не е обвит в `<>…</>` (само `<div>`). `line-clamp-2` на `<h3>` остава — пълното име се вижда в input-а на модала. |

**Проверка:** `npm run build` минава. `npm run lint` — без нови грешки. Ръчно в браузър:
екран „Задачи“ → клик върху „Навик тест“ отваря „Редактирай задача“; „Откажи“ затваря.

### 2026-09-07 — Еднократни задачи: прозорецът за действия се затваря при всяко отмятане (+ „▶ Върни активно“; + плътен прозорец при неактивна; + неактивните повторения/подзадачи навсякъде без задраскване, само по цвят)

**Симптом:** при отмятане на нещо от еднократна задача (едно изпълнение от няколко,
една подзадача) прозорецът за действия оставаше отворен, тикчето стоеше и трябваше
ръчно да се затвори. При обикновените задачи прозорецът се затваря сам след всяко
действие и се връщаш на списъка „Днес“.

**Причина:** `TodoRow.handleActionUpdate` затваряше прозореца само в клона за **пълно**
завършване (`!wasCompleted && isTaskCompleted(merged)`); в противен случай само
`setActionTodo(merged)` — без затваряне. `TodayScreen.handleTaskUpdate` (за навиците)
винаги вика `setTimeout(() => setShowDayModal(false), 300)`.

**Поправка:**

| Файл | Промяна |
|------|---------|
| `src/components/today/TodoRow.jsx` | в `handleActionUpdate`, в `else` клона след `setActionTodo(merged)` — добавено `setTimeout(() => setActionOpen(false), 300)` (огледало на `TodayScreen.handleTaskUpdate`). В `handleToggleInactive` — ново локално `reactivating` (истина при ⏸→▶, т.е. връщане към активно): само тогава `setTimeout(() => setActionOpen(false), 300)` + прехвърля незаписаната бележка в `updated`. „⏸ Направи неактивно“ **не** затваря (има надпис за четене). |
| `src/components/today/TodayScreen.jsx` | `handleToggleInactive` — същото `reactivating` (за `scope: 'task'` = `!!modalHabit.inactive`; за `completion`/`subtask` = `cur.includes(index)`); при връщане към активно `setTimeout(() => closeModal(), 300)` (`closeModal` пази и бележката). |
| `src/components/ui/HelpModal.jsx` | точка „Изпълнения и подзадачи“ в секция „📝 Еднократни задачи“ — уточнено, че прозорецът се затваря сам след всяко отмятане; нова точка „Затваряне на прозореца“ в секция „⏸ Неактивни задачи…“. |
| `src/components/today/TodoRow.jsx` (2) | `return` вече е `<>…</>`: редът-`<div>` (който при неактивна задача получава `opacity-75`) и модалите (`actionOpen`, `editing`) са **братя**, не родител/дете. Иначе `opacity < 1` на реда се пренасяше и върху `position: fixed` прозореца → полупрозрачен, нечетлив. При навиците `DayModal` така или иначе се рендва на ниво `TodayScreen`, извън реда. |
| `src/components/today/TaskActions.jsx` | махнат `line-through` от неактивните редове за **повторение** и **подзадача** в прозореца за действия — вече само сив текст (`text-gray-500`), както при неактивната задача, без задраскване. |
| `src/components/today/TodoModal.jsx`, `src/components/habits/HabitModal.jsx` | секция „Активност“ — махнат `line-through` от избраните „неактивни“ чипове за повторение (`bg-slate-500 text-white`) и от името на неактивна подзадача. Различният цвят (тъмно slate ↔ бяло) остава единственият индикатор. |

**Ефект:** отмятане на изпълнение / подзадача / „изпълнено“ / „нулирай“ → прозорецът се
затваря след 300 ms → списъкът „Днес“ показва новия прогрес (или задачата изчезва).
„⏸ Направи неактивно“ (повторение / подзадача / цялата задача) оставя прозореца отворен;
„▶ Върни активно“ / „▶ Върни като активна“ го затваря след 300 ms. Клонът за пълно
изпълнение (анимация „изчезва“ + toast „Върни“ + конфети) е непроменен. Прозорецът за
действия на **неактивна** еднократна задача вече е плътен (както при навиците), а не
полупрозрачен. Неактивните редове за повторение / подзадача **навсякъде** (прозорецът за
действия + секция „Активност“ в `HabitModal` / `TodoModal`) вече се различават само по
цвят — без задраскване. (`line-through` остава само за анимацията „при изпълнение“ и за
„Вече завършено“ в `MakeupPicker` — там значи друго.)

**Проверка:** `npm run build` минава. `npm run lint` — без нови грешки (само отпреди
съществуващите в други файлове). Ръчно в браузър: еднократна задача „3 пъти“ — отмятане
на 1 път затваря прозореца и редът става „1/3 · В процес“; „Отбележи като изпълнено“
пуска конфети, затваря прозореца и маха реда; „⏸“ на подзадача оставя прозореца отворен,
„▶“ го затваря — проверено и за еднократна задача, и за навик (през `DayModal` в „Днес“),
вкл. цяла задача неактивна → надписът се вижда, „▶ Върни като активна“ затваря.
Прозорецът на неактивна еднократна задача е плътен (проверено визуално).

### 2026-09-07 — Неактивност (задача / повторение / подзадача)

**Какво:** задача, отделно повторение или подзадача може да се маркира като
**неактивна** — вижда се в „Днес“, но е заключена, не се брои за завършване и не
става „пропусната“ / извън статистиката. Реверсивно („▶ Върни активно“). Важи и за
еднократните задачи. Пълно описание — раздел 4.8.

**Подход:** източник на истината е дефиницията на навика (`habit.inactive` /
`inactiveCompletions` / `inactiveSubtasks`); подпечатва се върху task инстанциите
(`task.habitInactive` + `inactive` на елементите) чрез `syncTaskInactivity`, за да
работят наличните helper-и без промяна на сигнатурите им. Превключването важи само
за днес и напред — миналото не се пипа.

| Файл | Промяна |
|------|---------|
| `src/utils/habitUtils.js` | нови `syncTaskInactivity`, `hasActiveRequirements`, `isEntirelyInactive`; `isTaskCompleted` / `hasTaskProgress` / `getProgressText` / `getEffectiveStatus` / `computeTodoStatus` броят само активните елементи; `getEffectiveStatus` връща и `'inactive'`; `createTaskObject` подпечатва от дефиницията; `buildTodoArrays` пази `inactive` при редакция |
| `src/utils/taskGenerator.js` | `checkMissedTasks` прескача `habitInactive` / напълно неактивни задачи |
| `src/utils/calendarStates.js` | ново състояние **C15** „Неактивна“ (сиво, без рамка); завършен ден си остава C4/C9 |
| `src/App.jsx` | нов `handleHabitInactivityChange(habitId, patch)` (forward-only пач); подава се към `TodayScreen` и `CalendarScreen`; `handleHabitSave` reconcile клон вика `syncTaskInactivity` само за `date >= днес`; `isTaskMeaningful` разпознава неактивните флагове |
| `src/components/today/TaskActions.jsx` | нов prop `onToggleInactive`; заключени редове + бутони „⏸/▶“; изглед „цялата задача е неактивна“; „завърши всички“ / авто-преминаване работят само с активните |
| `src/components/today/TodayScreen.jsx` | сива заключена карта + етикет „НЕАКТИВНА“; `handleToggleInactive`; живи `modalHabit`/`modalTask` за отворения прозорец |
| `src/components/today/TodoRow.jsx` | заключен изглед за неактивна еднократна задача; `onToggleInactive` пише директно чрез `onSave` |
| `src/components/today/TodoModal.jsx` | секция „Активност“ (превключвател + списъци за повторения/подзадачи) |
| `src/components/habits/HabitModal.jsx` | секция „Активност“; `buildObjects` + `habitHasChanged` за новите полета |
| `src/components/calendar/CalendarScreen.jsx`, `DayModal.jsx` | подават/ползват `onHabitInactivityChange`; `TaskActions` получава `onToggleInactive` |
| `src/components/statistics/StatisticsScreen.jsx` | изключва неактивните дни от всички метрики; „Задачата е неактивна“ при `habit.inactive` |
| `src/components/habits/MissedScreen.jsx` | изключва `habitInactive` / напълно неактивни |
| `src/components/habits/HabitCard.jsx` | етикет „⏸ Неактивна“ / „⏸ Частично неактивна“ |
| `src/components/ui/HelpModal.jsx` | нова секция „⏸ Неактивни задачи, повторения и подзадачи“ |

**Проверка:** `npm run build` минава. `npm run lint` — без нови грешки (само отпреди
съществуващите). Ръчно в браузър: неактивна подзадача (задачата се завършва без нея,
брои „0/2“), цяла задача неактивна (сива карта + C15 в календара, реактивиране от
`DayModal`), еднократна задача с неактивна подзадача (завършва без нея), завършен ден
преди деактивиране си остава зелен.

### 2026-09-07 — Профили (различни независими контексти)

**Какво:** нова възможност за няколко профила на един потребител (напр. „Личен“ /
„Работа“) — всеки със собствени задачи, календар, статистика и резервни копия. Без
парола/PIN. Превключване от чип в хедъра вляво.

**Подход:** промяната е само в слоя „зареждане/запис“ — екраните не се пипат, защото
цялото състояние вече минаваше през `App.jsx` + props. Данните на всеки профил са под
отделен IndexedDB ключ `profileData_<id>`; списъкът и активният профил — под `profilesMeta`.
Пълен модел — виж раздел 3.5; формати за export/import — раздел 10.

| Файл | Промяна |
|------|---------|
| `src/utils/storage.js` | пренаписан: `profilesMeta` + `profileData_<id>` + `backup_<id>_<ts>`; кеширани `getDB()` и `ensureInit()` (миграция веднъж); ново API — `loadProfilesMeta`, `setActiveProfile`, `createProfile`, `renameProfile`, `deleteProfile`, `clearAppData(profileId)`, `resetAllProfiles`, `loadAllProfilesExport`, `importAllProfiles`; `loadAppData`/`saveAppData`/`saveBackup`/`listBackups` приемат `profileId` |
| `src/components/profiles/ProfileSwitcher.jsx` | **нов** — модал за профили: превключване, „Нов профил“, инлайн преименуване, изтриване с потвърждение (неактивно при 1 профил) |
| `src/App.jsx` | state `profiles` + `activeProfileId`; `loadProfileInto`, `switchProfile` (flush на текущия преди смяна), `handleProfileCreate/Rename/Delete`; save-ефектът и ефектът за генериране вече зависят от `activeProfileId`; `handleClearAll(scope)` и `handleDataImport` (плосък файл → активния профил; плик → всички); чип за профил в хедъра |
| `src/utils/exportImport.js` | `isMultiProfileExport`; `validateAppData` приема и плика с всички профили (валидира всеки `profiles[i].data`) |
| `src/components/settings/SettingsModal.jsx` | показва активния профил; backup-ите и export/clear са per-profile; при > 1 профил — и „Свали / Изтрий ВСИЧКИ профили“ |
| `src/components/ui/HelpModal.jsx` | нова секция „👤 Профили“ |

**Миграция:** при първо зареждане без `profilesMeta` старият единствен запис `main` се
пренася в профил „Основен“, старите backup-и се копират към него. Старият `main` и
старите backup-и **не се трият** (fallback). Пуска се точно веднъж (кеширан промис —
иначе паралелните заявки при монтиране създаваха дублирани профили).

**Проверка:** `npm run build` минава. `npm run lint` — без нови предупреждения (само
отпреди съществуващите в други файлове). Ръчно изпитано в браузър: миграция от `main`,
чиста нова инсталация, създаване/преименуване/изтриване на профил, превключване +
изолация на данните, презареждане (пази активния профил), per-profile backup списък,
export на един профил (плосък) и на всички (плик).

### 2026-09-07 — Еднократните задачи слети в общия списък на „Днес“

Премахната е отделната секция за еднократни задачи — вече са част от общия списък
с навиците и се пренареждат заедно с тях.

| Файл | Промяна |
|------|---------|
| `src/components/today/TodoList.jsx` | **изтрит** — логиката се разпределя между `TodayScreen` и новия `TodoRow` |
| `src/components/today/TodoRow.jsx` | **нов** — един ред за еднократна задача (жълт фон + етикет „ЕДНОКРАТНА“) + собствен прозорец за действия / редакция / инлайн бележка. При завършване вика `onComplete(snapshot)` |
| `src/components/today/TodayScreen.jsx` | строи общ ред `orderedRefs` (навици + `dayTodos`), рендва `TodoRow` или картата на навика; `moveItem`/`handleDrop` пишат смесен `dayOrders[dateStr]`; държи `completingTodoId` + `undoTodo` (`Toast`); бутон „Създай еднократна задача“ под списъка. Виж раздел 4.7 |
| `dayOrders` | стойността вече е списък от `habitId` **и** `todoId` |

**Бележки:**
- Еднократните задачи имат дискретен маркер (жълт фон + етикет), за да е ясно защо
  изчезват при отмятане.
- `todo.order` вече е само вторичен ключ — реалната подредба е `dayOrders[dateStr]`.
- Всеки ден пази отделна подредба (както при навиците). Просрочена еднократна задача,
  която „се пренася“ в „Днес“, се подрежда в `dayOrders` на днешния ден.

### 2026-09-06 — Еднократни задачи: пренареждане + бележка

Довеждане на еднократните задачи до паритет с обикновените в екран „Днес“.

| Файл | Промяна |
|------|---------|
| `src/utils/habitUtils.js` | `createTodoObject` добавя поле `order: Date.now()` |
| `src/components/today/TodoList.jsx` | всеки ред вече е `<div>` (не `<button>`) с контроли вдясно: **📝** (инлайн бележка), **▲▼** (пренареждане). `move()` разменя `order` между съседните видими todos; сортиране по `order ?? createdAt`. Инлайн бележката ползва същия модел като TodayScreen (`data-note-container` / `data-note-toggle` + `mousedown` listener, който записва при клик извън полето). Прозорецът за действия получи поле „📝 Бележка“; `commitModalNote` записва при затваряне / при „Редактирай“ / при отмятане |
| `src/components/ui/HelpModal.jsx` | точка за пренареждане и бележка при еднократните |

Стрелките са в стила на `HabitCard` (вдясно, `p-1.5`). При активно търсене пренареждането е изключено (както при другите списъци).

### 2026-09-06 — Нов редактор на подзадачи (SubtaskEditor)

**Какво:** махнато е полето „брой подзадачи“ в `HabitModal` и `TodoModal`. Вместо това
има бутон „Добави подзадача“, който добавя ред с поле и автоматично поставя курсора в
него. Всеки ред има ▲▼ за пренареждане и „✕“ за премахване. Enter в поле добавя следващ ред.

| Файл | Промяна |
|------|---------|
| `src/components/ui/SubtaskEditor.jsx` | **нов** — контролиран отвън чрез `names` / `onChange(string[])`; вътрешно държи `[{id,name}]` за стабилни ключове и автофокус |
| `src/components/habits/HabitModal.jsx` | махнати `subtasksCount` state + `handleSubtasksCountChange`; `buildObjects` слага `subtasksCount: subtaskNames.length`; рендва `<SubtaskEditor>` |
| `src/components/today/TodoModal.jsx` | същото — `count = subtaskNames.length` |
| `src/components/ui/HelpModal.jsx` | обновена точка „Подзадачи“ |

**Бележки:**
- `subtasksCount` вече е **производно** (`subtaskNames.length`) — не се въвежда отделно.
  Цялата логика надолу (`createTaskObject`, `buildTodoArrays`, реконсилирането в `App.jsx`,
  `calendarStates`) остава непроменена, защото за задачи, записани през модала,
  `subtaskNames.length === subtasksCount` винаги е било вярно.
- Празно име не се материализира при запис — остава `""` и се показва като „Подзадача N“
  чрез съществуващия fallback (`habit.subtaskNames?.[i] || 'Подзадача N'`).

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
| `src/utils/habitUtils.js` | нови: `createTodoObject` (с параметър `date`), `buildTodoArrays`, `computeTodoStatus`; импорт на `formatDate` |
| `src/App.jsx` | `todos` в state; `handleTodoSave` (upsert по id) / `handleTodoDelete`; чисти `completed` todos при load и import; включва `todos` в clear/import; подава props към `TodayScreen` |
| `src/components/today/TaskActions.jsx` | нови props `hideSkip` (крие „Пропусни“) и `onDelete` (бутон „Изтрий задачата“) — обратно съвместими |
| `src/components/today/TodayScreen.jsx` | рендва `<TodoList>` над списъка с повтарящи се задачи **за всеки ден**; подава `dateStr` + `isToday`; търсачката филтрира и todos |
| `src/components/today/TodoList.jsx` | **нов** — секцията (без заглавие), `belongsHere` филтър по `date` + пренасяне на просрочените, прозорец за действия (`TaskActions`), анимация при изпълнение + `Toast` „Върни“ |
| `src/components/today/TodoModal.jsx` | **нов** — създаване/редакция; приема `date` за деня на новата задача |
| `src/index.css` | нов keyframe `animate-todo-done` |
| `src/components/ui/HelpModal.jsx` | нова секция „📝 Еднократни задачи“ |

**Бележки:**
- Секцията няма заглавен надпис — само бутонът „Създай еднократна задача“ и списъкът.
- Всяка todo има `date` (денят при създаване). Показва се на своя ден; просрочените
  неотметнати се показват и в „Днес“. Задача за бъдещ ден — само на този ден.
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

---

## 9. Кой файл за коя промяна

| Промяна | Файлове |
|---------|---------|
| Модал за добавяне/редактиране на задача (навик) | `components/habits/HabitModal.jsx` |
| Картичка на задача в екран „Задачи“ | `components/habits/HabitCard.jsx` |
| Списък / подредба в екран „Задачи“ | `components/habits/HabitsScreen.jsx`, `HabitCard.jsx` |
| Екран „Днес“ | `components/today/TodayScreen.jsx` (и `App.jsx`, ако е свързано с `dayOrders`) |
| Завършване / пропускане / нулиране на задача | `components/today/TaskActions.jsx` |
| Неактивност (задача / повторение / подзадача; навици + еднократни) | `utils/habitUtils.js` (`syncTaskInactivity`, `isEntirelyInactive`, `hasActiveRequirements`), `App.jsx` (`handleHabitInactivityChange`), `components/today/TaskActions.jsx` (`onToggleInactive`), `HabitModal.jsx` / `TodoModal.jsx` (секция „Активност“), `TodayScreen.jsx` / `calendar/DayModal.jsx` (превключване от прозореца за действия), `utils/calendarStates.js` (C15), `utils/taskGenerator.js`, `StatisticsScreen.jsx`, `MissedScreen.jsx`, `HabitCard.jsx` — виж раздел 4.8 |
| Еднократни задачи — ред, действия, бележка, анимация | `components/today/TodoRow.jsx`, `TodoModal.jsx` (+ `utils/habitUtils.js`) |
| Общ списък/подредба на „Днес“ (навици + еднократни) | `components/today/TodayScreen.jsx` (`orderedRefs`, `moveItem`, `handleDrop`) + `App.jsx` (`dayOrders`) |
| Редактор на подзадачи (в двата модала) | `components/ui/SubtaskEditor.jsx` |
| Календар (изглед, цветове на дните) | `components/calendar/CalendarScreen.jsx`, `utils/calendarStates.js` |
| Модал при клик на ден в календара | `components/calendar/DayModal.jsx`, `today/TaskActions.jsx` |
| Picker за наваксване (makeup) | `components/calendar/MakeupPicker.jsx` (и `UnlinkedPicker` в `DayModal.jsx`) |
| Правило за повторение (логика) | `utils/ruleEngine.js`, `utils/taskGenerator.js` |
| Генериране на задачи за месец / смяна на правило | `utils/taskGenerator.js` |
| Екран „Пропуснати и Отработени“ | `components/habits/MissedScreen.jsx` |
| Архив (списък, връщане, изтриване) | `components/habits/ArchiveScreen.jsx` (рендва се в `SettingsModal.jsx`) |
| Статистика / серии | `components/statistics/StatisticsScreen.jsx` |
| Настройки / export / import / backup | `components/settings/SettingsModal.jsx`, `utils/exportImport.js`, `utils/storage.js` |
| Профили (превключване, CRUD, миграция) | `utils/storage.js`, `App.jsx`, `components/profiles/ProfileSwitcher.jsx` |
| Export/import на всички профили (плик) | `utils/storage.js` (`loadAllProfilesExport`/`importAllProfiles`), `utils/exportImport.js` (`isMultiProfileExport`, `validateAppData`), `components/settings/SettingsModal.jsx` |
| Поле за въвеждане на дата | `components/ui/DateInput.jsx` |
| Dropdown с търсене (Календар / Статистика) | `components/ui/SearchableSelect.jsx` |
| Инлайн търсене над списък (Задачи / Днес / Пропуснати) | съответния екран (`HabitsScreen` / `TodayScreen` / `MissedScreen`) |
| Главна навигация / глобално състояние | `App.jsx` |
| Помощно ръководство за потребителя | `components/ui/HelpModal.jsx` |
| Нотификации (планиране, dedup) | `hooks/useNotifications.js` |
| PWA / service worker / обновяване | `vite.config.js`, `public/sw.js`, `components/ui/UpdatePrompt.jsx` |

---

## 10. Export / import формати

Има два формата на `.json` файла (`utils/exportImport.js` ги различава):

### 10.1 Един профил (плосък — историческият формат)
```js
{ habits, tasks, rules, archivedHabits, todos, dayOrders }
```
- Създава се от „Свали този профил (JSON)“ (или „Свали backup“ при само 1 профил).
- При import **заменя данните на активния профил**. Старите файлове отпреди профилите
  се четат без промяна.
- `validateAppData` проверява масивите + типовете на ключовите полета.

### 10.2 Всички профили (плик)
```js
{
  schema: "tasks-multiprofile-v1",
  exportedAt: <ms>,
  activeId: "<id>",
  profiles: [ { id, name, color, createdAt, data: { habits, ... , dayOrders } }, ... ]
}
```
- Създава се от „Свали ВСИЧКИ профили (JSON)“ (видимо само при > 1 профил).
- При import **заменя целия набор профили** (`importAllProfiles` трие всички
  `profileData_*` / `backup_*` / `profilesMeta` и ги пресъздава от плика).
- `isMultiProfileExport(data)` = `data.schema === "tasks-multiprofile-v1" && Array.isArray(data.profiles)`.
- `validateAppData` валидира всеки `profiles[i].data` със същите проверки като 10.1.

Локалните backup-и (`saveBackup`) винаги пазят **плоския** формат (един профил) и се
възстановяват в активния профил.
