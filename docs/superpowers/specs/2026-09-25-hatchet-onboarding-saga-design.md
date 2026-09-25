# Learning-проект: сага онбординга на Hatchet (Person + Profile)

Дата: 2026-09-25
Статус: дизайн утверждён, план не написан

## 1. Цель

Учебный проект. Цель — не продукт, а понимание модели Hatchet на живом
примере: workflow и задачи, воркеры, durable-ожидание события, ретраи,
идемпотентность, таймауты, чтение и перезапуск ранов в UI.

Домен выбран минимальный: два независимых сервиса, между которыми есть
шаг, естественно занимающий неопределённое время (пользователь ушёл
заполнять профиль и может вернуться через сутки). Именно этот шаг
оправдывает оркестратор — без него хватило бы обычного HTTP-вызова.

### Критерии успеха

1. Флоу работает end-to-end локально одной командой.
2. Владелец проекта может открыть Hatchet UI, найти ран, объяснить
   каждый его шаг, перезапустить упавший.
3. Владелец может объяснить, почему одно направление связи сделано
   HTTP-вызовом, а обратное — событием.
4. Специально убитый воркер во время ожидания профиля не ломает флоу:
   после рестарта сага продолжается.

### Не входит в объём

JWT и реальные сессии, отправка почты, продовый деплой, мультитенантность,
CI, авторизация межсервисных вызовов сложнее общего секрета в заголовке.

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
  contracts/  типы событий и DTO, общие для двух сервисов
infra/
  postgres-init/01-create-dbs.sql                   (уже есть)
docker-compose.hatchet.yml                          (уже есть)
docker-compose.apps.yml                             (появится на этапе 10)
```

`apps/person` и `apps/profile` живут в Nest-монорепо (`nest-cli.json`,
два `projects`). `apps/web` в этот монорепо не входит — он не
Nest-приложение и собирается своим Vite.

`libs/contracts` содержит **только** типы: имена событий, zod-схемы их
payload, DTO межсервисного API. Никакого общего Prisma-клиента и
никаких обращений к чужой базе.

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

OutboxEvent {
  id          String    @id @default(uuid())
  key         String
  payload     Json
  createdAt   DateTime  @default(now())
  publishedAt DateTime?
}
```

Единственная связь между базами — строка `personId`. Никаких внешних
ключей через границу сервиса.

`ProfileLink.personId @unique` — это не украшение, а механизм
идемпотентности: повторный вызов создания ссылки делает `upsert` и
возвращает тот же токен, поэтому ретрай шага саги безопасен.

## 5. Сага `person-onboarding`

Живёт на воркере Person. Объявляется как `hatchet.workflow(...)`,
шаги — `.task(...)` и `.durableTask(...)` со связями через `parents`.

Вход: `{ personId: string, email: string }`.

| Шаг | Тип | Родитель | Действие |
| --- | --- | --- | --- |
| `createProfileLink` | task, `retries: 5`, экспоненциальный backoff | — | HTTP `POST` в Profile `/internal/links`, возвращает `{ token, profileUrl }` |
| `awaitProfile` | durableTask, `executionTimeout: 25h` | `createProfileLink` | `ctx.waitForEvent(...)`, см. ниже |
| `markProfileCompleted` | task | `awaitProfile` | локальный `UPDATE person SET isProfileCompleted = true` |
| `sendWelcome` | task | `markProfileCompleted` | заглушка-лог |
| `sendReminder` | task | `awaitProfile` | заглушка-лог, работает только при `timedOut` |

Ветка таймаута: `awaitProfile` возвращает `{ timedOut: true }`, если
ожидание истекло; `markProfileCompleted` и `sendWelcome` в этом случае
завершаются no-op, а отдельный шаг `sendReminder` (parent `awaitProfile`)
пишет лог. Условное выполнение — через проверку выхода родителя внутри
`fn`, а не через `waitFor`-условия: для DAG из четырёх шагов это проще
и нагляднее.

### Ожидание события

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
может заполнить профиль раньше, чем сага дойдёт до `awaitProfile`
(например, воркер в этот момент перезапускался). Событие уйдёт в
пустоту, и сага провисит до таймаута. С окном просмотра назад
`waitForEvent` увидит уже опубликованное событие и продолжит сразу.

### Направления связи

Person → Profile (`createProfileLink`) — синхронный HTTP-вызов с
ретраями внутри задачи Hatchet.

Profile → Person (`profile.completed`) — событие через Hatchet.

Так сделано намеренно: за один проект видны оба стиля и разница между
ними. Первый требует, чтобы вызываемый был живой и идемпотентный; второй
развязывает сервисы во времени, но приносит at-least-once и проблему
«запись в БД прошла, публикация события — нет».

## 6. Потоки

### Регистрация

1. `POST person:/register { email, password }`.
2. Person: argon2id-хеш, `INSERT person`.
3. `hatchet.runNoWait(personOnboarding, { personId, email })` → `runId`,
   сохраняется в `Person.onboardingRunId`.
4. Ответ `202 { runId }`.
5. Фронт поллит `GET person:/registrations/:runId`.
6. Person вызывает `hatchet.runs.getDetails(runId)` и читает
   `taskRuns['createProfileLink'].output.profileUrl`. Пока шаг не
   завершён — отдаёт `{ status: 'pending' }`.

Тип `RunDetail` из SDK: `{ status, done, input, additionalMetadata,
isEvicted, taskRuns: Record<string, { externalId, readableId, status,
output, error?, isEvicted }> }`.

### Заполнение профиля

1. `GET profile:/profiles/:token` — валидация токена, отдаёт пустую
   форму или 410, если `usedAt` или `expiresAt` в прошлом.
2. `POST profile:/profiles/:token { firstName, lastName, city }`.
3. Одна транзакция Prisma: проверка токена → `upsert Profile` →
   `usedAt = now()` → `INSERT OutboxEvent { key: 'profile.completed' }`.
4. Ответ `200`.
5. Публикатор (см. ниже) забирает строку outbox и делает
   `hatchet.events.push('profile.completed', { personId, profileId })`
   со scope `person:<personId>`, затем проставляет `publishedAt`.
6. Сага просыпается, `isProfileCompleted` становится `true`.

### Публикатор outbox

Cron-workflow Hatchet на воркере Profile, раз в 5 секунд: выбирает до 50
строк с `publishedAt IS NULL`, публикует каждую, проставляет
`publishedAt`. Падение между push и апдейтом даёт дубль события — это
нормально и покрыто идемпотентностью `markProfileCompleted`.

## 7. HTTP-контракты

### Person (`:3001`)

- `POST /register` → `202 { runId }`; `409`, если email занят.
- `GET /registrations/:runId` → `{ status: 'pending' | 'ready',
  profileUrl?, isProfileCompleted }`.
- `GET /persons/:id` → `{ id, email, isProfileCompleted }`.
- `GET /health`.

### Profile (`:3002`)

- `POST /internal/links { personId }` → `{ token, profileUrl }`.
  Идемпотентен. Защищён заголовком `x-internal-secret`.
- `GET /profiles/:token` → `{ personId }` или `410`.
- `POST /profiles/:token { firstName, lastName, city }` → `200`.
- `GET /health`.

## 8. Отказоустойчивость

| Отказ | Что происходит |
| --- | --- |
| Profile лежит в момент `createProfileLink` | 5 ретраев с backoff; ран виден в UI как retrying |
| Двойной вызов `POST /internal/links` | upsert по `personId @unique`, тот же токен |
| Воркер Person убит во время ожидания профиля | durable-состояние в Hatchet, после рестарта сага продолжается |
| Событие пришло раньше `awaitProfile` | ловится `lookbackWindow: '25h'` |
| Дубль `profile.completed` | `markProfileCompleted` — безусловный идемпотентный UPDATE |
| Профиль сохранён, событие не опубликовано | строка в outbox остаётся, публикатор дошлёт |
| Пользователь не заполнил профиль за 25 часов | `awaitProfile` возвращает `timedOut`, срабатывает `sendReminder` |
| Сага упала окончательно | ран красный в UI, `hatchet.runs.replay` или кнопка в интерфейсе |

## 9. Тестирование

- Unit (Jest): хеширование argon2, генерация и валидация токена ссылки,
  идемпотентность `markProfileCompleted`, маппинг `RunDetail` →
  ответ `/registrations/:runId`.
- Интеграционный: Profile против реального Postgres из compose —
  транзакция «профиль + outbox» атомарна, повторный `POST` по
  использованному токену даёт 410.
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
2. Profile: ссылки и сохранение профиля, без Hatchet.
3. Первый воркер и `hatchet.task` «hello» — увидеть ран в UI :8888.
   Акцент: воркер, слоты, где живёт код задачи, как читать UI.
4. Шаг `createProfileLink`. Акцент: ретраи, backoff, идемпотентность,
   что происходит при лежащем Profile.
5. `awaitProfile` — durable-ожидание. Главный этап. Акцент: durable
   против обычной задачи, гонка и `lookbackWindow`, убийство воркера
   на середине ожидания.
6. Публикация `profile.completed`. Сначала наивно, прямо из хендлера;
   затем воспроизводим потерю события; затем чиним outbox-публикатором.
   Акцент: at-least-once, transactional outbox, идемпотентные
   потребители.
7. Ветка таймаута `sendReminder` и хвост `sendWelcome`. Акцент:
   условные пути и время как первоклассный вход.
8. React: регистрация, поллинг ссылки, форма профиля, страница статуса.
9. Наблюдаемость: чтение UI, `runs.replay`, логи задач,
   `additionalMetadata` для поиска рана по `personId`.
10. Тесты и `docker-compose.apps.yml` — всё поднимается одной командой.

## 11. Проверенные факты об API Hatchet

Сверено с типами `@hatchet-dev/typescript-sdk@1.33.2`, не по памяти.

- `hatchet.workflow(opts)` → декларация; `.task(opts)`,
  `.durableTask(opts)` с `parents`, `retries`, `backoff`,
  `executionTimeout`.
- `hatchet.task(opts)` / `hatchet.durableTask(opts)` — одиночная задача
  как самостоятельный workflow.
- `hatchet.worker(name, { workflows: [...] })` → `Worker`, затем
  `.start()`.
- `hatchet.events.push<T>(key, payload, options?)`.
- `DurableContext.waitForEvent(key, expression?, payloadSchema?, scope?,
  lookbackWindow?, label?)`; `sleepFor`, `sleepUntil`, `now()`.
- `hatchet.runs.getDetails(runId)` → `RunDetail` с `taskRuns` по
  `readableId`; также `get`, `get_status`, `list`, `cancel`, `replay`.
- CEL-выражения ссылаются на payload события как `input.<field>`.
