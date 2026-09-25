# Learning-проект: сага онбординга на Hatchet (Person + Profile)

Дата: 2026-09-25
Статус: дизайн утверждён, план не написан
Ревизия 2: владение задачами распределено между двумя воркерами (см. §5)

## 1. Цель

Учебный проект. Цель — не продукт, а понимание модели Hatchet на живом
примере: workflow и задачи, воркеры и владение задачами,
durable-ожидание события, ретраи, идемпотентность, таймауты, чтение и
перезапуск ранов в UI.

Домен выбран минимальный: два независимых сервиса, между которыми есть
шаг, естественно занимающий неопределённое время (пользователь ушёл
заполнять профиль и может вернуться через сутки). Именно этот шаг
оправдывает оркестратор — без него хватило бы обычного HTTP-вызова.

### Критерии успеха

1. Флоу работает end-to-end локально одной командой.
2. Владелец проекта может открыть Hatchet UI, найти ран, объяснить
   каждый его шаг, перезапустить упавший.
3. Владелец может объяснить, почему одни шаги саги исполняет воркер
   Person, а другие — воркер Profile, и почему связь в одну сторону
   сделана HTTP-вызовом, а в другую — событием.
4. Специально убитый воркер Profile во время ожидания профиля не ломает
   флоу: после рестарта сага продолжается с того же места.

### Не входит в объём

JWT и реальные сессии, отправка почты, продовый деплой,
мультитенантность, CI, авторизация межсервисных вызовов сложнее общего
секрета в заголовке.

## 2. Стек

Версии проверены в npm-реестре на 2026-09-25.

| Компонент | Версия |
| --- | --- |
| `@nestjs/core` и остальные `@nestjs/*` | 12.1.0 |
| `prisma` / `@prisma/client` | 7.10.0 (8.0 ещё rc — не берём) |
| `typescript` | 6.0.3 |
| `@hatchet-dev/typescript-sdk` | 1.33.2 |
| `argon2` | 0.45.1 |
| React + Vite | актуальные на момент старта |
| PostgreSQL | 17 (уже в compose) |
| Hatchet Lite | `ghcr.io/hatchet-dev/hatchet/hatchet-lite:latest` |

Пароли — argon2id. JWT нет: после регистрации фронт получает `runId` и
работает по нему.

## 3. Структура репозитория

```
apps/
  person/     NestJS-приложение + воркер Hatchet   :3001  db person
  profile/    NestJS-приложение + воркер Hatchet   :3002  db profile
  web/        React + Vite                          :5173
libs/
  contracts/  общая декларация саги, имена шагов и событий, zod-схемы
infra/
  postgres-init/01-create-dbs.sql                   (уже есть)
docker-compose.hatchet.yml                          (уже есть)
docker-compose.apps.yml                             (появится на этапе 10)
```

`apps/person` и `apps/profile` живут в Nest-монорепо (`nest-cli.json`,
два `projects`). `apps/web` в этот монорепо не входит — он не
Nest-приложение и собирается своим Vite.

`libs/contracts` — ключевой элемент новой ревизии. Он содержит:

- имена workflow, шагов и событий как константы;
- zod-схемы входа саги и payload события;
- **общий билдер декларации** `buildOnboardingWorkflow(hatchet, impls)`,
  где `impls` — частичный набор реализаций шагов. Оба сервиса зовут
  один и тот же билдер, поэтому форма DAG у них гарантированно
  одинаковая; каждый передаёт только свои `fn`, а чужие шаги получают
  заглушку `NOT_MY_STEP`. Кто какой шаг реально исполняет, решают метки
  воркеров (§5), а не состав `impls`.

Чего в `libs/contracts` нет: Prisma-клиентов, доступа к базам, любой
доменной логики. Только форма саги и типы на её границах.

Каждый сервис держит свою `prisma/schema.prisma` и свой сгенерированный
клиент.

## 4. Модель данных

### База `person`

```
Person {
  id                 String   @id @default(uuid())
  email              String   @unique
  passwordHash       String
  isProfileCompleted Boolean  @default(false)
  onboardingRunId    String?
  createdAt          DateTime @default(now())
}
```

### База `profile`

```
ProfileLink {
  token      String    @id
  personId   String    @unique
  expiresAt  DateTime
  usedAt     DateTime?
}

Profile {
  id          String   @id @default(uuid())
  personId    String   @unique
  firstName   String
  lastName    String
  city        String
  completedAt DateTime @default(now())
}
```

Таблицы `OutboxEvent` больше нет — см. §6, причина в том, что запись
профиля переехала внутрь задачи саги.

Единственная связь между базами — строка `personId`. Никаких внешних
ключей через границу сервиса.

`ProfileLink.personId @unique` — механизм идемпотентности: повторный
вызов создания ссылки делает `upsert` и возвращает тот же токен,
поэтому ретрай шага саги безопасен.

Именование: везде `personId`, не `userId`. В выброшенной пробе из
прошлой сессии было `userId` — при переносе идей переименовать.

## 5. Сага `person-onboarding`

Один workflow, но **его шаги исполняют два разных воркера в двух разных
процессах**. Каждый шаг исполняет тот сервис, которому принадлежат
данные этого шага.

Вход: `{ personId: string, email: string }`.

| Шаг | Владелец | Тип | Родитель | Действие |
| --- | --- | --- | --- | --- |
| `issue-onboarding-link` | person | task, `retries: 5`, backoff | — | HTTP `POST` в Profile `/internal/links`, возвращает `{ token, profileUrl }` |
| `await-and-save-profile` | profile | durableTask, `executionTimeout: 25h` | `issue-onboarding-link` | ждёт событие, пишет `Profile` в свою базу, возвращает `{ profileId }` или `{ timedOut: true }` |
| `mark-profile-completed` | person | task | `await-and-save-profile` | `UPDATE person SET isProfileCompleted = true`; no-op при `timedOut` |
| `send-reminder` | person | task | `await-and-save-profile` | заглушка-лог, работает только при `timedOut` |
| `send-welcome` | person | task | `mark-profile-completed` | заглушка-лог |

Ветвление по таймауту — проверкой выхода родителя внутри `fn`, а не
через `waitFor`-условия: для DAG из пяти шагов это проще и нагляднее.

### Механизм владения: обязательные метки воркеров

**Оба воркера регистрируют один и тот же полный DAG.** Форма саги у них
идентична, потому что строится одним билдером из `libs/contracts`, —
конфликта определений на сервере нет.

Маршрутизация решается отдельно, метками. Каждая задача объявляет,
воркер с какой меткой ей нужен:

```ts
// на задаче
desiredWorkerLabels: { service: { value: 'profile', required: true } }

// на воркере
await hatchet.worker('profile-worker', {
  labels: { service: 'profile' },
  workflows: [onboarding],
});
```

`required: true` — жёсткий фильтр, а не предпочтение: задачу не отдадут
воркеру без подходящей метки. Сверено с типами SDK 1.33.2:
`CreateWorkerOpts.labels?: WorkerLabels` и
`desiredWorkerLabels?: Record<string, { value, required?, weight?,
comparator? }>`.

Каждая задача из таблицы выше получает метку своего владельца.

**Подстраховка от тихой ошибки.** Билдер принимает частичный набор
реализаций: `buildOnboardingWorkflow(hatchet, impls)`. Для шага, которого
нет в `impls`, подставляется заглушка, немедленно бросающая
`NOT_MY_STEP: <имя шага>`. Если метки почему-то не сработают и задача
уедет не туда, ран упадёт с внятной ошибкой в UI вместо того, чтобы
молча сделать не то.

**Ворота на этапе 3.** Механизм штатный, но увидеть его работающим надо
до всякой доменной логики. Этап 3 — три пустых шага, два процесса,
проверка: каждый шаг исполнил свой воркер, `NOT_MY_STEP` не выброшен ни
разу. Пока не зелено — дальше не идём.

**Запасные варианты**, если метки поведут себя не так:

1. **Частичная регистрация DAG.** Каждый воркер регистрирует только свои
   шаги. Может сработать, но не подтверждено, и есть риск, что воркеры
   будут перезаписывать определение workflow друг у друга.
2. **Дочерний workflow.** Person-сага на шаге ожидания порождает
   дочерний workflow, целиком принадлежащий Profile, и ждёт его
   результата. Граница сервисов даже чётче, цена — два рана в UI
   вместо одного.
3. **Откат к ревизии 1** — вся сага на воркере Person, Profile общается
   с ней только событием, запись профиля в HTTP-хендлере, дуальная
   запись лечится transactional outbox.

Любой вариант оставляет проект учебно полноценным.

### Ожидание события (внутри `await-and-save-profile`)

```ts
const event = await ctx.waitForEvent(
  'profile.completed',
  `input.personId == '${input.personId}'`,
  profileCompletedSchema,          // zod, из libs/contracts
  `person:${input.personId}`,      // scope
  '25h',                           // lookbackWindow
);
```

Сигнатура сверена с типами SDK 1.33.2:
`waitForEvent(key, expression?, payloadSchema?, scope?, lookbackWindow?, label?)`.

`lookbackWindow` обязателен. Без него есть реальная гонка: пользователь
может нажать «сохранить» раньше, чем сага дойдёт до ожидания (например,
воркер в этот момент перезапускался). Событие уйдёт в пустоту, и сага
провисит до таймаута. С окном просмотра назад `waitForEvent` увидит уже
опубликованное событие и продолжит сразу.

### Почему две стороны связаны по-разному

Person → Profile (`issue-onboarding-link`) — синхронный HTTP-вызов с
ретраями внутри задачи Hatchet. Требует, чтобы вызываемый был живой и
идемпотентный.

Пользователь → сага (`profile.completed`) — событие. Развязывает во
времени: человек может вернуться через сутки.

Это сделано намеренно: за один проект видны оба стиля и цена каждого.

## 6. Потоки

### Регистрация

1. `POST person:/register { email, password }`.
2. Person: argon2id-хеш, `INSERT person`.
3. `hatchet.runNoWait(personOnboarding, { personId, email })` → `runId`,
   сохраняется в `Person.onboardingRunId`.
4. Ответ `202 { runId }`.
5. Фронт поллит `GET person:/registrations/:runId`.
6. Person вызывает `hatchet.runs.getDetails(runId)` и читает
   `taskRuns['issue-onboarding-link'].output.profileUrl`. Пока шаг не
   завершён — отдаёт `{ status: 'pending' }`.

Тип `RunDetail` из SDK: `{ status, done, input, additionalMetadata,
isEvicted, taskRuns: Record<string, { externalId, readableId, status,
output, error?, isEvicted }> }`.

### Заполнение профиля

1. `GET profile:/profiles/:token` — валидация токена (чтение), отдаёт
   `{ personId }` или `410`, если `usedAt` или `expiresAt` в прошлом.
2. `POST profile:/profiles/:token { firstName, lastName, city }`.
3. Хендлер **ничего не пишет в базу**. Он валидирует токен, валидирует
   тело и делает `hatchet.events.push('profile.completed', { personId,
   firstName, lastName, city }, { scope: 'person:<personId>' })`.
4. Ответ `202 { runId }` — тот же ран онбординга, фронт продолжает его
   поллить.
5. Задача `await-and-save-profile` на воркере Profile просыпается, в
   одной транзакции делает `upsert Profile` и проставляет
   `ProfileLink.usedAt`, возвращает `{ profileId }`.
6. Шаг `mark-profile-completed` на воркере Person ставит флаг.

### Почему исчез outbox

В ревизии 1 HTTP-хендлер Profile писал профиль в свою базу **и** должен
был опубликовать событие. Две записи в две разные системы без общей
транзакции — классическая дуальная запись: упали между ними, и профиль
сохранён, а сага висит вечно. Лечилось это transactional outbox:
событие пишется в ту же транзакцию, отдельный публикатор его дошлёт.

В ревизии 2 хендлер не пишет в базу вообще. Единственный писатель
профиля — задача саги, и она пишет **после** того, как Hatchet уже
принял событие. Осталась ровно одна запись в одном месте, дуальной
записи нет, outbox не нужен.

Цена: `POST /profiles/:token` больше не подтверждает сохранение
синхронно, он подтверждает приём. Для учебного проекта это честный
размен и повод один раз подумать, чем «принято» отличается от
«сохранено».

At-least-once никуда не делся: событие может прийти дважды. Поэтому
`upsert` по `personId @unique` в `await-and-save-profile` и безусловный
идемпотентный UPDATE в `mark-profile-completed`.

Outbox остаётся в спеке как разобранная альтернатива — на этапе 6 его
стоит проговорить и воспроизвести проблему, которую он решает, даже не
внедряя.

## 7. HTTP-контракты

### Person (`:3001`)

- `POST /register` → `202 { runId }`; `409`, если email занят.
- `GET /registrations/:runId` → `{ status: 'pending' | 'linkReady' |
  'completed' | 'failed', profileUrl?, isProfileCompleted }`.
- `GET /persons/:id` → `{ id, email, isProfileCompleted }`.
- `GET /health`.

### Profile (`:3002`)

- `POST /internal/links { personId }` → `{ token, profileUrl }`.
  Идемпотентен. Защищён заголовком `x-internal-secret`.
- `GET /profiles/:token` → `{ personId }` или `410`.
- `POST /profiles/:token { firstName, lastName, city }` → `202`.
- `GET /health`.

## 8. Отказоустойчивость

| Отказ | Что происходит |
| --- | --- |
| Profile лежит в момент `issue-onboarding-link` | 5 ретраев с backoff; ран виден в UI как retrying |
| Двойной вызов `POST /internal/links` | upsert по `personId @unique`, тот же токен |
| Воркер Profile убит во время ожидания профиля | durable-состояние в Hatchet, после рестарта задача продолжается |
| Воркер Person убит, пока Profile ждёт | не мешает: шаги person ещё не начинались |
| Событие пришло раньше, чем сага дошла до ожидания | ловится `lookbackWindow: '25h'` |
| Дубль `profile.completed` | `upsert` профиля + идемпотентный UPDATE флага |
| Пользователь не заполнил профиль за 25 часов | шаг возвращает `timedOut`, срабатывает `send-reminder` |
| Сага упала окончательно | ран красный в UI, `hatchet.runs.replay` или кнопка в интерфейсе |
| Durable-задача вытеснена (`isEvicted`) | `hatchet.runs.restoreTask(taskExternalId)`; разбирается на этапе 9 |

## 9. Тестирование

- Unit (Jest): хеширование argon2, генерация и валидация токена ссылки,
  идемпотентность `mark-profile-completed`, маппинг `RunDetail` →
  ответ `/registrations/:runId`.
- Интеграционный: Profile против реального Postgres из compose —
  `upsert` профиля идемпотентен, повторный `POST` по использованному
  токену даёт 410.
- Проба владения (этап 3), превращённая в постоянный тест: каждый шаг
  исполнил свой воркер.
- E2E-скрипт: регистрация → дождаться `profileUrl` → отправить профиль →
  дождаться `isProfileCompleted === true`. Гоняется против поднятого
  compose, включая настоящий Hatchet Lite.
- Моки Hatchet не пишем: учебный проект, реальный оркестратор под рукой,
  и половина смысла — смотреть на его поведение.

## 10. Этапы

Каждый этап заканчивается чем-то работающим и имеет учебный акцент.
Детализация — в плане реализации.

0. Скелет монорепо, версии, `.env`, health-чеки. Hatchet ещё не трогаем.
1. Person: регистрация, argon2, Prisma, миграции.
2. Profile: ссылки и валидация токена, без Hatchet.
3. **Ворота владения.** Первый воркер, три пустых шага, два процесса,
   метки. Акцент: воркер, регистрация задач, маршрутизация по меткам,
   чтение UI. Пока проба не зелёная — дальше не идём, выбираем запасной
   вариант из §5.
4. `issue-onboarding-link`. Акцент: ретраи, backoff, идемпотентность,
   поведение при лежащем Profile.
5. `await-and-save-profile` — durable-ожидание плюс запись. Главный
   этап. Акцент: durable против обычной задачи, гонка и
   `lookbackWindow`, убийство воркера Profile на середине ожидания.
6. Кто владеет записью. Проговариваем наивный вариант (запись в
   хендлере + push), воспроизводим дуальную запись, разбираем outbox
   как классическое лечение и почему в нашей схеме он не нужен.
7. Ветка таймаута `send-reminder` и хвост `send-welcome`. Акцент:
   условные пути и время как первоклассный вход.
8. React: регистрация, поллинг ссылки, форма профиля, страница статуса.
9. Наблюдаемость: чтение UI, `runs.replay`, логи задач,
   `additionalMetadata` для поиска рана по `personId`, эвикция и
   `restoreTask`.
10. Тесты и `docker-compose.apps.yml` — всё поднимается одной командой.

## 11. Проверенные факты об API Hatchet

Сверено с типами `@hatchet-dev/typescript-sdk@1.33.2`, не по памяти.

- `hatchet.workflow(opts)` → декларация; `.task(opts)`,
  `.durableTask(opts)` с `parents`, `retries`, `backoff`,
  `executionTimeout`.
- `hatchet.task(opts)` / `hatchet.durableTask(opts)` — одиночная задача
  как самостоятельный workflow.
- `hatchet.worker(name, { workflows: [...], labels? })` → `Worker`,
  затем `.start()`. `CreateWorkerOpts.labels?: WorkerLabels`.
- На задаче: `desiredWorkerLabels?: Record<string, { value: string |
  number, required?: boolean, weight?: number, comparator? }>` —
  `required: true` даёт жёсткую привязку задачи к воркеру.
- `hatchet.events.push<T>(key, payload, options?)`.
- `DurableContext.waitForEvent(key, expression?, payloadSchema?, scope?,
  lookbackWindow?, label?)`; `sleepFor`, `sleepUntil`, `now()`.
- `hatchet.runs.getDetails(runId)` → `RunDetail` с `taskRuns` по
  `readableId`; также `get`, `get_status`, `list`, `cancel`, `replay`,
  `restoreTask`, `branchDurableTask`, `subscribeToStream`.
- CEL-выражения ссылаются на payload события как `input.<field>`.

Вынесено в ворота этапа 3 (механизм штатный, но должен быть увиден
работающим): маршрутизация шагов саги по обязательным меткам воркеров
(§5).
