# Сага онбординга на Hatchet — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Собрать учебный проект, в котором один Hatchet-workflow
оркеструет два независимых NestJS-сервиса: Person регистрирует
пользователя и выдаёт ссылку, Profile durable-ждёт заполнения профиля и
сохраняет его, Person проставляет флаг.

**Architecture:** Один DAG `person-onboarding` из пяти шагов. Оба
воркера регистрируют одинаковую декларацию из `libs/contracts`, а
маршрутизация шагов к владельцу делается обязательными метками
(`desiredWorkerLabels` + `labels` воркера). Ожидание человека —
durable-задача на воркере Profile, она же единственный писатель
профиля, поэтому дуальной записи и outbox в проекте нет.

**Tech Stack:** NestJS 12.1.0, Prisma 7.10.0, TypeScript 6.0.3,
`@hatchet-dev/typescript-sdk` 1.33.2, argon2 0.45.1, React + Vite,
PostgreSQL 17, Hatchet Lite в Docker.

**Spec:** `docs/superpowers/specs/2026-09-25-hatchet-onboarding-saga-design.md`

## Как читать этот план

Проект учебный. У каждого этапа есть две служебные строки:

- **Учебный акцент** — ради чего этап существует. Если этап прошёл, а
  акцент не понят, этап не пройден.
- **Кто пишет** — значение по умолчанию: `ты` / `я` / `вместе`. На
  старте любого этапа можно переиграть одной фразой.

Тесты и конфиги в плане приведены кодом целиком: тест — это определение
правильного, без него шаг не проверяем. Реализация хатчетовских кусков
задана сигнатурами и требованиями, а не готовым кодом, — намеренно, это
и есть материал для изучения.

Этапы с пометкой **ЛОМАЕМ РУКАМИ** содержат обязательный шаг, где
что-то выключается или убивается. Их нельзя пропускать: половина
понимания Hatchet приходит из наблюдения за отказом.

## Global Constraints

- `@nestjs/*` 12.1.0; `prisma` и `@prisma/client` 7.10.0 (8.x — rc, не
  брать); `typescript` 6.0.3; `@hatchet-dev/typescript-sdk` 1.33.2;
  `argon2` 0.45.1.
- Имя идентификатора пользователя везде `personId`. Никогда `userId`.
- Никакого JWT и сессий. После регистрации фронт оперирует `runId`.
- Ни один сервис не обращается к базе другого. Общее между базами —
  только строка `personId`, без внешних ключей.
- В `libs/contracts` нет Prisma, нет доступа к БД, нет доменной логики —
  только форма саги, константы имён и zod-схемы.
- Пароли — argon2id, через библиотеку `argon2`, никогда не в логах и не
  в ответах API.
- У каждого шага саги есть `desiredWorkerLabels` с `required: true`.
  Шаг без метки — ошибка ревью.
- Тест-раннер — **vitest** (NestJS 12 генерирует его вместо jest).
  `*.spec.ts` идут в `npm test`, `*.e2e-spec.ts` — в `npm run test:e2e`
  (`vitest.config.e2e.ts`). `@nestjs/cli` — 12.0.7, версии 12.1.0 у CLI нет.
- `node_modules` только в корне Nest-монорепо; у `apps/web` свой,
  добавить `apps/web/node_modules/` в `.gitignore`.
- Файл `.env` в git не попадает (уже в `.gitignore`). Все новые
  переменные дублируются в `.env.example`, который коммитится.

## Review Focus

Классы входов, которые спека подразумевает, но ни один этап не
проверяет по своей основной задаче. Для каждого ниже добавлен тест в тот
этап, который владеет кодом.

1. **Повторная регистрация тем же email** — второй `POST /register`
   обязан вернуть `409` и не создавать второй ран саги. Тест в Task 1.
2. **`POST /profiles/:token` по использованному или просроченному
   токену** — `410`, и событие `profile.completed` не публикуется.
   Молчаливая публикация разбудила бы чужую сагу. Тест в Task 6.
3. **`GET /registrations/:runId` с несуществующим или неверного формата
   `runId`** — `404`, а не `500` с утечкой внутренней ошибки Hatchet.
   Тест в Task 4.
4. **Дубль события `profile.completed`** — событие доставляется
   at-least-once; второй приход не создаёт второй профиль и не ломает
   флаг. Тест в Task 5.
5. **Пустые, пробельные и сверхдлинные `firstName` / `lastName` /
   `city`** — `400` с внятным сообщением, а не запись мусора в базу.
   Юникод и пробелы внутри имени при этом валидны. Тест в Task 2.

---

## Структура файлов

```
package.json                      корень Nest-монорепо, скрипты
nest-cli.json                     projects: person, profile, contracts
tsconfig.json                     paths: @contracts/* -> libs/contracts/src/*
.env.example                      коммитится; .env — нет
docker-compose.hatchet.yml        есть
docker-compose.apps.yml           Task 10

libs/contracts/src/
  index.ts                        реэкспорт
  events.ts                       имя события, zod-схема payload, profileScope
  steps.ts                        имена workflow и шагов, владельцы, метки
  types.ts                        вход саги и выходы всех шагов
  workflow.ts                     buildOnboardingWorkflow + заглушка NOT_MY_STEP

apps/person/
  prisma/schema.prisma            Person
  generated/prisma/               сгенерированный клиент, в .gitignore
  src/main.ts                     bootstrap, порт 3001, CORS на web
  src/app.module.ts
  src/prisma/prisma.service.ts    PrismaClient + onModuleInit
  src/person/person.controller.ts POST /register, GET /persons/:id
  src/person/person.service.ts    регистрация, argon2, запуск саги
  src/person/dto.ts               zod-схемы тела запросов
  src/registrations/registrations.controller.ts   GET /registrations/:runId
  src/registrations/registrations.service.ts      runs.getDetails -> ответ
  src/hatchet/hatchet.module.ts   провайдер клиента
  src/hatchet/worker.service.ts   сборка impls, метки, старт воркера
  src/hatchet/steps/issue-link.ts
  src/hatchet/steps/mark-completed.ts
  src/hatchet/steps/send-reminder.ts
  src/hatchet/steps/send-welcome.ts

apps/profile/
  prisma/schema.prisma            ProfileLink, Profile
  generated/prisma/
  src/main.ts                     порт 3002
  src/app.module.ts
  src/prisma/prisma.service.ts
  src/links/links.controller.ts   POST /internal/links
  src/links/links.service.ts      выпуск и валидация токена
  src/links/internal-secret.guard.ts
  src/profiles/profiles.controller.ts  GET/POST /profiles/:token
  src/profiles/profiles.service.ts     валидация + публикация события
  src/profiles/dto.ts
  src/hatchet/hatchet.module.ts
  src/hatchet/worker.service.ts
  src/hatchet/steps/await-and-save-profile.ts

apps/web/                         Vite, свой package.json
  src/pages/RegisterPage.tsx
  src/pages/ProfilePage.tsx
  src/pages/StatusPage.tsx
  src/api.ts

test/
  e2e/onboarding.e2e.ts           сквозной сценарий против compose
  ownership/ownership.spec.ts     ворота владения из Task 3
```

---

## Общие тест-хелперы

Тесты во всех этапах опираются на общий набор хелперов. Они лежат в
`test/helpers/` и созданы в Task 0 — **это не методы какой-либо
библиотеки**, а наш код. Импорт: `import { unique, pollUntil } from
'../../test/helpers/index.js'`.

Готовы с Task 0:

| Хелпер | Сигнатура | Зачем |
| --- | --- | --- |
| `unique` | `(email: string) => string` | `'a@example.com'` → `'a+3f2c1e9d@example.com'`. Тесты идут против реальной базы и не чистят её; без этого второй прогон падал бы на уникальности email |
| `sleep` | `(ms: number) => Promise<void>` | пауза |
| `pollUntil` | `(probe, done, timeoutMs, intervalMs?) => Promise<T>` | опрос до выполнения условия; по таймауту бросает ошибку с последним состоянием. Почти всё здесь асинхронно: сага не готова к моменту HTTP-ответа |
| `createTestApp` | `(AppModule) => Promise<TestApp>` | поднимает приложение **в этом же процессе**; отдаёт `.post(path, body?, headers?)`, `.get(path, headers?)`, `.close()`. Это и есть `post`/`get` из тестов Task 1 и Task 2 |
| `httpClient` | `(baseUrl) => { post, get }` | клиент к **уже запущенному** сервису по сети |
| `personApi`, `profileApi` | `() => httpClient(...)` | то же для `:3001` и `:3002`. Это `postPerson`/`getPerson` из тестов Task 5 и Task 7 |

`createTestApp` против `httpClient` — разница принципиальная.
Внутрипроцессный вариант быстрый и не требует контейнеров, годится для
тестов одного сервиса. Но сага проверяет, что шаги исполняют **разные
процессы**, поэтому начиная с Task 3 межсервисные тесты идут только
через `httpClient`.

Появляются позже, каждый в своём этапе:

| Хелпер | Этап | Что делает |
| --- | --- | --- |
| `waitForDone(hatchet, runId, timeoutMs)` | Task 3 | опрашивает `runs.getDetails` до `done === true`, возвращает `RunDetail` |
| `readWorkerIds()` | Task 3 | `hatchet.workers.list()` → `{ personWorkerId, profileWorkerId }` по именам |
| `workerOf(details, step)` | Task 3 | id воркера, исполнившего шаг |
| `lastRunDetails()` | Task 3 | детали последнего рана саги |
| `registerAndAwaitLink()` | Task 5 | регистрирует и ждёт `linkReady`; возвращает `{ personId, runId, token }` |
| `pushProfileCompleted(personId, data?)` | Task 5 | `events.push` с нужным scope |
| `stopPersonWorker()`, `startPersonWorker()` | Task 5 | для упражнения с убийством воркера |
| `countEvents(key, scope)` | Task 6 | сколько событий с таким ключом и scope видел Hatchet |
| `issueLinkFor()` | Task 6 | выпускает ссылку напрямую через `/internal/links`, возвращает `{ token, personId }` |
| `prisma`, `profilePrisma` | Task 1, Task 2 | Prisma-клиенты соответствующей базы, поднятые в тестах |

Этап, в котором хелпер появляется впервые, обязан его создать. Если
пишешь этап и хелпера ещё нет — это не повод его выдумывать на месте:
проверь таблицу, он принадлежит какому-то этапу.

## Task 0: Скелет монорепо и два живых сервиса

**Учебный акцент:** ничего про Hatchet. Цель — чтобы дальше ни одна
проблема не оказалась проблемой сборки.

**Кто пишет:** я. Это рутина, на ней учиться нечему.

**Files:**
- Create: `package.json`, `nest-cli.json`, `tsconfig.json`, `.env.example`
- Create: `apps/person/src/main.ts`, `apps/person/src/app.module.ts`
- Create: `apps/profile/src/main.ts`, `apps/profile/src/app.module.ts`
- Modify: `.gitignore` (добавить `apps/web/node_modules/`)
- Create: `test/helpers/{unique,poll,app,http,index}.ts` — см. раздел
  «Общие тест-хелперы» выше
- Test: `apps/person/test/health.e2e-spec.ts`,
  `apps/profile/test/health.e2e-spec.ts`, `test/helpers/helpers.spec.ts`

**Interfaces:**
- Consumes: ничего.
- Produces: рабочие команды `npm run start:person`,
  `npm run start:profile`; эндпоинт `GET /health` → `200 { ok: true,
  service: 'person' | 'profile' }` на обоих сервисах; общие тест-хелперы
  `unique`, `sleep`, `pollUntil`, `createTestApp`, `httpClient`,
  `personApi`, `profileApi`.

- [ ] **Step 1: Создать монорепо Nest с двумя приложениями**

```bash
npx @nestjs/cli@12.1.0 new hatchet-onboarding --skip-git --package-manager npm --strict
# сгенерированное содержимое переносится в корень репозитория
npx nest generate app person
npx nest generate app profile
npx nest generate library contracts --prefix @contracts
```

Удалить сгенерированное приложение по умолчанию, оставить только
`person`, `profile` и библиотеку `contracts`.

- [ ] **Step 2: Зафиксировать версии**

```bash
npm i -E @nestjs/common@12.1.0 @nestjs/core@12.1.0 @nestjs/platform-express@12.1.0
npm i -E @prisma/client@7.10.0 argon2@0.45.1 @hatchet-dev/typescript-sdk@1.33.2 zod
npm i -DE prisma@7.10.0 typescript@6.0.3
```

Проверить: `node -p "require('./package.json').dependencies"` — все
перечисленные пакеты с точными версиями, без `^`.

- [ ] **Step 3: Написать падающий тест здоровья для person**

```ts
// apps/person/test/health.e2e-spec.ts
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('person health', () => {
  it('отвечает 200 и называет себя', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();

    const res = await request(app.getHttpServer()).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, service: 'person' });
    await app.close();
  });
});
```

- [ ] **Step 4: Убедиться, что тест падает**

Run: `npx vitest run --config vitest.config.e2e.ts apps/person/test/health.e2e-spec.ts`
Expected: FAIL, 404 вместо 200.

- [ ] **Step 5: Добавить контроллер здоровья в оба сервиса**

```ts
// apps/person/src/app.controller.ts
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { ok: true, service: 'person' as const };
  }
}
```

Для profile — то же самое со строкой `'profile'`. Зарегистрировать в
соответствующих `AppModule`.

- [ ] **Step 6: Повторить тест для profile и прогнать оба**

Скопировать тест из шага 3 в `apps/profile/test/health.e2e-spec.ts`,
поменяв ожидание на `service: 'profile'`.

Run: `npx vitest run --config vitest.config.e2e.ts`
Expected: PASS, 2 теста.

- [ ] **Step 7: Порты, CORS и `.env.example`**

```
# .env.example
PERSON_PORT=3001
PROFILE_PORT=3002
WEB_ORIGIN=http://localhost:5173

PERSON_DATABASE_URL=postgresql://hatchet:password!1@localhost:5432/person
PROFILE_DATABASE_URL=postgresql://hatchet:password!1@localhost:5432/profile

PROFILE_INTERNAL_URL=http://localhost:3002
INTERNAL_SECRET=dev-internal-secret

HATCHET_CLIENT_TOKEN=
HATCHET_CLIENT_TLS_STRATEGY=none
```

В обоих `main.ts` включить `app.enableCors({ origin: process.env.WEB_ORIGIN })`
и слушать соответствующий порт.

- [ ] **Step 8: Проверить руками и закоммитить**

```bash
docker compose -f docker-compose.hatchet.yml up -d
npm run start:person &
npm run start:profile &
curl -s localhost:3001/health && curl -s localhost:3002/health
```

Expected: два JSON-ответа с разными `service`.

```bash
git add -A
git commit -m "feat: скелет Nest-монорепо, два сервиса, health-чеки"
```

---

## Task 1: Person — регистрация

**Учебный акцент:** argon2id и Prisma 7 в Nest. Hatchet не трогаем —
важно, чтобы регистрация работала до саги, иначе потом не понять, что
сломалось.

**Кто пишет:** ты. Это знакомая территория, быстрее сделать самому.

**Files:**
- Create: `apps/person/prisma/schema.prisma`
- Create: `apps/person/src/prisma/prisma.service.ts`
- Create: `apps/person/src/person/person.service.ts`,
  `person.controller.ts`, `dto.ts`
- Test: `apps/person/test/register.e2e-spec.ts`

**Interfaces:**
- Consumes: `GET /health` из Task 0.
- Produces:
  - `PersonService.register(email: string, password: string):
    Promise<{ personId: string }>` — бросает `ConflictException` при
    занятом email.
  - `POST /register` → `201 { personId }`. Станет `202 { personId,
    runId }` в Task 4.
  - `GET /persons/:id` → `200 { id, email, isProfileCompleted }` или `404`.
  - Таблица `Person` как в §4 спеки.

- [ ] **Step 1: Схема Prisma и миграция**

```prisma
// apps/person/prisma/schema.prisma
generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}

datasource db {
  provider = "postgresql"
  url      = env("PERSON_DATABASE_URL")
}

model Person {
  id                 String   @id @default(uuid())
  email              String   @unique
  passwordHash       String
  isProfileCompleted Boolean  @default(false)
  onboardingRunId    String?
  createdAt          DateTime @default(now())
}
```

Run: `npx prisma migrate dev --schema apps/person/prisma/schema.prisma --name init_person`

Примечание по Prisma 7: генератор называется `prisma-client` (не
`prisma-client-js`), и `output` обязателен. Каталог `generated/` уже в
`.gitignore`.

- [ ] **Step 2: Написать падающие тесты регистрации**

```ts
// apps/person/test/register.e2e-spec.ts
describe('POST /register', () => {
  it('создаёт пользователя и возвращает personId', async () => {
    const res = await post('/register', {
      email: unique('a@example.com'),
      password: 'correct horse battery staple',
    });

    expect(res.status).toBe(201);
    expect(res.body.personId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('не возвращает пароль и не возвращает хеш', async () => {
    const res = await post('/register', {
      email: unique('b@example.com'),
      password: 'correct horse battery staple',
    });

    expect(JSON.stringify(res.body)).not.toMatch(/password|argon|\$argon2/i);
  });

  // Review Focus 1
  it('на повторный email отвечает 409 и не создаёт второго пользователя', async () => {
    const email = unique('dup@example.com');
    const first = await post('/register', { email, password: 'pw-long-enough' });
    expect(first.status).toBe(201);

    const second = await post('/register', { email, password: 'pw-long-enough' });

    expect(second.status).toBe(409);
    const count = await prisma.person.count({ where: { email } });
    expect(count).toBe(1);
  });

  it('отвергает кривой email и короткий пароль', async () => {
    const bad = await post('/register', { email: 'not-an-email', password: 'x' });
    expect(bad.status).toBe(400);
  });
});
```

`post`, `get` и `unique` — из `test/helpers/`, см. раздел «Общие
тест-хелперы». `prisma` — клиент базы `person`, поднимаемый в этом
тестовом файле.

- [ ] **Step 3: Убедиться, что тесты падают**

Run: `npx vitest run --config vitest.config.e2e.ts apps/person/test/register.e2e-spec.ts`
Expected: FAIL на всех четырёх, 404.

- [ ] **Step 4: Реализовать регистрацию**

Требования, которым должен удовлетворять код:

- `PrismaService extends PrismaClient implements OnModuleInit`, в
  `onModuleInit` — `await this.$connect()`.
- Валидация тела zod-схемой: `email` — валидный адрес, `password` —
  минимум 8 символов. Ошибка валидации → `400`.
- Хеш: `argon2.hash(password, { type: argon2.argon2id })`. Параметры
  по умолчанию, не подкручивать.
- Занятый email определяется по нарушению уникальности от Prisma (код
  `P2002`), а не предварительным `SELECT` — иначе остаётся гонка между
  проверкой и вставкой.
- Ответ содержит только `personId`.

- [ ] **Step 5: Прогнать тесты**

Run: `npx vitest run --config vitest.config.e2e.ts apps/person/test/register.e2e-spec.ts`
Expected: PASS, 4 теста.

- [ ] **Step 6: `GET /persons/:id`**

Отдаёт `{ id, email, isProfileCompleted }`, на неизвестный id — `404`.
Нужен фронту на этапе 8 и e2e-тесту на этапе 10.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(person): регистрация с argon2id и Prisma"
```

---

## Task 2: Profile — ссылки и валидация токена

**Учебный акцент:** идемпотентность через `@unique`. `POST
/internal/links` вызовется повторно при ретрае саги, и это должно быть
безопасно **по устройству схемы**, а не потому что «обычно не
случается».

**Кто пишет:** ты.

**Files:**
- Create: `apps/profile/prisma/schema.prisma`
- Create: `apps/profile/src/prisma/prisma.service.ts`
- Create: `apps/profile/src/links/links.service.ts`,
  `links.controller.ts`, `internal-secret.guard.ts`
- Create: `apps/profile/src/profiles/profiles.controller.ts`, `dto.ts`
- Test: `apps/profile/test/links.e2e-spec.ts`

**Interfaces:**
- Consumes: ничего из предыдущих задач.
- Produces:
  - `LinksService.issue(personId: string): Promise<{ token: string;
    profileUrl: string }>` — идемпотентно по `personId`.
  - `LinksService.resolve(token: string): Promise<{ personId: string }>`
    — бросает `GoneException` на использованный или просроченный.
  - `POST /internal/links` → `201 { token, profileUrl }`, требует
    заголовок `x-internal-secret`.
  - `GET /profiles/:token` → `200 { personId }` или `410`.
  - Таблицы `ProfileLink`, `Profile` как в §4 спеки.

- [ ] **Step 1: Схема и миграция**

```prisma
// apps/profile/prisma/schema.prisma
generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}

datasource db {
  provider = "postgresql"
  url      = env("PROFILE_DATABASE_URL")
}

model ProfileLink {
  token     String    @id
  personId  String    @unique
  expiresAt DateTime
  usedAt    DateTime?
}

model Profile {
  id          String   @id @default(uuid())
  personId    String   @unique
  firstName   String
  lastName    String
  city        String
  completedAt DateTime @default(now())
}
```

Run: `npx prisma migrate dev --schema apps/profile/prisma/schema.prisma --name init_profile`

- [ ] **Step 2: Написать падающие тесты**

```ts
// apps/profile/test/links.e2e-spec.ts
const SECRET = { 'x-internal-secret': process.env.INTERNAL_SECRET! };

describe('POST /internal/links', () => {
  it('выдаёт токен и ссылку на веб-форму', async () => {
    const personId = crypto.randomUUID();

    const res = await post('/internal/links', { personId }, SECRET);

    expect(res.status).toBe(201);
    expect(res.body.token).toHaveLength(43); // base64url от 32 байт
    expect(res.body.profileUrl).toBe(
      `${process.env.WEB_ORIGIN}/profile/${res.body.token}`,
    );
  });

  it('идемпотентен: повторный вызов даёт тот же токен', async () => {
    const personId = crypto.randomUUID();

    const first = await post('/internal/links', { personId }, SECRET);
    const second = await post('/internal/links', { personId }, SECRET);

    expect(second.status).toBe(201);
    expect(second.body.token).toBe(first.body.token);
    expect(await prisma.profileLink.count({ where: { personId } })).toBe(1);
  });

  it('без секрета отвечает 401', async () => {
    const res = await post('/internal/links', { personId: crypto.randomUUID() });
    expect(res.status).toBe(401);
  });
});

describe('GET /profiles/:token', () => {
  it('отдаёт personId по живому токену', async () => {
    const personId = crypto.randomUUID();
    const { body } = await post('/internal/links', { personId }, SECRET);

    const res = await get(`/profiles/${body.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ personId });
  });

  it('на просроченный токен отвечает 410', async () => {
    const personId = crypto.randomUUID();
    const { body } = await post('/internal/links', { personId }, SECRET);
    await prisma.profileLink.update({
      where: { token: body.token },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await get(`/profiles/${body.token}`);

    expect(res.status).toBe(410);
  });

  it('на неизвестный токен отвечает 410, а не 404', async () => {
    const res = await get('/profiles/definitely-not-a-real-token');
    expect(res.status).toBe(410);
  });
});
```

Единый `410` на «нет такого» и «протух» — намеренно: иначе эндпоинт
превращается в оракул, по которому можно перебором узнавать
существующие токены.

- [ ] **Step 3: Убедиться, что тесты падают**

Run: `npx vitest run --config vitest.config.e2e.ts apps/profile/test/links.e2e-spec.ts`
Expected: FAIL, 6 тестов.

- [ ] **Step 4: Реализовать**

Требования:

- Токен — `crypto.randomBytes(32).toString('base64url')`. Не uuid:
  токен попадает в ссылку и должен быть неугадываемым.
- `issue` — `prisma.profileLink.upsert({ where: { personId }, create:
  {...}, update: {} })`. Пустой `update` и есть идемпотентность:
  повторный вызов ничего не меняет и возвращает существующую строку.
- `expiresAt` — `now + 25h`, на час больше таймаута саги, чтобы ссылка
  не умирала раньше, чем сага перестанет ждать.
- Гвард сравнивает заголовок с `INTERNAL_SECRET` через
  `crypto.timingSafeEqual` (длины сначала сравнить отдельно).
- `resolve` бросает `GoneException` при отсутствии строки, при
  `usedAt != null` и при `expiresAt < now`.

- [ ] **Step 5: Прогнать тесты**

Run: `npx vitest run --config vitest.config.e2e.ts apps/profile/test/links.e2e-spec.ts`
Expected: PASS, 6 тестов.

- [ ] **Step 6: Валидация тела профиля (Review Focus 5)**

Схема в `apps/profile/src/profiles/dto.ts`:

```ts
const name = z.string().trim().min(1).max(100);
export const saveProfileSchema = z.object({
  firstName: name,
  lastName: name,
  city: z.string().trim().min(1).max(120),
});
```

Тест:

```ts
describe('валидация тела профиля', () => {
  it.each([
    ['пустая строка', { firstName: '', lastName: 'Петров', city: 'Москва' }],
    ['только пробелы', { firstName: '   ', lastName: 'Петров', city: 'Москва' }],
    ['слишком длинно', { firstName: 'я'.repeat(101), lastName: 'П', city: 'М' }],
    ['нет поля city', { firstName: 'Иван', lastName: 'Петров' }],
  ])('отвергает: %s', (_, body) => {
    expect(saveProfileSchema.safeParse(body).success).toBe(false);
  });

  it.each([
    ['юникод', { firstName: 'Иван', lastName: 'Петров', city: 'Москва' }],
    ['дефис', { firstName: 'Анна-Мария', lastName: 'Ли', city: 'Улан-Удэ' }],
    ['пробел внутри', { firstName: 'Ли На', lastName: 'Чен', city: 'Нур-Султан' }],
  ])('принимает: %s', (_, body) => {
    expect(saveProfileSchema.safeParse(body).success).toBe(true);
  });

  it('обрезает крайние пробелы', () => {
    const parsed = saveProfileSchema.parse({
      firstName: '  Иван  ', lastName: 'Петров', city: 'Москва',
    });
    expect(parsed.firstName).toBe('Иван');
  });
});
```

Run: `npx vitest run apps/profile/test/profile-dto.spec.ts`
Expected: PASS, 8 проверок.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(profile): идемпотентный выпуск ссылок и валидация токена"
```

---

## Task 3: ВОРОТА ВЛАДЕНИЯ — первый воркер и маршрутизация по меткам

**Учебный акцент:** главный этап по устройству Hatchet. Воркер — это
процесс, который **подключается наружу** и ждёт работы, а не сервер,
который зовут. Метка `required: true` — жёсткий фильтр. Никакой
доменной логики: три пустых шага.

**Кто пишет:** вместе. Контракты и билдер — я, воркеры и метки — ты, на
них весь смысл.

**Ворота:** пока этот этап не зелёный, к Task 4 не переходим. Если
метки не работают — идём в запасные варианты из §5 спеки и правим план.

**Files:**
- Create: `libs/contracts/src/{steps,types,events,workflow,index}.ts`
- Create: `apps/person/src/hatchet/hatchet.module.ts`, `worker.service.ts`
- Create: `apps/profile/src/hatchet/hatchet.module.ts`, `worker.service.ts`
- Test: `test/ownership/ownership.spec.ts`

**Interfaces:**
- Consumes: рабочие сервисы из Task 0.
- Produces:
  - `ONBOARDING_WORKFLOW = 'person-onboarding'`
  - `STEP = { issueLink: 'issue-onboarding-link', awaitProfile:
    'await-and-save-profile', markCompleted: 'mark-profile-completed',
    sendReminder: 'send-reminder', sendWelcome: 'send-welcome' }`
  - `SERVICE_LABEL = 'service'`; значения меток `'person'`, `'profile'`
  - `buildOnboardingWorkflow(hatchet: HatchetClient, impls: StepImpls)`
  - типы из блока ниже — на них опираются все следующие задачи

- [ ] **Step 1: Типы и константы контрактов**

```ts
// libs/contracts/src/types.ts
export type OnboardingInput = { personId: string; email: string };

export type IssueLinkOutput = { token: string; profileUrl: string };

export type AwaitProfileOutput =
  | { timedOut: false; profileId: string }
  | { timedOut: true; profileId: null };

export type MarkCompletedOutput = { isProfileCompleted: boolean };
export type SendReminderOutput = { reminded: boolean };
export type SendWelcomeOutput = { welcomed: boolean };
```

```ts
// libs/contracts/src/steps.ts
export const ONBOARDING_WORKFLOW = 'person-onboarding';

export const STEP = {
  issueLink: 'issue-onboarding-link',
  awaitProfile: 'await-and-save-profile',
  markCompleted: 'mark-profile-completed',
  sendReminder: 'send-reminder',
  sendWelcome: 'send-welcome',
} as const;

export const SERVICE_LABEL = 'service';

export const STEP_OWNER = {
  [STEP.issueLink]: 'person',
  [STEP.awaitProfile]: 'profile',
  [STEP.markCompleted]: 'person',
  [STEP.sendReminder]: 'person',
  [STEP.sendWelcome]: 'person',
} as const satisfies Record<string, 'person' | 'profile'>;

export const requiredLabelFor = (step: keyof typeof STEP_OWNER) => ({
  [SERVICE_LABEL]: { value: STEP_OWNER[step], required: true },
});
```

- [ ] **Step 2: Билдер декларации**

Требования к `libs/contracts/src/workflow.ts`:

- Экспортирует `StepImpls` — `Partial` от объекта с ключами-строками
  `'issue-onboarding-link'`, `'await-and-save-profile'`,
  `'mark-profile-completed'`, `'send-reminder'`, `'send-welcome'`.
  Тип `fn` у `await-and-save-profile` принимает `DurableContext`,
  у остальных — обычный `Context`.
- `buildOnboardingWorkflow(hatchet, impls)` создаёт
  `hatchet.workflow({ name: ONBOARDING_WORKFLOW })` и добавляет **все
  пять** шагов независимо от состава `impls`. Форма DAG одинакова у
  всех, кто зовёт билдер, — это условие корректности.
- Родители по таблице §5 спеки: `awaitProfile` ← `issueLink`;
  `markCompleted` и `sendReminder` ← `awaitProfile`; `sendWelcome` ←
  `markCompleted`.
- Каждому шагу проставляется `desiredWorkerLabels:
  requiredLabelFor(step)`.
- `issueLink`: `retries: 5`, экспоненциальный backoff.
  `awaitProfile`: `durableTask`, `executionTimeout: '25h'`.
- Для шага, отсутствующего в `impls`, подставляется
  `() => { throw new Error(\`NOT_MY_STEP: ${step}\`); }`.

Последний пункт — страховка. Если метка не сработает и шаг уедет
чужому воркеру, ран упадёт с внятным текстом в UI, а не сделает тихо
не то.

- [ ] **Step 3: Написать падающий тест ворот**

```ts
// test/ownership/ownership.spec.ts
import { HatchetClient } from '@hatchet-dev/typescript-sdk';
import { STEP, buildOnboardingWorkflow } from '@contracts';

vi.setConfig({ testTimeout: 120_000 });

describe('ворота владения', () => {
  it('каждый шаг исполняет только свой воркер', async () => {
    const hatchet = await HatchetClient.init({});
    const personId = crypto.randomUUID();

    // декларация строится тем же билдером с пустыми impls: она нужна
    // только чтобы запустить ран, исполнять будут воркеры сервисов
    const onboarding = buildOnboardingWorkflow(hatchet, {});

    const ref = await onboarding.runNoWait({
      personId,
      email: `${personId.slice(0, 8)}@example.com`,
    });
    const runId = await ref.workflowRunId;

    // на этом этапе awaitProfile — заглушка, сразу возвращает timedOut,
    // поэтому ран должен дойти до конца без событий
    const details = await waitForDone(hatchet, runId, 60_000);

    expect(details.status).toBe('COMPLETED');

    for (const step of Object.values(STEP)) {
      const run = details.taskRuns[step];
      expect(run).toBeDefined();
      expect(run.error ?? '').not.toMatch(/NOT_MY_STEP/);
    }
  });

  it('ни один шаг не выполнен воркером без нужной метки', async () => {
    // проверяем через UI-данные: у каждого taskRun есть workerId,
    // и он должен совпадать с воркером своего сервиса
    const { personWorkerId, profileWorkerId } = await readWorkerIds();
    const details = await lastRunDetails();

    expect(workerOf(details, STEP.issueLink)).toBe(personWorkerId);
    expect(workerOf(details, STEP.awaitProfile)).toBe(profileWorkerId);
    expect(workerOf(details, STEP.markCompleted)).toBe(personWorkerId);
  });
});
```

`waitForDone` опрашивает `hatchet.runs.getDetails(runId)` раз в секунду
до `done === true` или таймаута. `readWorkerIds` берёт
`hatchet.workers.list()` и сопоставляет по имени.

- [ ] **Step 4: Убедиться, что тест падает**

Run: `npx vitest run test/ownership`
Expected: FAIL — workflow `person-onboarding` не зарегистрирован, ни
одного воркера нет.

- [ ] **Step 5: Поднять два воркера с метками**

Требования:

- `HatchetModule` в каждом сервисе — провайдер, отдающий результат
  `HatchetClient.init({})`. Токен и стратегия TLS берутся из окружения
  автоматически, руками их передавать не надо.
- `WorkerService implements OnApplicationBootstrap`. В хуке: собрать
  `impls` **только своих** шагов, вызвать `buildOnboardingWorkflow`,
  создать воркера и стартовать его.
- Person: `hatchet.worker('person-worker', { labels: { service:
  'person' }, workflows: [onboarding] })`.
- Profile: то же с `'profile-worker'` и `service: 'profile'`.
- Заглушки шагов на этом этапе: `issueLink` возвращает
  `{ token: 'stub', profileUrl: 'stub' }`; `awaitProfile` возвращает
  `{ timedOut: true, profileId: null }` не ожидая ничего;
  `markCompleted` возвращает `{ isProfileCompleted: false }`;
  `sendReminder` и `sendWelcome` — `{ reminded: true }` /
  `{ welcomed: true }`. Ни одна заглушка не ходит в базу.
- Воркер стартует внутри процесса Nest-приложения. Отдельных процессов
  для воркеров не заводим: person и profile и так два разных процесса,
  а в проде это были бы два разных деплоя.

- [ ] **Step 6: Прогнать ворота**

```bash
docker compose -f docker-compose.hatchet.yml up -d
npm run start:person &
npm run start:profile &
npx vitest run test/ownership
```

Expected: PASS, 2 теста.

Если падает с `NOT_MY_STEP` — метки не удержали маршрутизацию.
**Остановиться, не чинить на ходу.** Открыть §5 спеки, взять запасной
вариант 1 (частичная регистрация) или 2 (дочерний workflow), обновить
спеку и этот план, и только потом продолжать.

- [ ] **Step 7: Посмотреть на это глазами**

Открыть `http://localhost:8888`, найти ран, раскрыть DAG. Убедиться,
что видно: пять шагов, их порядок, для каждого — какой воркер исполнял,
сколько занял, что вернул. Это тот экран, в который предстоит смотреть
все следующие этапы.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: сага из пяти пустых шагов, маршрутизация по меткам воркеров"
```

---

## Task 4: `issue-onboarding-link` и поллинг ссылки

**ЛОМАЕМ РУКАМИ.** **Учебный акцент:** ретрай — это **повторный вызов
функции с начала**. Всё, что она делает, обязано быть безопасным при
повторе. Идемпотентность из Task 2 здесь перестаёт быть теорией.

**Кто пишет:** вместе. Шаг саги — ты, эндпоинт поллинга — я.

**Files:**
- Create: `apps/person/src/hatchet/steps/issue-link.ts`
- Create: `apps/person/src/registrations/registrations.service.ts`,
  `registrations.controller.ts`
- Modify: `apps/person/src/person/person.service.ts` (запуск саги)
- Modify: `apps/person/src/hatchet/worker.service.ts` (подставить impl)
- Test: `apps/person/test/registrations.e2e-spec.ts`

**Interfaces:**
- Consumes: `LinksService` через HTTP `POST /internal/links` из Task 2;
  `buildOnboardingWorkflow` из Task 3.
- Produces:
  - `POST /register` → `202 { personId, runId }`
  - `GET /registrations/:runId` → `200 { status, profileUrl?,
    isProfileCompleted }`, где `status` ∈ `'pending' | 'linkReady' |
    'completed' | 'failed'`
  - `Person.onboardingRunId` заполнен.

- [ ] **Step 1: Написать падающие тесты**

```ts
describe('GET /registrations/:runId', () => {
  it('после регистрации отдаёт ссылку на профиль', async () => {
    const { body } = await post('/register', {
      email: unique('link@example.com'), password: 'pw-long-enough',
    });
    expect(body.runId).toBeTruthy();

    const view = await pollUntil(
      () => get(`/registrations/${body.runId}`),
      (r) => r.body.status === 'linkReady',
      30_000,
    );

    expect(view.body.profileUrl).toMatch(
      new RegExp(`^${process.env.WEB_ORIGIN}/profile/[A-Za-z0-9_-]{43}$`),
    );
    expect(view.body.isProfileCompleted).toBe(false);
  });

  it('пока шаг не отработал, отдаёт pending без ссылки', async () => {
    const { body } = await post('/register', {
      email: unique('pend@example.com'), password: 'pw-long-enough',
    });

    const immediate = await get(`/registrations/${body.runId}`);

    expect(['pending', 'linkReady']).toContain(immediate.body.status);
    if (immediate.body.status === 'pending') {
      expect(immediate.body.profileUrl).toBeUndefined();
    }
  });

  // Review Focus 3
  it('на неизвестный runId отвечает 404, а не 500', async () => {
    const res = await get(`/registrations/${crypto.randomUUID()}`);
    expect(res.status).toBe(404);
  });

  it('на runId неверного формата отвечает 404, а не 500', async () => {
    const res = await get('/registrations/not-a-uuid');
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `npx vitest run --config vitest.config.e2e.ts apps/person/test/registrations.e2e-spec.ts`
Expected: FAIL, 4 теста.

- [ ] **Step 3: Запуск саги из регистрации**

Требования:

- После успешной вставки `Person` вызвать `hatchet.runNoWait` с
  `{ personId, email }`.
- Взять `runId` из `ref.workflowRunId`, записать в
  `Person.onboardingRunId`, вернуть клиенту вместе с `personId`, статус
  ответа сменить на `202`.
- К рану прицепить `additionalMetadata: { personId }` — на этапе 9 по
  этому полю ран ищется в UI.
- Падение запуска саги **не откатывает** регистрацию: пользователь уже
  создан. Ошибку залогировать, вернуть `202` без `runId`. Ран можно
  будет запустить повторно; потерять созданного пользователя хуже.

- [ ] **Step 4: Реализовать шаг `issue-onboarding-link`**

Требования:

- Сигнатура: `(input: OnboardingInput) => Promise<IssueLinkOutput>`.
- `POST` на `${PROFILE_INTERNAL_URL}/internal/links` с телом
  `{ personId }` и заголовком `x-internal-secret`.
- Таймаут запроса — 5 секунд. Без него зависший сокет съест весь
  бюджет ретраев впустую.
- Не-2xx → бросить ошибку. Именно бросок включает механизм ретраев
  Hatchet; проглоченная ошибка означает «шаг успешен».
- Вернуть `{ token, profileUrl }` как есть от Profile.

- [ ] **Step 5: Реализовать `GET /registrations/:runId`**

Требования:

- `hatchet.runs.getDetails(runId)`; отсутствующий ран → `404`
  (перехватить ошибку клиента, не выпускать наружу как `500`).
- `taskRuns[STEP.issueLink].output.profileUrl` есть → `linkReady`.
- `taskRuns[STEP.markCompleted]` завершён успешно → `completed`.
- Статус рана `FAILED` или `CANCELLED` → `failed`.
- Иначе → `pending`.
- `isProfileCompleted` читается из своей базы по `personId`, а не из
  выхода шага: база — источник истины, ран — лишь её история.

- [ ] **Step 6: Прогнать тесты**

Run: `npx vitest run --config vitest.config.e2e.ts apps/person/test/registrations.e2e-spec.ts`
Expected: PASS, 4 теста.

- [ ] **Step 7: ЛОМАЕМ — погасить Profile и посмотреть на ретраи**

```bash
# остановить процесс profile
kill %2
curl -s -XPOST localhost:3001/register \
  -H 'content-type: application/json' \
  -d '{"email":"retry@example.com","password":"pw-long-enough"}'
```

Открыть UI, найти ран. Наблюдать: шаг `issue-onboarding-link` краснеет
и уходит в повтор, интервалы между попытками растут. Записать для себя
ответы:

- сколько попыток прошло до окончательного падения;
- что показывает UI между попытками;
- что вернул `GET /registrations/:runId` в это время.

Затем поднять Profile обратно и через UI сделать replay рана. Убедиться,
что ссылка выпустилась и `ProfileLink` для этого `personId` ровно одна —
вот ради чего был `upsert` в Task 2.

```bash
npm run start:profile &
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: шаг выпуска ссылки с ретраями и поллинг статуса регистрации"
```

---

## Task 5: `await-and-save-profile` — durable-ожидание

**ЛОМАЕМ РУКАМИ.** **Учебный акцент:** главный этап проекта.
Durable-задача не держит процесс. Её состояние живёт в Hatchet, поэтому
воркер можно убить и поднять заново, а задача продолжится. Плюс
`lookbackWindow` — защита от гонки, которую без него было бы почти
невозможно отладить.

**Кто пишет:** ты, целиком. Это тот самый пробел, ради которого проект.

**Files:**
- Create: `apps/profile/src/hatchet/steps/await-and-save-profile.ts`
- Create: `apps/person/src/hatchet/steps/mark-completed.ts`
- Create: `libs/contracts/src/events.ts`
- Modify: оба `worker.service.ts` (подставить реальные impls)
- Test: `apps/profile/test/await-profile.spec.ts`

**Interfaces:**
- Consumes: `IssueLinkOutput` из Task 4; `STEP`, `buildOnboardingWorkflow`
  из Task 3.
- Produces:
  - `PROFILE_COMPLETED_EVENT = 'profile.completed'`
  - `profileCompletedSchema` — zod: `{ personId, firstName, lastName, city }`
  - `profileScope(personId: string): string` → `` `person:${personId}` ``
  - Шаг возвращает `AwaitProfileOutput`.
  - После прохода флоу `Person.isProfileCompleted === true`.

- [ ] **Step 1: Контракт события**

```ts
// libs/contracts/src/events.ts
import { z } from 'zod';

export const PROFILE_COMPLETED_EVENT = 'profile.completed';

export const profileCompletedSchema = z.object({
  personId: z.string().uuid(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  city: z.string().min(1).max(120),
});

export type ProfileCompleted = z.infer<typeof profileCompletedSchema>;

export const profileScope = (personId: string) => `person:${personId}`;
```

- [ ] **Step 2: Написать падающий тест сквозного прохода**

```ts
// apps/profile/test/await-profile.spec.ts
vi.setConfig({ testTimeout: 120_000 });

it('событие завершает сагу и поднимает флаг в Person', async () => {
  const { body } = await postPerson('/register', {
    email: unique('flow@example.com'), password: 'pw-long-enough',
  });
  const { personId, runId } = body;

  await pollUntil(
    () => getPerson(`/registrations/${runId}`),
    (r) => r.body.status === 'linkReady',
    30_000,
  );

  await hatchet.events.push(
    PROFILE_COMPLETED_EVENT,
    { personId, firstName: 'Иван', lastName: 'Петров', city: 'Москва' },
    { scope: profileScope(personId) },
  );

  const done = await pollUntil(
    () => getPerson(`/registrations/${runId}`),
    (r) => r.body.status === 'completed',
    60_000,
  );

  expect(done.body.isProfileCompleted).toBe(true);

  const saved = await profilePrisma.profile.findUnique({ where: { personId } });
  expect(saved).toMatchObject({ firstName: 'Иван', lastName: 'Петров', city: 'Москва' });
});

// Review Focus 4
it('повторное событие не создаёт второй профиль и не ломает флаг', async () => {
  const { personId, runId } = await registerAndAwaitLink();

  const event = { personId, firstName: 'Анна', lastName: 'Ли', city: 'Казань' };
  await hatchet.events.push(PROFILE_COMPLETED_EVENT, event, { scope: profileScope(personId) });
  await hatchet.events.push(PROFILE_COMPLETED_EVENT, event, { scope: profileScope(personId) });

  await pollUntil(
    () => getPerson(`/registrations/${runId}`),
    (r) => r.body.status === 'completed',
    60_000,
  );

  expect(await profilePrisma.profile.count({ where: { personId } })).toBe(1);
  const person = await getPerson(`/persons/${personId}`);
  expect(person.body.isProfileCompleted).toBe(true);
});

it('чужое событие не будит сагу', async () => {
  const mine = await registerAndAwaitLink();
  const stranger = crypto.randomUUID();

  await hatchet.events.push(
    PROFILE_COMPLETED_EVENT,
    { personId: stranger, firstName: 'Чужой', lastName: 'Человек', city: 'Томск' },
    { scope: profileScope(stranger) },
  );
  await sleep(5_000);

  const view = await getPerson(`/registrations/${mine.runId}`);
  expect(view.body.status).toBe('linkReady');
  expect(await profilePrisma.profile.count({ where: { personId: mine.personId } })).toBe(0);
});
```

Третий тест — про CEL-фильтр и scope. Без них сага проснулась бы на
первое же чужое событие; это ровно тот баг, который в проде находят
поздно и дорого.

- [ ] **Step 3: Убедиться, что тесты падают**

Run: `npx vitest run apps/profile/test/await-profile.spec.ts`
Expected: FAIL — заглушка `awaitProfile` возвращает `timedOut: true`,
профиль не сохраняется, флаг не поднимается.

- [ ] **Step 4: Реализовать `await-and-save-profile`**

Требования:

- Тип задачи — `durableTask`, контекст `DurableContext`,
  `executionTimeout: '25h'`.
- Ожидание:

```ts
const event = await ctx.waitForEvent(
  PROFILE_COMPLETED_EVENT,
  `input.personId == '${input.personId}'`,
  profileCompletedSchema,
  profileScope(input.personId),
  '25h',
);
```

  Порядок аргументов: `(key, expression, payloadSchema, scope,
  lookbackWindow, label)`.
- `lookbackWindow` пропускать нельзя. Человек может нажать «сохранить»
  раньше, чем сага дойдёт до этой строки, — например, если воркер в
  этот момент перезапускался. Без окна просмотра назад событие уйдёт в
  пустоту и сага провисит до таймаута.
- После получения события — одна транзакция Prisma: `upsert Profile` по
  `personId` и `update ProfileLink.usedAt = now()`. `upsert`, а не
  `create`: событие at-least-once.
- Вернуть `{ timedOut: false, profileId }`.
- Истечение ожидания → `{ timedOut: true, profileId: null }`, без
  броска. Таймаут — это штатный исход, а не сбой.

- [ ] **Step 5: Реализовать `mark-profile-completed`**

Требования:

- Прочитать выход родителя. При `timedOut: true` — вернуть
  `{ isProfileCompleted: false }`, ничего не писать.
- Иначе `prisma.person.update({ where: { id: personId }, data: {
  isProfileCompleted: true } })` — безусловно, без предварительного
  чтения. Повтор безвреден, и это и есть идемпотентность.

- [ ] **Step 6: Прогнать тесты**

Run: `npx vitest run apps/profile/test/await-profile.spec.ts`
Expected: PASS, 3 теста.

- [ ] **Step 7: ЛОМАЕМ — убить воркер посреди ожидания**

```bash
# 1. зарегистрироваться, дождаться linkReady
# 2. убить процесс profile, пока сага ждёт
kill %2
# 3. запушить событие при мёртвом воркере
node -e "..."   # events.push с нужным personId и scope
# 4. поднять profile обратно
npm run start:profile &
```

Ожидаемое: после старта воркера сага **сама** просыпается и доводит
флоу до конца. Это и есть durable execution — состояние ожидания жило в
Hatchet, а не в памяти процесса.

Записать для себя: сколько времени прошло от старта воркера до
завершения рана, и что показывал UI, пока воркера не было.

- [ ] **Step 8: ЛОМАЕМ — гонка, ради которой нужен `lookbackWindow`**

Временно убрать пятый аргумент `waitForEvent`. Пушить событие **сразу
после** `POST /register`, не дожидаясь `linkReady`. Ожидаемое: сага
виснет, событие потеряно. Вернуть `lookbackWindow` — тот же сценарий
проходит.

Этот шаг нужен именно как поломка: увидев зависание один раз, забыть
про окно уже не получится.

- [ ] **Step 9: Тест на падение воркера Person во время ожидания**

Строка из §8 спеки, которую ни один тест выше не трогает: пока Profile
держит ожидание, воркер Person можно гасить безнаказанно — его шаги ещё
не начинались.

```ts
it('падение воркера Person во время ожидания не ломает сагу', async () => {
  const { personId, runId } = await registerAndAwaitLink();

  await stopPersonWorker();          // шаги person ещё не начинались
  await pushProfileCompleted(personId);
  await sleep(5_000);

  // профиль уже сохранён воркером Profile, хотя person лежит
  expect(await profilePrisma.profile.count({ where: { personId } })).toBe(1);

  await startPersonWorker();
  const details = await waitForDone(hatchet, runId, 60_000);

  expect(details.status).toBe('COMPLETED');
  expect(details.taskRuns[STEP.markCompleted].output)
    .toEqual({ isProfileCompleted: true });
});
```

Run: `npx vitest run apps/profile/test/await-profile.spec.ts -t "воркера Person"`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: durable-ожидание профиля и идемпотентная финализация"
```

---

## Task 6: Публикация события из Profile и разбор дуальной записи

**Учебный акцент:** кто владеет записью. Наивный вариант «пишем в базу
и публикуем событие» — это дуальная запись, классическая ловушка. В
нашей схеме её нет не потому, что повезло, а потому что писатель один.

**Кто пишет:** ты — эндпоинт; я — разбор и фиксация выводов.

**Files:**
- Create: `apps/profile/src/profiles/profiles.service.ts`
- Modify: `apps/profile/src/profiles/profiles.controller.ts`
- Test: `apps/profile/test/save-profile.e2e-spec.ts`
- Create: `docs/notes/dual-write.md` (конспект, шаг 6)

**Interfaces:**
- Consumes: `LinksService.resolve` из Task 2; `PROFILE_COMPLETED_EVENT`,
  `profileScope` из Task 5.
- Produces: `POST /profiles/:token` → `202 { personId }`; на
  использованный или просроченный токен → `410`.

- [ ] **Step 1: Написать падающие тесты**

```ts
describe('POST /profiles/:token', () => {
  it('принимает данные и отвечает 202', async () => {
    const { token, personId } = await issueLinkFor();

    const res = await post(`/profiles/${token}`, {
      firstName: 'Иван', lastName: 'Петров', city: 'Москва',
    });

    expect(res.status).toBe(202);
    expect(res.body).toEqual({ personId });
  });

  it('сам в базу профиль не пишет — это делает шаг саги', async () => {
    const { token, personId } = await issueLinkFor();

    await post(`/profiles/${token}`, {
      firstName: 'Иван', lastName: 'Петров', city: 'Москва',
    });

    // сразу после ответа записи ещё нет: она появится, когда сагу разбудят
    expect(await prisma.profile.count({ where: { personId } })).toBe(0);
  });

  // Review Focus 2
  it('на использованный токен отвечает 410 и НЕ публикует событие', async () => {
    const { token, personId } = await issueLinkFor();
    await prisma.profileLink.update({
      where: { token }, data: { usedAt: new Date() },
    });
    const before = await countEvents(PROFILE_COMPLETED_EVENT, profileScope(personId));

    const res = await post(`/profiles/${token}`, {
      firstName: 'Иван', lastName: 'Петров', city: 'Москва',
    });

    expect(res.status).toBe(410);
    expect(await countEvents(PROFILE_COMPLETED_EVENT, profileScope(personId)))
      .toBe(before);
  });

  it('на просроченный токен отвечает 410 и НЕ публикует событие', async () => {
    const { token, personId } = await issueLinkFor();
    await prisma.profileLink.update({
      where: { token }, data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const before = await countEvents(PROFILE_COMPLETED_EVENT, profileScope(personId));

    const res = await post(`/profiles/${token}`, {
      firstName: 'Иван', lastName: 'Петров', city: 'Москва',
    });

    expect(res.status).toBe(410);
    expect(await countEvents(PROFILE_COMPLETED_EVENT, profileScope(personId)))
      .toBe(before);
  });

  it('отвергает кривое тело до всякой публикации', async () => {
    const { token, personId } = await issueLinkFor();
    const before = await countEvents(PROFILE_COMPLETED_EVENT, profileScope(personId));

    const res = await post(`/profiles/${token}`, { firstName: '', lastName: '', city: '' });

    expect(res.status).toBe(400);
    expect(await countEvents(PROFILE_COMPLETED_EVENT, profileScope(personId)))
      .toBe(before);
  });
});
```

`countEvents` читает список событий через REST-клиент Hatchet
(`hatchet.api`), фильтруя по ключу и scope.

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `npx vitest run --config vitest.config.e2e.ts apps/profile/test/save-profile.e2e-spec.ts`
Expected: FAIL, 5 тестов.

- [ ] **Step 3: Реализовать эндпоинт**

Требования и порядок операций — именно в этом порядке:

1. Валидация тела zod-схемой из Task 2. Провал → `400`.
2. `LinksService.resolve(token)`. Провал → `410`.
3. `hatchet.events.push(PROFILE_COMPLETED_EVENT, { personId,
   ...body }, { scope: profileScope(personId) })`.
4. Ответ `202 { personId }`.

В базу хендлер **не пишет ничего**. Ни профиль, ни `usedAt` — и то и
другое делает шаг саги. Это не экономия, а суть схемы: один писатель.

- [ ] **Step 4: Прогнать тесты**

Run: `npx vitest run --config vitest.config.e2e.ts apps/profile/test/save-profile.e2e-spec.ts`
Expected: PASS, 5 тестов.

- [ ] **Step 5: ЛОМАЕМ — воспроизвести дуальную запись**

Временно переписать хендлер на наивный вариант: сначала
`prisma.profile.create`, потом `events.push`. Между ними вставить
`if (process.env.BREAK_AFTER_WRITE) throw new Error('упали между записями')`.

Запустить с этой переменной. Наблюдать состояние: профиль в базе есть,
сага ждёт и будет ждать все 25 часов, пользователю показана ошибка,
повторить он не может — токен уже использован. Система в состоянии,
из которого сама не выберется.

Затем откатить наивный вариант.

- [ ] **Step 6: Зафиксировать выводы письменно**

Конспект в `docs/notes/`, своими словами, не копируя из спеки:

- что такое дуальная запись и почему транзакция БД её не спасает;
- как её лечит transactional outbox и какой ценой (лишняя таблица,
  публикатор, задержка);
- почему в нашей схеме её нет: единственный писатель — шаг саги, и он
  пишет уже после того, как Hatchet принял событие;
- чем мы за это платим: `202` вместо `200`, «принято» вместо
  «сохранено», и фронт обязан показывать это честно.

Последний пункт напрямую переходит в Task 8.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(profile): публикация profile.completed без записи в БД"
```

---

## Task 7: Ветка таймаута и приветственный хвост

**Учебный акцент:** время как вход. Таймаут — не ошибка, а второй
штатный исход, и у него своя ветка DAG.

**Кто пишет:** ты. Механика уже знакома, здесь только ветвление.

**Files:**
- Create: `apps/person/src/hatchet/steps/send-reminder.ts`,
  `send-welcome.ts`
- Modify: `apps/person/src/hatchet/worker.service.ts`
- Test: `apps/person/test/timeout-branch.spec.ts`

**Interfaces:**
- Consumes: `AwaitProfileOutput` из Task 5.
- Produces: `SendReminderOutput = { reminded: boolean }`,
  `SendWelcomeOutput = { welcomed: boolean }`.

- [ ] **Step 1: Написать падающий тест на короткий таймаут**

Ждать 25 часов в тесте нельзя, поэтому окно берётся из переменной
окружения: `AWAIT_PROFILE_TIMEOUT` со значением по умолчанию `'25h'`.
Тест выставляет `'10s'`.

```ts
vi.setConfig({ testTimeout: 120_000 });

it('при истечении ожидания идёт в напоминание, а не в приветствие', async () => {
  // воркеры подняты с AWAIT_PROFILE_TIMEOUT=10s
  const { personId, runId } = await registerAndAwaitLink();

  const details = await waitForDone(hatchet, runId, 90_000);

  expect(details.taskRuns[STEP.awaitProfile].output).toEqual({
    timedOut: true, profileId: null,
  });
  expect(details.taskRuns[STEP.sendReminder].output).toEqual({ reminded: true });
  expect(details.taskRuns[STEP.markCompleted].output).toEqual({
    isProfileCompleted: false,
  });
  expect(details.taskRuns[STEP.sendWelcome].output).toEqual({ welcomed: false });

  const person = await getPerson(`/persons/${personId}`);
  expect(person.body.isProfileCompleted).toBe(false);
});

it('при успешном профиле напоминание не отправляется', async () => {
  const { personId, runId } = await registerAndAwaitLink();
  await pushProfileCompleted(personId);

  const details = await waitForDone(hatchet, runId, 60_000);

  expect(details.taskRuns[STEP.sendReminder].output).toEqual({ reminded: false });
  expect(details.taskRuns[STEP.sendWelcome].output).toEqual({ welcomed: true });
});
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `AWAIT_PROFILE_TIMEOUT=10s npx vitest run apps/person/test/timeout-branch.spec.ts`
Expected: FAIL — шаги возвращают заглушечные значения.

- [ ] **Step 3: Вынести таймаут в конфиг**

`executionTimeout` и `lookbackWindow` у `awaitProfile` берутся из
`process.env.AWAIT_PROFILE_TIMEOUT ?? '25h'`. Добавить переменную в
`.env.example` с комментарием, что короткие значения — только для тестов.

- [ ] **Step 4: Реализовать обе ветки**

Требования:

- `send-reminder`: читает выход `awaitProfile`; при `timedOut: false`
  возвращает `{ reminded: false }` и ничего не делает; при
  `timedOut: true` пишет лог через `ctx.logger.info` и возвращает
  `{ reminded: true }`.
- `send-welcome`: читает выход `markCompleted`; при
  `isProfileCompleted: false` — `{ welcomed: false }`; иначе лог и
  `{ welcomed: true }`.
- Логировать через `ctx.logger`, не через `console`: только тогда
  строки видны в UI на карточке шага. Это пригодится в Task 9.

- [ ] **Step 5: Прогнать тесты**

Run: `AWAIT_PROFILE_TIMEOUT=10s npx vitest run apps/person/test/timeout-branch.spec.ts`
Expected: PASS, 2 теста.

- [ ] **Step 6: Посмотреть обе ветки в UI**

Найти оба рана. Сравнить их DAG: где путь ушёл в напоминание, где — в
приветствие, и что оба рана при этом `COMPLETED`. Таймаут не красит ран
в красный, и это правильно: система отработала штатно.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: ветка таймаута с напоминанием и приветственный хвост"
```

---

## Task 8: Фронтенд

**Учебный акцент:** как выглядит асинхронный бэкенд с точки зрения
интерфейса. `202` значит «принято», и врать пользователю «сохранено»
нельзя.

**Кто пишет:** я. Здесь нет Hatchet, а времени съедает много.

**Files:**
- Create: `apps/web/` целиком (Vite, React, react-router)
- Modify: `.gitignore` (`apps/web/node_modules/`, `apps/web/dist/`)
- Test: `apps/web/src/api.test.ts`

**Interfaces:**
- Consumes: `POST /register`, `GET /registrations/:runId`,
  `GET /persons/:id` (Person); `GET /profiles/:token`,
  `POST /profiles/:token` (Profile).
- Produces: три маршрута — `/`, `/profile/:token`, `/status/:runId`.

- [ ] **Step 1: Создать приложение**

```bash
npm create vite@latest apps/web -- --template react-ts
cd apps/web && npm i && npm i react-router-dom
```

В `apps/web/.env`: `VITE_PERSON_URL=http://localhost:3001`,
`VITE_PROFILE_URL=http://localhost:3002`.

- [ ] **Step 2: Написать падающий тест клиента поллинга**

```ts
// apps/web/src/api.test.ts
it('поллит статус, пока не появится ссылка, и не чаще раза в секунду', async () => {
  const responses = [
    { status: 'pending' },
    { status: 'pending' },
    { status: 'linkReady', profileUrl: 'http://localhost:5173/profile/abc' },
  ];
  const fetchMock = vi.fn(async () => ({ ok: true, json: async () => responses.shift() }));

  const started = Date.now();
  const result = await pollRegistration('run-1', { fetch: fetchMock, intervalMs: 1000 });

  expect(result.profileUrl).toBe('http://localhost:5173/profile/abc');
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(Date.now() - started).toBeGreaterThanOrEqual(2000);
});

it('сдаётся по таймауту и говорит об этом, а не висит', async () => {
  const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ status: 'pending' }) }));

  await expect(
    pollRegistration('run-1', { fetch: fetchMock, intervalMs: 100, timeoutMs: 500 }),
  ).rejects.toThrow(/не дождались/i);
});
```

- [ ] **Step 3: Убедиться, что тесты падают**

Run: `cd apps/web && npx vitest run src/api.test.ts`
Expected: FAIL, `pollRegistration` не определена.

- [ ] **Step 4: Реализовать `api.ts` и три страницы**

- `RegisterPage` — email и пароль, отправка, переход на `/status/:runId`.
- `StatusPage` — поллит `GET /registrations/:runId`; при `linkReady`
  показывает ссылку на профиль; при `completed` — «профиль заполнен»;
  при `failed` — текст ошибки и кнопку повторить.
- `ProfilePage` — `GET /profiles/:token` для проверки, форма из трёх
  полей, `POST`. После `202` показывает **«данные приняты, сохраняем»**
  и переходит к отслеживанию статуса. Не «сохранено»: в этот момент
  профиля в базе ещё нет.
- Ошибку `410` показывать человеческим текстом: ссылка уже
  использована или устарела.

- [ ] **Step 5: Прогнать тесты**

Run: `cd apps/web && npx vitest run`
Expected: PASS, 2 теста.

- [ ] **Step 6: Пройти флоу руками**

Поднять всё, открыть `http://localhost:5173`, зарегистрироваться,
перейти по ссылке, заполнить, увидеть, как статус сам переключается на
«заполнен». Параллельно держать открытым UI Hatchet и смотреть, как
двигается ран.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(web): регистрация, форма профиля и страница статуса"
```

---

## Task 9: Наблюдаемость

**Учебный акцент:** найти нужный ран среди тысяч и починить упавший, не
трогая код.

**Кто пишет:** ты — руками в UI; я — вспомогательный скрипт.

**Files:**
- Modify: `apps/person/src/person/person.service.ts`
  (`additionalMetadata`)
- Create: `scripts/find-run.ts`
- Test: `apps/person/test/metadata.spec.ts`

**Interfaces:**
- Consumes: `hatchet.runs.list`, `getDetails`, `replay` из SDK.
- Produces: `npm run find-run -- <personId>` печатает `runId`, статус и
  выходы шагов.

- [ ] **Step 1: Написать падающий тест на метаданные**

```ts
it('ран находится по personId в additionalMetadata', async () => {
  const { personId } = await registerAndAwaitLink();

  const list = await hatchet.runs.list({
    additionalMetadata: { personId },
    onlyTasks: false,
    limit: 10,
  });

  expect(list.rows?.length).toBe(1);
  expect(list.rows![0].workflowName).toBe(ONBOARDING_WORKFLOW);
});
```

- [ ] **Step 2: Убедиться, что падает, и добавить метаданные**

Run: `npx vitest run apps/person/test/metadata.spec.ts`
Expected: FAIL, ноль строк.

Затем добавить `additionalMetadata: { personId }` в вызов `runNoWait`
(если это не было сделано в Task 4, Step 3) и прогнать снова.
Expected: PASS.

- [ ] **Step 3: Скрипт поиска рана**

`scripts/find-run.ts` — принимает `personId`, делает `runs.list` по
метаданным, затем `getDetails` по найденному `runId`, печатает таблицу:
шаг, статус, воркер, длительность, выход. Это тот инструмент, которым
на практике разбирают инцидент.

- [ ] **Step 4: Упражнение — сломать и починить через UI**

1. Погасить Profile, зарегистрироваться, дождаться, пока
   `issue-onboarding-link` исчерпает ретраи и ран станет `FAILED`.
2. Поднять Profile.
3. Найти ран **в UI по `personId`**, не по логам.
4. Нажать replay. Убедиться, что ран доходит до конца.
5. Проверить, что `ProfileLink` для этого `personId` по-прежнему одна.

- [ ] **Step 5: Разобрать реплей на вопросах**

Ответить письменно, проверяя догадки в UI:

- реплей перезапускает весь DAG или только упавший шаг?
- что было бы с уже отправленным письмом, будь `send-welcome`
  настоящим?
- какие шаги в нашей саге безопасны при повторе и за счёт чего
  конкретно — назвать механизм для каждого.

- [ ] **Step 6: Эвикция — прочитать и не внедрять**

В типах SDK есть `TaskRunDetail.isEvicted`, `runs.restoreTask` и
`runs.branchDurableTask`. Найти их в `node_modules`, прочитать
комментарии, записать в конспект, когда они нужны. В нашем проекте с
ожиданием в 25 часов эвикция не воспроизведётся — это знание про
эксплуатацию, а не про этот код. Реализовывать ничего не нужно.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: поиск рана по personId и скрипт разбора"
```

---

## Task 10: Сквозной тест и запуск одной командой

**Учебный акцент:** проект считается готовым, когда его можно поднять с
нуля на чистой машине.

**Кто пишет:** я.

**Files:**
- Create: `docker-compose.apps.yml`, `apps/person/Dockerfile`,
  `apps/profile/Dockerfile`, `apps/web/Dockerfile`
- Create: `test/e2e/onboarding.e2e.ts`
- Modify: `README.md`
- Modify: `package.json` (скрипты `up`, `down`, `test:e2e`)

**Interfaces:**
- Consumes: всё предыдущее.
- Produces: `npm run up` поднимает Hatchet, обе базы, оба сервиса и
  фронт; `npm run test:e2e` проходит сквозной сценарий.

- [ ] **Step 1: Написать сквозной тест**

```ts
vi.setConfig({ testTimeout: 180_000 });

it('полный путь: регистрация → ссылка → профиль → флаг', async () => {
  const email = unique('e2e@example.com');

  const reg = await fetch(`${PERSON}/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'pw-long-enough' }),
  }).then((r) => r.json());

  const link = await pollUntil(
    () => fetch(`${PERSON}/registrations/${reg.runId}`).then((r) => r.json()),
    (v) => v.status === 'linkReady',
    60_000,
  );

  const token = link.profileUrl.split('/').pop();

  const save = await fetch(`${PROFILE}/profiles/${token}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ firstName: 'Иван', lastName: 'Петров', city: 'Москва' }),
  });
  expect(save.status).toBe(202);

  const done = await pollUntil(
    () => fetch(`${PERSON}/registrations/${reg.runId}`).then((r) => r.json()),
    (v) => v.status === 'completed',
    90_000,
  );
  expect(done.isProfileCompleted).toBe(true);

  const person = await fetch(`${PERSON}/persons/${reg.personId}`).then((r) => r.json());
  expect(person.isProfileCompleted).toBe(true);
});
```

- [ ] **Step 2: Убедиться, что тест падает без поднятого стека**

Run: `npx vitest run --config vitest.config.e2e.ts test/e2e`
Expected: FAIL, отказ соединения.

- [ ] **Step 3: Dockerfile для сервисов**

Многостадийная сборка: `node:22-alpine`, `npm ci`, `prisma generate` по
нужной схеме, `nest build <app>`, запуск `node dist/apps/<app>/main`.
`DATABASE_URL` внутри сети смотрит на `postgres:5432`, адрес Hatchet —
на `hatchet-lite:7077`.

- [ ] **Step 4: `docker-compose.apps.yml`**

Сервисы `person`, `profile`, `web`. Подключаются к внешней сети
`hatchet_network` из существующего compose-файла. `depends_on` с
`condition: service_healthy` для Postgres. Миграции Prisma прогоняются
в команде запуска контейнера перед стартом приложения.

- [ ] **Step 5: Скрипты и README**

```json
{
  "scripts": {
    "up": "docker compose -f docker-compose.hatchet.yml -f docker-compose.apps.yml up -d --build",
    "down": "docker compose -f docker-compose.hatchet.yml -f docker-compose.apps.yml down",
    "test:e2e": "vitest run --config vitest.config.e2e.ts"
  }
}
```

README переписать: что это за проект, схема саги, как поднять, где UI
Hatchet, какие упражнения с поломками пройдены и что каждое показывает.

- [ ] **Step 6: Проверка с нуля**

```bash
npm run down && docker volume rm hatchettest_hatchet_lite_postgres_data
npm run up
npm run test:e2e
```

Expected: PASS. Если упало на первом прогоне из-за неготовности
Hatchet — это не флейк, а недостающий healthcheck; починить его, а не
добавлять `sleep`.

- [ ] **Step 7: Прогнать всё**

Run: `npm test && npm run test:e2e && cd apps/web && npx vitest run`
Expected: зелёные все наборы.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: сквозной тест и запуск всего стека одной командой"
```

---

## Что считать законченным проектом

Не «код работает», а:

- [ ] сага проходит end-to-end после `npm run up` на чистом томе;
- [ ] пройдены все четыре упражнения с поломками: лежащий Profile
      (Task 4), убитый воркер посреди ожидания (Task 5), гонка без
      `lookbackWindow` (Task 5), дуальная запись (Task 6);
- [ ] ты можешь без подсказки объяснить, почему `await-and-save-profile`
      исполняет воркер Profile, и что произойдёт, если снять с шага
      метку;
- [ ] ты можешь найти ран по `personId` и перезапустить его, не
      заглядывая в этот документ;
- [ ] ты можешь назвать, за счёт какого конкретного механизма
      идемпотентен каждый из пяти шагов.
