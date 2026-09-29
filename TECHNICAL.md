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
| Звукови ефекти | Web Audio API (синтезирани тонове) + `<audio>` за качени от потребителя файлове; превключвател, обща сила и сила на всеки качен файл в „Настройки“, `localStorage` ключове `soundEnabled` / `soundVolume` / `customSoundVolumes` (виж раздел 7, 2026-09-20) | `src/utils/sounds.js` |
| Линтер | ESLint 10 | `eslint.config.js` |

Няма бекенд, няма мрежови заявки за данни. Всичко живее локално в браузъра (IndexedDB).
Резервните копия са **per-profile** — ключове `backup_<profileId>_<timestamp>` (последните 5
за всеки профил) и автоматичните `backup_<profileId>_auto_<timestamp>` (последните 3, отделно — виж раздел 7, 2026-09-29), плюс ръчен export/import на `.json` файл (`src/utils/exportImport.js`).

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
                                 задача“ под списъка. Прозорецът за действия на обикновена задача
                                 има същите наваксване/връзка бутони като `DayModal` в Календара
                                 (`handleMakeupSelect` / `handleUnlinkedSelect` / `handleModalReset`,
                                 огледални на `DayModal`-логиката — виж раздел 7, 2026-09-23);
                                 ползва `MakeupPicker` и `UnlinkedPicker` от `components/calendar/`.
      TaskActions.jsx          — общата логика за отмятане на задача (completions / subtasks /
                                 просто „изпълнено“ / „пропусни“ / „нулирай“). Ползва се в
                                 „Днес“, календара и при еднократните задачи.
                                 Props `hideSkip` (крие „Пропусни“) и `onDelete` (бутон „Изтрий“).
      TodoRow.jsx              — един ред за еднократна задача в общия списък. Цветовете са
                                 като на обикновените карти (същия `getCalendarDayState`,
                                 rule=null → pending сиво / partial зелено / gradient) — само
                                 малък неутрален етикет „ЕДНОКРАТНА“ ги отличава. Собствен
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
      MakeupPicker.jsx         — избор на дата за наваксване (makeup); ползва се и от `TodayScreen`
      UnlinkedPicker.jsx       — избор на кой ръчно отработен ден да се свърже; извлечен от
                                 `DayModal.jsx` в собствен файл 2026-09-23, за да го ползва и
                                 `TodayScreen`
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
    useConfetti.js             — `fireConfetti` (стандартно, 2 сек, при всяко завършване на
                                 задача — `TaskActions.jsx`) + `fireGoldenConfetti` (златно,
                                 при „Браво! Всичко е завършено!“ в „Днес“ — `TodayScreen.jsx`,
                                 виж раздел 4.7) *(свързано 2026-09-18 — преди беше неизползвано)*
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
    sounds.js                 — синтезирани звукови ефекти (Web Audio): `playSound(event)`,
                                 `isSoundEnabled` / `setSoundEnabled` (глобално, `localStorage`
                                 `soundEnabled`, по подразбиране включено) + собствен файл за
                                 събитие (през `<audio>`, пази се чрез `storage.js`) — виж раздел 7, 2026-09-20
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
  order: number,                 // зададено при създаване (= createdAt), пазено при редакция;
                                 //   **не се чете никъде за подредбата в „Днес"** (виж 4.7 —
                                 //   естественият ред е по азбука, ▲▼/drag пишат в `dayOrders`)
  date: "YYYY-MM-DD",            // денят, за който е задачата (по подразбиране деня при създаване)
  completedAt: string | null
}
```
- **Напълно независими** от `habits` / `rules` / `tasks`. Не влизат в календара,
  статистиката, „Пропуснати“ или архива.
- Живеят в `data.todos`, пазят се в същия IndexedDB запис, влизат в JSON export и backup-и.
- **Показват се в ОБЩИЯ списък на „Днес”** (не в отделна секция) — **със същите цветове
  като обикновените карти** (`TodoRow` минава `todo` през `getCalendarDayState` с `rule=null`:
  pending → `bg-gray-50`, частично изпълнени completions → `bg-green-300`, частични подзадачи
  → gradient бяло→зелено; `textColor` / `statusColor` / прогрес-балон точно като в
  `TodayScreen` за навик). Единствената разлика е малкият неутрален етикет „ЕДНОКРАТНА”
  (бял чип, `text-gray-600`). *(2026-09-07 — преди това фонът беше жълт)*.
  **По подразбиране излизат най-отгоре в списъка** (над навиците), докато потребителят не
  пренареди ръчно деня — виж раздел 4.7. *(2026-09-18 — преди това бяха след навиците)*
  Правило за видимост (`TodayScreen.todoBelongsHere`): показва се ако
  `todo.date === разглеждания ден`; **или** ако разглеждаш днес и `todo.date` е минал и
  задачата не е завършена („пренасяне” на просрочените). Задача за бъдещ ден се вижда само
  на този ден. Стар запис без `date` се третира като „днес” (fallback).
- `order` вече е само вторичен ключ (естествен ред преди ръчна подредба) — реалната
  подредба в „Днес” е общата `dayOrders[dateStr]` (виж 4.7).
- Отмятането ползва същия `TaskActions` (с `hideSkip` — без „Пропусни”; и `onDelete`).
  „Нулирай задачата” изчиства прогреса (completions/subtasks → неотметнати, `status: 'pending'`)
  — това има ефект и за еднократните задачи. `TaskActions.reset()` слага и `manuallyReset: true`,
  но той е чисто habit-специфичен (чете се само от `checkMissedTasks`/`calendarStates`/
  дедупликацията на навици — виж 4.2/4.3) — за todos е мъртъв флаг, затова
  `TodoRow.handleActionUpdate` изрично го маха, преди да запише резултата от всяко действие
  на `TaskActions` върху todo обекта. *(2026-09-18)*
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
  „⏸ Направи задачата неактивна“ (цялата) оставя прозореца отворен (важен надпис); „⏸“ на
  повторение/подзадача и „▶ Върни активно“ го затварят след 300 ms (виж 4.8, „Затваряне на
  прозореца за действия при това превключване“).
  `TodoRow` рендва модалите (`actionOpen`, `editing`) като братя на реда-`<div>` (в `<>…</>`),
  за да не наследят `opacity-75` на неактивния ред — иначе fixed прозорецът ставаше полупрозрачен.
- При пълно изпълнение: `TodoRow` вика `onComplete(snapshot)`; `TodayScreen` слага
  `completingTodoId` (редът остава видим ~1.15 s с `animate-todo-done` — само плавно
  избледняване/свиване, без задраскване), после показва
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
| `backup_<id>_auto_<ts>` | **автоматично** копие преди заместване/изтриване на данните на профила (последните 3, отделно от ръчните) |
| `customSound_<събитие>` | **глобален** потребителски аудио файл за звуково събитие (не е по профили, не влиза в export/backup; виж раздел 7, 2026-09-20) |
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
  остава отворен **само** при „⏸ Направи задачата неактивна“ (`scope === 'task'`, важен
  надпис); „⏸“ на повторение/подзадача и всяко „▶ Върни активно“ го затварят след 300 ms
  — като при отмятане (виж 4.8, „Затваряне на прозореца…“).

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
  избраните „неактивни“ са тъмно slate (`bg-slate-500 text-white`). `line-through` в целия
  UI на задачите вече не се ползва — остана само за „Вече завършено“ в `MakeupPicker`
  (избор на дата за наваксване — друго значение).

**Затваряне на прозореца за действия при това превключване** *(2026-09-07)*:
- **Остава отворен САМО при „⏸ Направи задачата неактивна“** (`scope === 'task'`, посока
  ⏸) — там `TaskActions` показва важния надпис „Задачата е неактивна / Не се брои…“,
  който трябва да се прочете.
- **Затваря се** (след 300 ms, като при отмятане) във всички други случаи:
  „⏸“ на отделно **повторение** или **подзадача** (няма надпис за четене) и всяко
  „▶ Върни активно“ / „▶ Върни като активна“.
- Реализация: `TodayScreen.handleToggleInactive` и `TodoRow.handleToggleInactive`
  смятат `reactivating` (навик: `scope:'task'` → `!!modalHabit.inactive`;
  `completion`/`subtask` → `cur.includes(index)`; todo: `!!actionTodo.inactive` /
  `elem.inactive` **преди** превключването), после
  `const keepOpen = scope === 'task' && !reactivating;` и `if (!keepOpen)` викат
  `closeModal()` / `setActionOpen(false)` през `setTimeout(…, 300)`.

### 4.6 Смяна на правило — `applyRuleChange(...)`
Два режима: „само за бъдещи дати“ и „за всички дати“. И в двата: пазят се само
завършените задачи (`isTaskCompleted`), останалите минали pending/partial се
трият/презалагат, генерират се нови за новото правило, накрая `checkMissedTasks`.

### 4.7 Общ ред на „Днес” (навици + еднократни) — `TodayScreen.jsx`
Екран „Днес” показва навиците и еднократните задачи в **един списък**.

1. `dayTodos` = `todos`, филтрирани по `todoBelongsHere` (по `date` + пренасяне на
   просрочените), сортирани по азбучен ред на `name` (`localeCompare(..., 'bg')`) —
   естественият ред преди всякаква ръчна подредба, същия принцип като при навиците.
   *(до 2026-09-18 бяха по `order ?? createdAt`, т.е. по ред на създаване)*
2. `naturalRefs` = `[...dayTodos, ...sortedHabits]` като `{ kind, id }` — **еднократните
   най-отгоре по подразбиране**, после навиците по `manualOrder`/азбука.
   *(до 2026-09-18 беше обратното: навици, после еднократни)*
3. Ако има `dayOrders[dateStr]` → `orderedRefs` = `naturalRefs`, стабилно сортирани по
   `dayOrders[dateStr].indexOf(id)`; липсващ id (елемент, който още не е бил пренареждан
   ръчно за деня — типично новосъздадена еднократна задача) пада към `fallbackIdx`:
   `-1` за еднократна (най-отгоре, дори над вече ръчно подредени навици) / `999` за навик
   (най-отдолу, както досега). `dayOrders[dateStr]` съдържа смесени `habitId` и `todoId`.
4. `items` = `orderedRefs`, резолвнати към пълни обекти и филтрирани (скрити: завършени
   навици, липсващи задачи, наваксани дни, завършени еднократни освен по време на анимация).
5. `moveItem(id, dir)` / `handleDrop` разменят в `orderedRefs.map(r => r.id)` и записват
   целия ред в `dayOrders[dateStr]`. Изключено при активно търсене.
   След първото ръчно пренареждане на деня новите/старите id-та влизат в `dayOrders[dateStr]`
   с реален индекс — оттам нататък „най-отгоре по подразбиране” вече не важи за тях,
   ръчната подредба се пази (виж точка 3).

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
- **Lint baseline: 9 проблема (2 грешки + 7 предупреждения)** — всички са отпреди звуковите
  ефекти (сверено с чистия `HEAD` през `git stash`; до 2026-09-20 записите по-долу пишат просто
  „baseline-а от раздел 6“). Правилата са само 2:
  - `react-hooks/set-state-in-effect` (**грешка**) — `App.jsx:167` и `components/ui/DateInput.jsx:22`:
    `setState` директно в тялото на `useEffect`.
  - `react-hooks/exhaustive-deps` (**предупреждение**) — липсващи зависимости в `App.jsx:179`,
    `CalendarScreen.jsx:23` и `:40`, `HabitsScreen.jsx:27`, `StatisticsScreen.jsx:172`,
    `TodayScreen.jsx:51` и `:89`. Оставени нарочно: добавянето им би довело до безкраен цикъл
    генериране→запис→нов тригер (виж 2026-09-11).

  Номерата на редовете се местят при всяка промяна на файла — важи правилото + файла.
- ~~`src/components/Placeholder.jsx` — забравен placeholder компонент от ранен scaffold
  (никъде не се импортираше).~~ **Изтрит 2026-09-18.**

---

## 7. История на поправките

### 2026-09-29 (допълнение) — Файл с копие + подканване преди всяко заместване/изтриване

**Какво:** освен локалното автоматично копие, при „Зареди backup“ (един профил), „Възстанови“ и „Изтрий данните“
вече се сваля и JSON файл с текущите данни на профила (`Задачи_<профил>_преди_замяна_<дата>.json`). Общият
помощник `downloadThenConfirm` в `SettingsModal.jsx` показва ConfirmModal „Провери дали файлът е свален“ —
„Файлът е свален — продължи“ / „Откажи“. Откажи прекъсва действието (данните и локалното авто копие остават).
Същото подканване има и при „всички профили“ (файл `Задачи_ВСИЧКИ_профили_преди_замяна_<дата>.json`).
Ред: локално копие → сваляне на файл → подканване → заместване/изтриване. Ако `exportToJson` хвърли грешка —
диалогът казва да се свали ръчно, с „Продължи без файл“. Пак важи „само ако профилът има данни“ (празен профил
не сваля нищо). Браузърът не позволява да се провери, че файлът реално е записан — затова е ръчното потвърждение.

Пътят „всички профили“ (изтриване и зареждане на файл) също е проверен в браузъра — с подканването и отказ.

**Проверено в браузъра** (тестов профил, `<a>.click` подменен да записва името вместо да сваля): диалогът се
показва преди изтриването (данните още са там); „Откажи“ → данните остават; „продължи“ → изтрити, файлът е
поискан 2 пъти (по един на опит), авто копията се пазят. Изпитателният профил е изтрит. Lint — само baseline.

### 2026-09-29 — Автоматично резервно копие преди заместване/изтриване на данни

**Какво:** преди действие, което заменя или трие данните на АКТИВНИЯ профил, `SettingsModal.jsx` пази
автоматично локално копие (`saveBackup(data, profileId, { auto: true })`). Обхват: „Зареди backup (JSON)“
(файл с един профил), „Възстанови“ от локално копие, „Изтрий данните на този профил“ / „Изтрий ВСИЧКО“.

**Решения (потвърдени с потребителя):**
- **Отделен лимит:** ръчните копия — ключ `backup_<id>_<ts>`, последните 5; автоматичните — ключ
  `backup_<id>_auto_<ts>`, последните 3. Всеки вид се подрязва само в собствената си група, така че
  автоматичните не изтласкват ръчните (до 8 копия на профил общо). `listBackups` връща и `auto: true/false`;
  в списъка „Налични backup-и“ автоматичните имат етикет „авто“. `deleteProfile` трие и двата вида (по префикс).
- **Само ако профилът има данни:** `hasProfileData(data)` (нов export от `storage.js`) — поне един
  непразен от `habits`/`tasks`/`rules`/`archivedHabits`/`todos`; празни `dayOrders` не се броят.
- **Неуспех → питаме:** `withSafetyCopy` в `SettingsModal`. Ако `saveBackup` върне `false` (изключение или
  записът не се чете обратно), не се продължава — показва се ConfirmModal „Автоматичното копие не успя“ с
  „Откажи“ / „Продължи без копие“.
- **„Възстанови“:** избраното копие се зарежда ПРЕДИ автоматичното копие на текущото състояние, иначе новото
  авто копие (лимит 3) би могло да изтласка точно избраното най-старо авто копие. Ако избраното копие не
  се чете — грешка и нищо не се променя (преди това ставаше мълчаливо нищо).
- **„Изтрий ВСИЧКИ профили“ и файл с всички профили** (`resetAllProfiles` / `importAllProfiles` трият всички
  `backup_*`, така че авто копие не оцелява): `withAllProfilesFile` автоматично сваля JSON с всички профили
  (`Задачи_ВСИЧКИ_профили_преди_замяна_<дата>.json`, само ако някой профил има данни), а текстът на
  потвърждението изрично казва, че локалните копия също се трият. Ако подготовката на файла хвърли грешка —
  пита „Продължи без файл“. *(`exportToJson` не може да разбере дали браузърът е блокирал свалянето —
  проверява се само подготовката на данните.)*
- Копието се прави след ПОСЛЕДНОТО потвърждение (след „Да, изтрий“), не при първото — отказ не оставя копия.
- `storage.js` не е пипан по логиката на `resetAllProfiles`/`importAllProfiles`/`clearAppData`.

**Ръководство:** `HelpModal.jsx` — секция „Настройки“: „Зареди backup“, „Резервни копия“ и „Изтрий данни“ вече
описват автоматичното копие (вместо „първо си направи backup“ / „Локалните резервни копия остават“).

**Проверено в браузъра (dev, нов профил „ТЕСТ-BACKUP“ с 1 навик; след теста профилът е изтрит):**
- „Изтрий данните“ → профилът е празен, в `listBackups` има копие с `auto: true` и 1 навик;
- 7 авто + 6 ръчни записа → остават 3 авто и 5 ръчни; в UI 3 етикета „авто“;
- „Възстанови“ върху празен профил → без ново авто копие; върху профил с данни → ново авто копие;
- симулиран неуспех (`IDBObjectStore.prototype.put` хвърля за `_auto_` ключ) → диалог „Автоматичното копие не
  успя“, данните НЕ са изтрити; „Откажи“ ги запазва;
- без конзолни грешки. **Не е тествано в браузъра:** пътят „всички профили“ (сваляне на файл).
- `eslint` върху променените файлове — чисто; `vite build` — успешен (`dist/` е прегенериран).

### 2026-09-29 — Ръководство (`HelpModal.jsx`): преработено спрямо реалното поведение

**Какво:** ръководството е пренаписано от гледна точка на потребителя. Махнато е всичко очевидно или
показвано на самия екран (описания на полета, навигация, търсене, как се пренарежда, текстове на
прозорци). Оставено е само каквото не личи от интерфейса. Добавена е секция „Основното накратко“
(автоматично „пропуснат“ ден; данните са само на устройството).

**Поправени остарели/неверни твърдения** (всичко сверено с кода):
- „★ Основна“ не подрежда списъците — `isDefault` само рисува рамка/етикет на картата и избира задачата
  по подразбиране в `CalendarScreen` и `StatisticsScreen`.
- Напомнянията работят само докато приложението е отворено (`useNotifications` — `setInterval`, без push).
- „Изтрий данни“ оставя резервните копия само за ЕДИН профил; `resetAllProfiles` и `importAllProfiles`
  трият всички `backup_*`.
- Нулиране на наваксване/отработен ден изтрива деня извън правилото (не „връща предишното състояние“).
- „Само бъдещи дати“ включва днес (`fromDate` = днес) — оцеляват само напълно завършените задачи.
- Цветове: днес има индиго рамка; зелена рамка само за днес/бъдеще; добавен градиентът за частични подзадачи.
- Поредицата в Статистика се брои само в избрания период; неактивните дни не я прекъсват.

**Новоописани неочевидни неща:** начална дата в миналото създава веднага пропуснати дни; „Пропусни“
изтрива направените отметки; последната задача не се трие; „Наваксай задача тук“ / „Промени датата“ /
„Свържи с ден от правилото“ (само в Календара); кои дни влизат в „Пропуснати“; iPhone няма банер за
инсталиране (стъпки „Сподели → Добави към началния екран“).

**Проверено в браузъра (dev, отделен профил):**
- Смяна на `timesPerDay` 1 → 2 върху 3 завършени дни ги превърна в `partial` (`[true,false]`) и трите се
  появиха в „Пропуснати“ — `App.handleHabitSave` (клонът без промяна на правилото) прегражда `completions`/
  `subtasks` за ВСИЧКИ задачи на навика, включително минали, и не вика `checkMissedTasks` веднага.
- Нов навик „всеки ден“ със старт 01.09 при днес 29.09: 761 задачи, от които 28 `missed` (01–28.09).

**Открито, не е променяно в кода:** процентът в „Статистика“ = изпълнени / дни от правилото до днес, а
„изпълнени“ включва наваксвания и отработени без връзка — теоретично може да надхвърли 100 %.
Автоматично резервно копие преди „Зареди backup“ няма (решено да се направи отделно); ръководството
само препоръчва ръчен backup.

**Втори преглед за скрити (неочевидни) действия:** върнати са щракането върху датата в „Днес“ (малък
календар), оранжевият бутон „Отиди на Днес“, автоматичната смяна след полунощ, отварянето на задача с
натискане на картата, изборът на месец/година в Календара, иконата ⚙️ / чипа на профила, общата бележка
между „Днес“ и Календара и ✕ на банера за инсталиране (скрива го за 7 дни).

**Проверка:** `eslint` върху `HelpModal.jsx` — чисто; ръководството се рендира (14 секции), без конзолни
грешки и без хоризонтално преливане; `vite build` успешен (`dist/` е прегенериран).

### 2026-09-23 — Екран „Днес": прозорецът за действия вече има „Наваксай на друга дата“ и „Свържи с отработен ден“ (същите като в Календара)

**Какво:** прозорецът за действия върху обикновена задача в „Днес“ (`TodayScreen.jsx`, модалът с
`TaskActions`) вече предлага същите възможности като `DayModal.jsx` в Календара — не само
отмятане/нулиране/неактивност, а и четирите състояния на наваксване:
- **Обикновен ден** — бутони „↻ Наваксай на друга дата“ (отваря `MakeupPicker`, condition:
  `status !== 'completed' && !habitInactive`) и „🔗 Свържи с отработен ден“ (отваря новия
  `UnlinkedPicker`, condition: съществува ръчен несвързан ден за същия навик на друга дата).
- **Ден, който се наваксва другаде** (`task.makeupForDate`) — заключена карта +
  „🔄 Нулирай задачата“ (преди нямаше начин да се развърже от „Днес“, само от Календара).
- **Makeup ден** (`task.makeupFromDate`) — banner-ът вече има „✏️ Промени датата за наваксване“
  + „🔄 Нулирай задачата“ под `TaskActions`.

**Извлечен споделен компонент:** `UnlinkedPicker` (избор на ръчно отработен ден за връзка) беше
дефиниран inline вътре в `DayModal.jsx`, преместен е в собствен файл
`src/components/calendar/UnlinkedPicker.jsx` (същия JSX, без промяна в логиката) — сега се ползва
и от двата екрана. `MakeupPicker.jsx` вече беше самостоятелен файл, преизползван директно.

**Нови handler-и в `TodayScreen.jsx`** (огледални на `DayModal`-логиката, но върху общия `tasks`
масив на екрана, не `allTasks` prop): `handleMakeupSelect`, `handleUnlinkedSelect`,
`handleModalReset`. `modalRule` / `modalInRule` се смятат до `modalHabit`/`modalTask` (активното
правило за навика + дали избраният ден е в него).

**Клопка (открита и поправена по време на теста в браузъра):** `App.handleTasksUpdate` по
подразбиране **мърджва** по `id` — задача, отсъстваща от подадения масив, просто се пази
непроменена, **не се трие**. `CalendarScreen.handleTasksUpdate` винаги вика
`onTasksUpdate(updatedTasks, true)` (`fullReplace`), затова изтриването на makeup/unlinked
задача от `DayModal.handleReset` работи в Календара. Първата версия на новите handler-и в
`TodayScreen` викаше `onTasksUpdate(...)` без `true` — привидно работеше (бутонът изчезваше от
UI), но всъщност оставяше „duh“ запис в IndexedDB (задачата с `_delete` не се трие, само
местните ѝ полета спират да се обновяват — сирачета с висящи `makeupFromDate`/`makeupForDate`
към вече несвързания отсрещен ден). Поправено: и трите нови handler-а подават
`onTasksUpdate(checkMissedTasks(updated), true)`.

**Проверка:** `npm run lint` — същите 9 проблема (2 грешки + 7 предупреждения) като преди
промяната (baseline-ът от раздел 6). Ръчно тествано в браузъра: нормален ден → наваксване на
друг ден → нулиране (връща се коректно); нормален ден → свързване с ръчно отработен ден →
заключена карта → нулиране (връзката се маха и отсрещната задача се изтрива коректно, проверено
през IndexedDB). `HelpModal.jsx` — добавен ред в раздел „Днес“, че прозорецът за действия има
същите наваксване/връзка бутони като Календара.

### 2026-09-20 — Звукови ефекти (синтезирани + собствен файл за събитие, глобален превключвател в „Настройки“)

**Какво:** кратки звуци, генерирани с **Web Audio API** (осцилатори, без аудио файлове и без
нови зависимости). Глобална настройка — важи за цялото приложение, **не е по профили**, не
влиза в export/import и в backup-ите. Пази се в `localStorage` ключ `soundEnabled`
(`'0'` = изключен; липсващ/друго = **включен по подразбиране**). В „Настройки“ има нова карта
„Звукови ефекти“ с превключвател (`role="switch"`); при включване свири кратка проба.

| Събитие | Кога се пуска | Къде |
|---------|---------------|------|
| `check` | отметнато повече изпълнения/подзадачи, но задачата още не е завършена | `TaskActions.finish` |
| `complete` | задачата току-що е станала `completed` (заедно с конфетите) | `TaskActions.finish` |
| `allDone` | преход към „Браво! Всичко е завършено!“ (заедно със златното конфети) | `TodayScreen` (ефекта с `celebratedDateRef`) |
| `skip` | бутон „✗ Пропусни“ | `TaskActions.markMissed` |
| `delete` | потвърдено изтриване на навик / еднократна задача / архивиран навик | `HabitsScreen`, `TodoRow` (`onDelete`), `ArchiveScreen` |
| `error` | „Не може да изтриете последната задача!“; невалиден/повреден файл при импорт | `HabitsScreen.handleDeleteRequest`, `SettingsModal.handleImport` |

| Файл | Промяна |
|------|---------|
| `src/utils/sounds.js` | **нов** — `playSound(event)`, `isSoundEnabled()`, `setSoundEnabled(v)`, `getSoundVolume()` / `setSoundVolume(v)`, `setCustomSoundVolume(event, v)`, `MAX_FILE_VOLUME`; таблица `SOUND_DEFS` (тонове: честота, начало, продължителност, вълна); един споделен `AudioContext`; потребителски файлове: `setCustomSound` / `removeCustomSound` / `ensureCustomSounds` / `getCustomSoundsInfo`, `SOUND_LABELS` |
| `src/utils/storage.js` | `saveCustomSound` / `loadCustomSounds` / `deleteCustomSound` (ключ `customSound_<събитие>`) |
| `src/components/today/TaskActions.jsx` | `finish` пуска `complete` / `check`; `markMissed` пуска `skip` |
| `src/components/today/TodayScreen.jsx` | `playSound('allDone')` до `fireGoldenConfetti()` |
| `src/components/today/TodoRow.jsx`, `habits/HabitsScreen.jsx`, `habits/ArchiveScreen.jsx` | `delete` / `error` |
| `src/components/settings/SettingsModal.jsx` | карта „Звукови ефекти“ (`soundOn`, `toggleSound`), плъзгач за обща сила (`volume`, `handleVolumeChange`), списък със събития: Изпробвай / Качи файл / Върни стандартния (`customInfo`, `handleSoundUpload`, `handleSoundRemove`, `handleFileVolumeChange` — плъзгач за сила на файла) + `error` при неуспешен импорт |

**Собствен аудио файл за събитие** *(добавено същия ден)*: за всяко от 6-те събития в
„Настройки“ има „▶ Изпробвай“, „📁 Качи файл“ (`accept="audio/*"`) и „✕ Върни стандартния“.
Показват се името, размерът и дължината на файла. **Няма ограничение за размер/дължина** —
решение на потребителя: тя не е проблем за приложението, защото файловете се пускат през
**един общ `<audio>` елемент** (стрийминг), а не с `decodeAudioData` (изцяло разкодиран
10-минутен файл е ~100–200 MB RAM и би сривал телефона).
- **Хранилище:** IndexedDB, същата база/store като останалото, ключ `customSound_<събитие>` →
  `{ blob, name, size, duration }` (функции `saveCustomSound` / `loadCustomSounds` /
  `deleteCustomSound` в `storage.js`). **Глобални** — не са по профили; **НЕ влизат в export /
  import / backup-ите** (решение на потребителя). `resetAllProfiles`, `importAllProfiles` и
  backup-ите филтрират по конкретни префикси (`profileData_`, `backup_`, `profilesMeta`), затова
  „Изтрий всички профили“ и импорт **не** трият качените звуци (проверено).
- **Проверка при качване (`setCustomSound`):** файлът се зарежда в `Audio` за метаданни; при
  `error` → отказ със съобщение; ако браузърът не даде метаданни до 4 s (iOS Safari не ги
  зарежда без жест) → приема се непроверен (при неуспех на възпроизвеждането пада към
  синтезирания звук). После се записва в IndexedDB и се **чете обратно** (сверява се `size`) —
  ако устройството не може да пази Blob или няма място → отказ, вместо повреден запис.
- **Възпроизвеждане (`playSound`):** ако за събитието има файл → през общия `<audio>`; иначе
  синтез. Всеки нов звук (и синтезиран) първо спира текущия потребителски → най-много един
  потребителски звук наведнъж. Изключване на звука в „Настройки“ го спира веднага.
  `NotSupportedError` → синтезиран звук; `NotAllowedError` (няма жест) / `AbortError` → тихо.
  `allDone` се отлага след `complete` и за потребителски файлове (общият `completeEndsAt`).
- Зареждането на файловете (`ensureCustomSounds`) става при първия import на `sounds.js`
  (самоинициализация в края на модула) и още веднъж при отваряне на „Настройки“.
- **Сила на звука** *(добавено същия ден)*: **един общ плъзгач** „Сила на звука“ 0–100 % (стъпка
  5, по подразбиране 100 %) в картата „Звукови ефекти“ (виден само при включен звук). Важи
  **поравно** за синтезираните И качените звуци. За изравняване между тях има и **плъзгач за
  всеки качен файл поотделно** (виж по-долу).
  Пази се в `localStorage` ключ `soundVolume` (0..1), глобално, не влиза в export/backup. При
  пускане на плъзгача свири пробен `check`. Реализация: синтез — пикът е
  `MASTER_GAIN (0.18) × volume`, при 0 не се пуска нищо; качени файлове — `<audio>` минава през
  `createMediaElementSource → GainNode → destination` (`mediaGain`), защото `audio.volume` се
  **игнорира на iOS Safari**; ако `AudioContext` липсва → пада към `audio.volume`. Следствие:
  качените файлове вече зависят от `AudioContext` да е `running` (`playCustom` вика `resume()`).
- **Сила на всеки файл поотделно** *(добавено същия ден)*: под името на файла (само когато има
  качен файл) има плъзгач „Сила на файла“ **0–200 %** (стъпка 5, по подразбиране 100 %,
  `MAX_FILE_VOLUME = 2`). Ефективната сила е **обща × на файла** (`applyCustomVolume`); при
  `AudioContext` (`GainNode`) усилването над 100 % работи, а във fallback към `audio.volume`
  е ограничено до 1. Пази се в `localStorage` ключ `customSoundVolumes` (JSON
  `{ [събитие]: 0..2 }`) — не в IndexedDB, за да не се пренаписва Blob-ът при всяко движение на
  плъзгача. **Нулира се на 100 %** при качване на нов файл и при „Върни стандартния“
  (`writeFileVolume(event, null)`). Промяната се прилага веднага и докато файлът свири
  (`currentEvent`). При пускане на плъзгача свири самият файл. **Риск:** над 100 % силен файл
  може да се изкриви (clipping) и да е много шумен — затова стойността по подразбиране е 100 %.

**Нюанси, които не са очевидни:**
- Звукът се пуска от **общата** точка `TaskActions.finish`, която ползват и „Днес“, и календарът
  (`DayModal`), и еднократните задачи (`TodoRow`) — затова няма отделно извикване там (иначе
  би се дублирал).
- `allDone` се отлага, ако току-що е свирил `complete` (`completeEndsAt`), за да не се
  застъпват. Самото „Браво“ (и конфетите, и звукът) се показва само ако за деня има поне една
  обикновена задача (`noTasksAtAll` в `TodayScreen`) — само с еднократни задачи не се показва
  (поведение отпреди тази промяна).
- Браузърите държат `AudioContext` „suspended“, докато няма жест от потребителя. Ако
  `resume()` не успее в рамките на 300 ms (`RESUME_WINDOW_MS`), звукът се пропуска — иначе би
  прозвучал късно, при следващото докосване (напр. „Браво“ при отваряне на вече завършен ден).
- Възможно ограничение на iPhone: при включен „тих режим“ Web Audio може да не се чува
  (ограничение на устройството, не на приложението).

**Проверка:** `npm run build` — успешен; `npm run lint` — същите 9 проблема като преди
промяната (baseline-ът от раздел 6: 2 грешки + 7 предупреждения). *Уточнение:* два от
променените файлове — `HabitsScreen.jsx` и `TodayScreen.jsx` — съдържат такива предупреждения,
но те са в стари ефекти, които не съм пипал (редовете им само се преместиха с +1 заради добавения
`import`); в новите/променените редове няма нито един нов проблем. В dev браузър
(броене на създадени осцилатори): отмятане 1 тон; завършване 2 тона; `allDone` 4; `skip` /
`delete` / `error` по 2; изключен звук — 0; непознато събитие — 0; превключвателят пази
`soundEnabled` в `localStorage` и е включен по подразбиране. Собствен файл: генериран WAV
(1.5 s) се приема и се показва като „65 KB · 0:02“; текстов файл с име `.mp3` се отхвърля със
съобщение; `complete` с качен файл пуска `<audio>` (0 осцилатора), `check` без файл — синтез (1);
файлът се пази след презареждане и след `resetAllProfiles`; „Върни стандартния“ го трие от
IndexedDB. Плъзгач: пик на синтеза 0.18 / 0.09 / 0 при 100 / 50 / 0 %; измерен сигнал на качен 440 Hz
файл зад `GainNode` (`AnalyserNode`) — пик 0.366 / 0.183 / 0.073 / 0 при 100 / 50 / 20 / 0 %;
стойността се пази в `localStorage`, плъзгачът се скрива при изключен звук. Сила на файл
(качен 440 Hz WAV, пик при 100 % = 0.244): обща 100 % × файл 100 / 60 / 200 / 0 % → пик 0.244 /
0.146 / 0.488 / 0; обща 50 % × файл 60 % → 0.073 (умножават се); файловата сила се пази след
презареждане, променя се на живо и се нулира при премахване на файла (`customSoundVolumes` → `{}`).
**Не е проверено:** реално чуване (панелът беше скрит), поведение на iPhone (`<audio>` след
жест, Blob в IndexedDB на стари iOS, работата на `GainNode` върху `<audio>` там).

### 2026-09-18 (4) — Златно конфети при „Браво! Всичко е завършено!“ + изтрит `Placeholder.jsx`

**Какво:** `fireGoldenConfetti` (дефинирана в `useConfetti.js`, но никъде не се викаше) вече
се пуска в `TodayScreen.jsx`, когато списъкът на „Днес“ премине в състоянието „Браво! Всичко
е завършено!“ (всички задачи/еднократни за разглеждания ден са отметнати и няма пропуснати).
Пуска се **веднъж** на преминаване в това състояние — не на всеки render, докато остава
завършено (иначе всяко търсене/пренаредба/друго странично обновяване би пуснало ново конфети).
Ако денят излезе от „завършено“ (напр. потребителят отмени отметка) и после пак влезе в него,
конфетите пак се пускат — поведението е „веднъж на честване“, не „веднъж завинаги на ден“.

| Файл | Промяна |
|------|---------|
| `src/components/today/TodayScreen.jsx` | извлечени именувани `noTasksAtAll`/`hasMissedTasks`/`allDoneToday` (вместо предишната inline тройна проверка в JSX — сега се ползват и от JSX, и от новия ефект); нов `celebratedDateRef` + `useEffect` — пуска `fireGoldenConfetti()` при преход `allDoneToday: false → true` за текущата дата, ресетва при изход от състоянието |

Освен това е изтрит забравеният `src/components/Placeholder.jsx` (ранен scaffold, никъде не
се импортираше — виж раздел 6).

**Проверка:** `npm run build` / `npm run lint` — само baseline-а от раздел 6, без нови
грешки/предупреждения (мутацията е само върху `ref.current`, не `setState`, така че не
задейства `react-hooks/set-state-in-effect`). Ръчно в dev браузър: завършена последната
активна задача за деня → показва се „Браво! Всичко е завършено!“ заедно със златно конфети;
последващо търсене в полето (предизвиква re-render без промяна в резултата) не пуска ново
конфети (проверено чрез липса на нов `<canvas>` елемент).

### 2026-09-18 (3) — Еднократни задачи: „Нулирай задачата" вече не пише мъртвия `manuallyReset` флаг

**Какво:** самото действие на „Нулирай задачата" (изчиства отметнатите изпълнения/подзадачи
наведнъж, връща `status: 'pending'`) се запазва — реално работи и е полезно за еднократни
задачи с няколко изпълнения/подзадачи. Премахнат е само страничният ефект: `TaskActions.reset()`
слага и `manuallyReset: true` върху резултата, но това поле е habit-специфично (чете се само
от `checkMissedTasks` — маркиране „пропусната" за минали дни — и от `calendarStates`/
дедупликацията на навици). Еднократните задачи нямат тази автоматична логика, така че флагът
се записваше и оставаше завинаги в todo обекта без каквото и да е бъдещо действие да го чете.

| Файл | Промяна |
|------|---------|
| `src/components/today/TodoRow.jsx` | `handleActionUpdate`: маха `manuallyReset` от резултата на `TaskActions`, преди да го запише — важи за **всяко** действие през `TaskActions` (на практика само „Нулирай" го сеща), не само за бутона |

**Проверка:** `npm run build` / `npm run lint` — само baseline-а от раздел 6. Ръчно в dev
браузър: еднократна задача с 2 подзадачи → отметната 1 → „Нулирай задачата" → прогресът се
изчиства (0/2, `pending`); директна проверка на IndexedDB записа потвърждава, че полето
`manuallyReset` изобщо не присъства в todo обекта след нулирането.

### 2026-09-18 (2) — Екран „Днес": еднократните задачи по азбучен ред по подразбиране

**Какво:** новосъздадени еднократни задачи, които потребителят още не е пренаредил ръчно
за деня, вече се подреждат помежду си **по азбучен ред на името** (както навиците, когато
нямат `manualOrder`), вместо по ред на създаване.

| Файл | Промяна |
|------|---------|
| `src/components/today/TodayScreen.jsx` | `dayTodos`: сортът е сменен от `order ?? createdAt` на `name.localeCompare(..., 'bg')` |

`todo.order` продължава да се записва при създаване (за съвместимост с export/import и
стари данни), но вече не се чете никъде за подредбата — виж раздел 3.4.

**Проверка:** `npm run build` / `npm run lint` — само baseline-а от раздел 6. Ръчно в dev
браузър: създадени три еднократни задачи в реда „Ябълки", „Вода", „Банан" → показани като
„Банан", „Вода", „Ябълки" (азбучно), над навика, без ръчна намеса.

### 2026-09-18 — Екран „Днес": еднократните задачи най-отгоре по подразбиране

**Какво:** в общия списък на „Днес" еднократните задачи вече излизат **над** навиците
по подразбиране (естествен ред, преди всякаква ръчна подредба). Ако денят вече има
ръчна подредба в `dayOrders[dateStr]` (от drag-and-drop / ▲▼), нова еднократна задача
пак изскача най-отгоре — над вече подредени навици — докато самата тя не бъде преместена
ръчно; след първото ръчно пренареждане на деня нейната позиция се запазва точно както
потребителят я е оставил (виж раздел 4.7).

| Файл | Промяна |
|------|---------|
| `src/components/today/TodayScreen.jsx` | `naturalRefs`: разменен редът на `dayTodos` и `sortedHabits` (еднократни първи); добавен `fallbackIdx(ref)` — елемент, липсващ от `dayOrders[dateStr]`, пада към `-1` (еднократна) вместо общото `999` за навик |

**Проверка:** `npm run build` / `npm run lint` — само baseline-а от раздел 6, без нови
грешки/предупреждения. Ръчно в dev браузър: навик + еднократна задача за деня →
еднократната се показва първа; ръчно преместване на навика над нея с ▲ се запазва след
презареждане; нова втора еднократна задача, създадена след ръчната подредба, пак излиза
най-отгоре (над вече подредените).

### 2026-09-14 — UpdatePrompt изнесен извън App (иначе спира да проверява при бял екран)

**Симптом:** след предишната поправка (Error Boundary по-долу) потребителят потвърди,
че белият екран се е оправил, но не е видял прозореца „Налична е нова версия“ преди
това — просто отворил приложението наново след commit/deploy и то си работело.

**Причина:** `<UpdatePrompt />` (компонентата с `useRegisterSW`, която регистрира
service worker-а и проверява за нова версия — раздел 8) се рендваше **вътре** в
`<App />` (последен ред в JSX-а). Докато `<App />` гърми при render (какъвто и да е
бил източникът на белия екран), React изобщо не стига дотам — `UpdatePrompt` никога
не се монтира, `useRegisterSW` никога не тръгва, service worker-ът никога не се
проверява за нова версия. Ефектът: веднъж влязло в crash състояние, приложението е
било „заключено“ там — никакъв бъдещ fix не би могъл да стигне до него през нормалния
„Обнови сега“ поток, единствен изход е бил ръчно затваряне/преинсталиране.

**Поправка:**

| Файл | Промяна |
|------|---------|
| `src/App.jsx` | премахнати импорт и рендиране на `<UpdatePrompt />` (последния ред в JSX-а) |
| `src/main.jsx` | `<UpdatePrompt />` рендван като **сестра** на `<ErrorBoundary><App/></ErrorBoundary>`, вътре в `<StrictMode>` — работи независимо от това дали `App` е гръмнала |

**Ефект:** дори `App` да гръмне отново, проверката за нова версия продължава да работи
във фонов режим — при налична поправка изскача „Налична е нова версия“ **върху** екрана
за грешка, и „Обнови сега“ реално ще донесе fix-а, без да се чака ръчен reinstall.

**Проверка:** `npm run build` / `npm run lint` — само baseline-а от раздел 6.
Ръчно в браузър: принудителна тестова грешка (`throw` в `App`, махната след теста) —
екранът за грешка се показва нормално, без нови конзолни грешки от преместването;
нормално зареждане след премахване на теста е непроменено.

### 2026-09-14 — Error Boundary: бял екран → видима грешка

**Симптом:** потребител съобщи за бял екран на инсталираното на телефона PWA след
натискане на „Обнови сега“ — не се оправи и след пълно затваряне/отваряне 1–2 пъти
(известният трик за „заседнала стара версия“, виж раздел 8, не помогна тук).

**Диагноза:** `main.jsx` монтираше `<App />` без никакъв error boundary — всяка
необхваната грешка при render (изключение в React дървото) праща React да размонтира
цялото дърво, оставяйки празен `<div id="root">` без каквато и да е следа за причината.
Тествах последния deploy „на чисто“ (нов браузър, без данни) — зарежда се коректно;
данните на потребителя **не се синхронизират между устройства** (всичко е локално в
IndexedDB, раздел 1), затова не можах да пресъздам самата грешка синтетично — тя е
специфична за реалните данни на телефона.

**Поправка (не отстранява непознатата първопричина, а прави следващата поява
диагностируема вместо мълчаливо бяла):**

| Файл | Промяна |
|------|---------|
| `src/components/ErrorBoundary.jsx` | **нов** — class компонент (`getDerivedStateFromError` + `componentDidCatch`); при грешка показва съобщението + stack в четим вид и бутон „Презареди“ |
| `src/main.jsx` | `<App />` обвит в `<ErrorBoundary>` |

**Проверка:** `npm run build` и `npm run lint` минават чисто (само двете
предварително документирани грешки/7 предупреждения от раздел 6). Ръчно в браузър —
принудителна тестова грешка (`throw` в `App`, махната след теста) действително се
хваща и се показва четимо съобщение вместо бяло; нормалното зареждане след премахване
на теста работи без промяна.

**Следваща стъпка:** очаква се потребителят да изпрати точния текст на грешката при
следваща поява, за да се открие и оправи реалната причина в данните/логиката.

### 2026-09-14 — Бавно начално зареждане при много задачи

**Симптом:** при отваряне на приложението надписът „Зареждане...“ стоеше видимо
2–3 секунди преди екран „Днес“ да се покаже, особено при потребители с много
задачи (навици).

**Причина:** автоматичното генериране на задачи при старт (`App.jsx`, ефектът за
следващите 3 месеца) и дублиращото го генериране в `TodayScreen.jsx` (за текущия
месец) минаваха през всеки habit и за всеки ден от месеца проверяваха дали вече
има запис с `existingTasks.some(...)` — линейно сканиране на **целия** масив от
задачи, повторено за всеки ден. Отгоре на това при всяка итерация по habit се
правеше `[...tasks, ...newTasks]`, копирайки растящия масив наново — напълно
излишно, защото различните задачи имат различен `habitId`, а различните месеци
никога не се припокриват по дата (генерираното от предишна итерация не може да е
релевантно за следващата проверка). С натрупана история от задачи това блокираше
синхронно главната нишка точно докато трябваше да изчезне „Зареждане...“.

**Поправка:**

| Файл | Промяна |
|------|---------|
| `src/utils/taskGenerator.js` → `generateTasksForMonth` | вместо `existingTasks.some(...)` за всеки ден, строи веднъж `Set` от съществуващите дати за habit-а (O(1) проверка на ден вместо O(n)) |
| `src/App.jsx` (ефект за автогенериране при старт) | премахнато ненужното `[...data.tasks, ...newTasks]` при всяка итерация по habit — подава се направо `data.tasks` |
| `src/components/today/TodayScreen.jsx` (ефект при смяна на деня) | същото опростяване — подава се направо `tasks` вместо `[...tasks, ...newTasks]` |

Сигнатурата на `generateTasksForMonth` не се променя — `applyRuleChange` и
`CalendarScreen.jsx` печелят от оптимизацията без промяна в тях.

**Проверка:** `npm run build` и `npm run lint` минават чисто (само двете
предварително документирани грешки/7 предупреждения от раздел 6, непроменени).
Симулирани 60 habits × ~5400 съществуващи задачи в IndexedDB (истинският браузър
на Claude Code, не production данните на потребителя) — зареждане до пълен рендер
падна до ~105–160 ms; крайният брой задачи съвпада точно с очакваното, без
дублирани `habitId+date` записи.

### 2026-09-11 — Почистване на lint грешки (нулев/нисък риск)

**Какво:** премахнат мъртъв код (неизползвани props/import-и/променливи) и оправена
единствената реална „impure render" грешка. Броят lint грешки падна от 22 на 2
(остават 2 грешки + 7 предупреждения, съзнателно непипнати — виж раздел 6).

| Файл | Промяна |
|------|---------|
| `src/components/today/TodayScreen.jsx` | премахнати неизползваните props `onTaskNoteUpdate`, `onHabitsReorder` (бележките минават през `onTasksUpdate`, пренареждането на навиците — през `HabitsScreen`) |
| `src/App.jsx` | премахнато подаването на горните два prop-а + цялата вече мъртва `handleTaskNoteUpdate`; премахнати неизползвани import-и `toMidnight`, `ArchiveScreen` |
| `src/components/calendar/DayModal.jsx` | премахнат неизползван import `generateId` |
| `src/components/calendar/MakeupPicker.jsx` | премахнат неизползван import `isPastDate` |
| `src/components/calendar/CalendarScreen.jsx` | премахнати неизползвани import-и `toMidnight`, `doesDateMatchRule` |
| `src/components/habits/HabitsScreen.jsx` | премахнат неизползван параметър `habit` на `handleDragOver` |
| `src/components/statistics/StatisticsScreen.jsx` | премахнати неизползван import `getNextRuleDate` и променлива `ruleDaysSet` |
| `src/utils/taskGenerator.js` | премахнати неизползвани import-и `isPastDate`, `hasTaskProgress` |
| `src/components/habits/HabitModal.jsx` | `useState(habit?.color ?? COLORS[Math.floor(Math.random()*...)])` → `useState(() => ...)` (lazy initializer) — `Math.random()` вече не се вика при всеки render; същевременно премахна и неизползвания `setColor` (няма UI за смяна на цвета — случайният цвят се задава еднократно при създаване, нарочно) |
| `public/sw.js` | `install` listener-ът вече не приема неизползвания параметър `e` |
| `eslint.config.js` | нов override за `public/sw.js` с `globals.serviceworker` — `clients`/`self` вече се разпознават като истински Service Worker глобали, вместо да гърмят като `no-undef` |
| `src/App.jsx` (2) | `NAV_ITEMS.map(({ id, label, Icon }) => ...)` → без `Icon` (не се рендваше никъде); премахнати `Icon: ...` от всеки елемент на `NAV_ITEMS` и вече неизползваният `lucide-react` import `{ Calendar, BarChart3, Folder, Archive }` — виж бележка по-долу |

**Находка при чистенето — не е бъг:** `Icon` в `NAV_ITEMS`/`handleDragOver` изглеждаше
като пропусната икона в долното меню (виж скрийншот при проверка), но `git log -p`
показва, че `<Icon className="w-5 h-5" />` е бил **нарочно** премахнат от бутона в
commit `6acfae4` („надписи", 2026-07-03) — менюто е текст-само по дизайн от месеци.
Останало е само мъртвото `Icon` destructuring/import, сега изчистено.

**Съзнателно НЕ пипнато** (по-висок риск от истинска регресия — виж раздел 6):
`App.jsx` ефектът за авто-генериране на задачи (`setState` в `useEffect`) и всички
`exhaustive-deps` предупреждения — dependency масивите им са **нарочно** орязани
(напр. `[dataLoaded, activeProfileId]` вместо `data.tasks`/`data.habits`), защото
самите ефекти пишат в `data` — добавянето на „липсващите“ dependencies по буквалната
препоръка на ESLint би довело до безкраен цикъл генериране→запис→нов тригер. Също
непипнато: `DateInput.jsx` (`setState` в ефект — компонентът нарочно поддържа два
едновременни инстанса на един екран, вижте раздел 2).

**Проверка:** `npm run build` минава. `npm run lint` — 22 → 2 грешки (0 нови), 7
предупреждения непроменени (нарочно). Ръчно в браузър: нова задача пак получава
случаен цвят коректно (lazy initializer работи идентично на преди); долното меню
изглежда идентично (текст без икони, както от 2026-07-03).

### 2026-09-11 — Екран „Днес": деня от седмицата под датата

**Какво:** под голямата дата в заглавието на екран „Днес" вече се вижда деликатно
(малък сив текст) пълното име на деня от седмицата — напр. „11 септември 2026" /
„петък".

| Файл | Промяна |
|------|---------|
| `src/utils/dateUtils.js` | нов `WEEKDAY_NAMES_BG_FULL` (пълни имена, индексирани по `Date.getDay()`: 0=неделя…6=събота) и helper `getWeekdayNameBG(date)` |
| `src/components/today/TodayScreen.jsx` | под `<h2>` с датата е добавен `<span className="text-xs text-gray-500">{getWeekdayNameBG(selectedDate)}</span>`, обновява се автоматично при смяна на деня |
| `src/components/ui/HelpModal.jsx` | точка „Навигация" в раздел „Днес" — добавено изречение, че под датата се вижда деня от седмицата |

**Проверка:** `npm run build` минава. `npm run lint` — без нови грешки (само отпреди
съществуващите в други файлове). Ръчно в браузър: 11.09.2026 → „петък“, 12.09.2026 →
„събота“ (обновява се коректно при навигация със стрелките).

### 2026-09-07 — Еднократните задачи с цветовете на обикновените

**Какво:** редът на еднократна задача в „Днес“ вече не е с жълт фон. Използва **същата**
цветова логика като картата на навик — фонът се променя според етапа на изпълнение по
идентичен начин.

**Как:** `TodoRow` вика `getCalendarDayState(new Date(\`${dateStr}T00:00:00\`), todo, null)`
(правило = `null`; за todo датата не влияе — минава се само „обикновен ден“). От резултата
се смятат `isLight` / `textColor` / `statusColor` / `bgClass` / `bgStyle` с точно същите
изрази като в `TodayScreen` за навик (вкл. gradient и `bg-white` през inline `style`).

| Състояние | Навик | Еднократна (сега) |
|-----------|-------|-------------------|
| pending | `bg-gray-50` (C1) | `bg-gray-50` (C3) |
| частични completions | `bg-green-300` (C8) | `bg-green-300` (C8) |
| частични подзадачи | gradient бяло→`green-300` (C10) | същото (C10) |
| неактивна | сива заключена карта | сива заключена карта (без промяна) |

| Файл | Промяна |
|------|---------|
| `src/components/today/TodoRow.jsx` | нов импорт `getCalendarDayState`; блок с `dayState` + `isLight`/`textColor`/`statusColor`/`bgClass`/`bgStyle`; картата вече е `w-full ${bgClass} … style={bgStyle}` (махнати `border` + `from-amber-50/to-yellow-50/border-amber-200`); `<h3>` и статус-редът ползват `textColor`/`statusColor`; прогрес-балонът — `${isLight ? 'bg-white' : 'bg-white bg-opacity-80'}`; етикетът „ЕДНОКРАТНА“ е неутрален (`bg-white/80 text-gray-600` вместо `amber`) |
| `src/components/today/TodoRow.jsx` (2) | при пълно изпълнение класът е само `animate-todo-done` (махнат `line-through`) — анимацията „изчезва“ вече е без задраскване, като при навик |
| `src/components/ui/HelpModal.jsx` | секция „📝 Еднократни задачи“ — уточнено, че редът има същите цветове като обикновените карти (жълтият фон отпадна); точка „При изпълнение“ — „плавно изчезва“ вместо „задрасква се“ |

**Проверка:** `npm run build` минава; `npm run lint` — чисто за `TodoRow.jsx`. Ръчно в
браузър: todo „3 пъти“ pending е сиво като навик; след 1 отмятане → `bg-green-300` и
„1/3“ (DOM-клас идентичен на навик); todo с 1/2 подзадачи → бяло→зелен gradient през
inline `style`; неактивна todo — без промяна.

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
Клонът за пълно изпълнение (анимация „изчезва“ + toast „Върни“ + конфети) е непроменен.
Прозорецът за действия на **неактивна** еднократна задача вече е плътен (както при
навиците), а не полупрозрачен. Неактивните редове за повторение / подзадача **навсякъде**
(прозорецът за действия + секция „Активност“ в `HabitModal` / `TodoModal`) вече се
различават само по цвят — без задраскване. (`line-through` в UI на задачите вече не се
ползва — остана само за „Вече завършено“ в `MakeupPicker`.)

**Уточнение на затварянето при „⏸/▶“** *(същия ден, след обратна връзка):* първо
прозорецът се затваряше само при „▶ Върни активно“, а всяко „⏸“ го оставяше отворено.
Крайното поведение: остава отворен **само** при „⏸ Направи задачата неактивна“
(`scope === 'task'`, посока ⏸) — единственият случай с важен надпис за четене; „⏸“ на
отделно повторение/подзадача и всяко „▶“ затварят (`const keepOpen = scope === 'task'
&& !reactivating`). Виж раздел 4.8, „Затваряне на прозореца за действия при това
превключване“.

**Проверка:** `npm run build` минава. `npm run lint` — без нови грешки (само отпреди
съществуващите в други файлове). Ръчно в браузър: еднократна задача „3 пъти“ — отмятане
на 1 път затваря прозореца и редът става „1/3 · В процес“; „Отбележи като изпълнено“
пуска конфети, затваря прозореца и маха реда; „⏸“ на подзадача оставя прозореца отворен,
„▶“ го затваря — проверено и за еднократна задача, и за навик (през `DayModal` в „Днес“).
Крайно (след уточнението): „⏸“ на подзадача/повторение **затваря** прозореца; само „⏸
Направи задачата неактивна“ (цялата) го оставя отворен с надписа; „▶ Върни като активна“
затваря. Прозорецът на неактивна еднократна задача е плътен (проверено визуално).

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
- Еднократните задачи имаха дискретен маркер (жълт фон + етикет), за да е ясно защо
  изчезват при отмятане. *(По-късно същия ден жълтият фон отпадна — виж записа
  „Еднократните задачи с цветовете на обикновените" по-долу; остана само етикетът.)*
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

**Ако вместо стара версия излиза съвсем бял екран** (не помага и затваряне/отваряне
1–2 пъти) — това вече не е кеш проблем, а грешка при рендиране в реалните данни на
устройството (виж `ErrorBoundary` по-долу). От 2026-09-14 такава грешка вече се
показва на екрана с текста ѝ вместо бяло — изпрати го, за да се открие причината.

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
| Звукови ефекти (нови звуци, къде се пускат, превключвател, качване на файл) | `utils/sounds.js` (`SOUND_DEFS`), `utils/storage.js` (`customSound_*`), `today/TaskActions.jsx`, `today/TodayScreen.jsx`, `today/TodoRow.jsx`, `habits/HabitsScreen.jsx`, `habits/ArchiveScreen.jsx`, `settings/SettingsModal.jsx` |
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
