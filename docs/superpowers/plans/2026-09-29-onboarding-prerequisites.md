# Onboarding Prerequisites Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the HTTP and UI prerequisites for user registration, manually issued profile links, and profile completion before Hatchet orchestration is introduced.

**Architecture:** Person owns account creation and the completion flag. Profile owns invitation links and profile data, then calls Person through a narrow internal HTTP client after a successful direct save. The Next.js app calls only API-client modules: registration leads to a manual invitation handoff, then a tokenized profile route validates and submits the form.

**Tech Stack:** NestJS 12, Prisma 7/PostgreSQL, Zod 4, Vitest 4, Next.js 16 App Router, React 19, Tailwind CSS 4.

**Spec:** `docs/superpowers/specs/2026-09-29-onboarding-prerequisites-design.md`

## Global Constraints

- Do not introduce Hatchet SDK usage, workflows, workers, run IDs, events, polling, or retries in this stage.
- Keep `apps/web` as one Next.js application; page routes remain under `apps/web/app/(pages)/`.
- Use `personId` consistently; do not expose `passwordHash` from any Person API response.
- Profile links use a 24-hour expiry and a cryptographically secure token.
- Preserve the existing user’s uncommitted route-group move and Person API client; do not reset or overwrite unrelated changes.
- Read `apps/web/AGENTS.md` and the relevant local Next.js documentation before modifying Next.js code.

## Review Focus

- Duplicate email: a second registration must return `409` and leave one Person record; test in Task 2.
- Token reuse and expiry: both must return `410` without creating another profile; test in Task 3.
- Race/retry on link issue: two issue calls for one person must return the same active token; test in Task 1.
- Person completion failure: profile save must surface `502` when Person API cannot be reached; test in Task 3.
- Browser-visible errors: invalid or expired token and rejected form submission must be explained, not silently fail; test in Task 4.

---

## File Structure

- `apps/profile/prisma/schema.prisma` and a new migration add `personId @unique` to `Info` and persist `ProfileLink`.
- `apps/profile/src/profile-links/` owns token generation, validation, and the internal link controller.
- `apps/profile/src/info/` owns direct profile persistence and calls Person through a dedicated `PersonClient`.
- `apps/person/src/registration/` owns the registration boundary; `apps/person/src/persons/` owns safe reads and the completion marker.
- `apps/web/app/api/` owns typed browser HTTP calls; page files own UI state only.

### Task 1: Profile link persistence and internal API

**Files:**
- Modify: `apps/profile/prisma/schema.prisma`
- Create: `apps/profile/prisma/migrations/<timestamp>_add_profile_links/migration.sql`
- Create: `apps/profile/src/profile-links/profile-links.service.ts`
- Create: `apps/profile/src/profile-links/profile-links.controller.ts`
- Create: `apps/profile/src/profile-links/profile-links.module.ts`
- Create: `apps/profile/src/profile-links/dto/profile-link.dto.ts`
- Test: `apps/profile/src/profile-links/profile-links.service.spec.ts`
- Modify: `apps/profile/src/app.module.ts`

**Interfaces:**
- Consumes: Prisma `ProfileLink { token, personId, expiresAt, usedAt }`.
- Produces: `ProfileLinksService.issue(personId: string): Promise<{ token: string; profileUrl: string; expiresAt: Date }>` and `ProfileLinksService.requireActive(token: string): Promise<ProfileLink>`; `POST /api/v1/internal/links` accepts `{ personId }`.

- [ ] **Step 1: Write failing service tests for issue idempotency and invalid-token status**

```ts
it('returns the same active link for a repeated personId', async () => {
  const first = await service.issue('person-1');
  const second = await service.issue('person-1');
  expect(second.token).toBe(first.token);
});

it('rejects an expired or used token as gone', async () => {
  await expect(service.requireActive('expired-token')).rejects.toMatchObject({ status: 410 });
});
```

- [ ] **Step 2: Run the new test file and verify it fails because `ProfileLinksService` does not exist**

Run: `npx vitest run apps/profile/src/profile-links/profile-links.service.spec.ts`

Expected: FAIL with missing module/service.

- [ ] **Step 3: Add `ProfileLink` persistence and implement `ProfileLinksService`**

Add `Info.personId String @unique`; generate 32-byte URL-safe tokens with `node:crypto`; make `issue` return an existing unused unexpired link, otherwise create a new link expiring at `Date.now() + 24 * 60 * 60 * 1000`. `requireActive` throws Nest `GoneException` for used or expired tokens and `NotFoundException` for unknown tokens. Build `profileUrl` from `WEB_ORIGIN` (default `http://localhost:3000`).

- [ ] **Step 4: Add `ProfileLinksController` and its Zod DTO**

Implement `POST /internal/links` with `{ personId: z.string().uuid() }`, returning `201` and `{ token, profileUrl, expiresAt }`. Register the module in `AppModule`.

- [ ] **Step 5: Create and apply the Prisma migration, then regenerate the Profile client**

Run: `npx prisma migrate dev --schema apps/profile/prisma/schema.prisma --name add_profile_links`

Expected: migration directory contains the `Info.personId` unique column and `ProfileLink` table; generated client includes both models.

- [ ] **Step 6: Run the focused tests and commit the persistence/API unit**

Run: `npx vitest run apps/profile/src/profile-links/profile-links.service.spec.ts`

Expected: PASS.

```bash
git add apps/profile/prisma apps/profile/src/profile-links apps/profile/src/app.module.ts
git commit -m "feat(profile): add profile link API"
```

### Task 2: Person registration and completion API

**Files:**
- Create: `apps/person/src/registration/registration.controller.ts`
- Create: `apps/person/src/registration/registration.service.ts`
- Create: `apps/person/src/registration/registration.module.ts`
- Create: `apps/person/src/registration/dto/register.dto.ts`
- Create: `apps/person/src/persons/persons.controller.ts`
- Create: `apps/person/src/persons/persons.service.ts`
- Create: `apps/person/src/persons/persons.module.ts`
- Test: `apps/person/test/register.e2e-spec.ts`
- Create: `apps/person/test/persons.e2e-spec.ts`
- Modify: `apps/person/src/app.module.ts`

**Interfaces:**
- Consumes: `AuthService.hashPassword(password: string)` and Prisma `Person`.
- Produces: `POST /register` accepts `{ email, password }` and returns `{ personId, email }`; `GET /persons/:id` returns safe Person data; `PATCH /persons/:id/profile-completed` sets `isProfileCompleted: true`.

- [ ] **Step 1: Replace the registration test’s assumed contract with explicit response and duplicate assertions**

```ts
expect(res.status).toBe(201);
expect(res.body).toMatchObject({ personId: expect.any(String), email });
expect(res.body).not.toHaveProperty('passwordHash');
expect((await app.post('/register', { email, password })).status).toBe(409);
```

- [ ] **Step 2: Add failing tests for safe person retrieval and the idempotent completion marker**

```ts
expect((await app.get(`/persons/${personId}`)).body).not.toHaveProperty('passwordHash');
expect((await app.patch(`/persons/${personId}/profile-completed`)).body.isProfileCompleted).toBe(true);
```

- [ ] **Step 3: Run the Person e2e files and verify the new endpoints fail**

Run: `npx vitest run apps/person/test/register.e2e-spec.ts apps/person/test/persons.e2e-spec.ts`

Expected: FAIL with `404` for `/persons/...` and/or response-shape mismatches.

- [ ] **Step 4: Implement the registration and persons modules**

`RegistrationService.register(input)` hashes `input.password`, maps Prisma uniqueness error `P2002` to `ConflictException`, and returns only `{ personId: person.id, email: person.email }`. `PersonsService.get(id)` returns `{ id, email, isProfileCompleted, createdAt }`; `markProfileCompleted(id)` updates the flag and is safe when already true. Register both modules in `AppModule`; retain unrelated legacy user routes only if current callers still use them.

- [ ] **Step 5: Run focused Person tests and commit the Person API unit**

Run: `npx vitest run apps/person/test/register.e2e-spec.ts apps/person/test/persons.e2e-spec.ts`

Expected: PASS.

```bash
git add apps/person/src apps/person/test/register.e2e-spec.ts apps/person/test/persons.e2e-spec.ts
git commit -m "feat(person): add registration and completion APIs"
```

### Task 3: Profile submission and cross-service completion call

**Files:**
- Modify: `apps/profile/src/info/dto/info.dto.ts`
- Modify: `apps/profile/src/info/info.service.ts`
- Modify: `apps/profile/src/info/info.controller.ts`
- Modify: `apps/profile/src/info/info.module.ts`
- Create: `apps/profile/src/person-client/person-client.service.ts`
- Create: `apps/profile/src/person-client/person-client.module.ts`
- Test: `apps/profile/src/info/info.service.spec.ts`
- Create: `apps/profile/test/profiles.e2e-spec.ts`

**Interfaces:**
- Consumes: `ProfileLinksService.requireActive(token)`, `ProfileLinksService.markUsed(token)`, and `PersonClient.markProfileCompleted(personId)`.
- Produces: `GET /profiles/:token` returns `{ personId, expiresAt }`; `POST /profiles/:token` accepts `{ firstName, lastName, personalStatement }` and returns `{ profileId, personId }`.

- [ ] **Step 1: Write failing tests for profile submission, token reuse, and Person API failure**

```ts
it('saves Info with the link personId and completes the Person', async () => {
  const result = await service.submit(token, validInfo);
  expect(result).toEqual({ profileId: expect.any(String), personId });
  expect(personClient.markProfileCompleted).toHaveBeenCalledWith(personId);
});

it('returns gone when the token is submitted twice', async () => {
  await service.submit(token, validInfo);
  await expect(service.submit(token, validInfo)).rejects.toMatchObject({ status: 410 });
});
```

- [ ] **Step 2: Run the service test and verify it fails because `submit` and `PersonClient` do not exist**

Run: `npx vitest run apps/profile/src/info/info.service.spec.ts`

Expected: FAIL with missing service methods/providers.

- [ ] **Step 3: Implement `PersonClient` and token-scoped profile operations**

`PersonClient.markProfileCompleted(personId)` performs `PATCH ${PERSON_API_URL ?? 'http://localhost:3001/api/v1'}/persons/${personId}/profile-completed`; any non-2xx/network result becomes `BadGatewayException`. `InfoService.submit(token, input)` validates the token, writes `Info` with the link’s `personId`, marks the link used, then calls Person. `InfoController` exposes only `GET`/`POST /profiles/:token` for this flow; retain unrelated read endpoints only when they have callers.

- [ ] **Step 4: Add e2e-level HTTP assertions for 404, 410, and 502**

Create fixture links through `POST /internal/links`; assert unknown token gives `404`, expired/used token gives `410`, and a configured failing Person client returns `502` after Profile’s local write.

- [ ] **Step 5: Run Profile tests and commit the profile-completion unit**

Run: `npx vitest run apps/profile/src/profile-links/profile-links.service.spec.ts apps/profile/src/info/info.service.spec.ts apps/profile/test/profiles.e2e-spec.ts`

Expected: PASS.

```bash
git add apps/profile/src apps/profile/test/profiles.e2e-spec.ts
git commit -m "feat(profile): submit tokenized profiles"
```

### Task 4: Web API clients and the three-page manual flow

**Files:**
- Modify: `apps/web/app/api/person.ts`
- Create: `apps/web/app/api/profile.ts`
- Create: `apps/web/app/api/http.ts`
- Modify: `apps/web/app/(pages)/person/page.tsx`
- Modify: `apps/web/app/(pages)/invite/page.tsx`
- Create: `apps/web/app/(pages)/profile/[token]/page.tsx`
- Modify: `apps/web/app/(pages)/page.tsx`
- Test: `apps/web/app/api/person.spec.ts`
- Create: `apps/web/app/api/profile.spec.ts`
- Create: `apps/web/app/(pages)/invite/page.spec.ts`
- Create: `apps/web/app/(pages)/profile/[token]/page.spec.ts`

**Interfaces:**
- Consumes: Person `POST /register`, Profile `GET/POST /profiles/:token`; page components call API-client exports only.
- Produces: `registerPerson(input)`, `getProfileLink(token)`, and `submitProfile(token, input)`; navigation `/person` → `/invite?personId=...` → `/profile/[token]`.

- [ ] **Step 1: Read the required local Next.js route and client-component documentation**

Read `apps/web/AGENTS.md`, `apps/web/node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md`, and the local dynamic-routes documentation before editing the App Router files.

- [ ] **Step 2: Write failing API-client tests for successful parsing and error mapping**

```ts
expect(await registerPerson({ email: 'a@example.com', password: 'pw-long-enough' })).toEqual({ personId: 'id-1', email: 'a@example.com' });
await expect(getProfileLink('expired')).rejects.toMatchObject({ status: 410 });
```

- [ ] **Step 3: Run the API-client tests and verify they fail because the new exports do not exist**

Run: `npx vitest run apps/web/app/api/person.spec.ts apps/web/app/api/profile.spec.ts`

Expected: FAIL with missing exports/modules.

- [ ] **Step 4: Implement a shared HTTP error boundary and typed client functions**

Use `NEXT_PUBLIC_PERSON_API_URL` and `NEXT_PUBLIC_PROFILE_API_URL` with localhost defaults. `http.ts` exports `ApiError { status: number; message: string }` and parses non-OK JSON/text. Rename the browser payload field from `passwordHash` to `password`; no UI/client code sends a hashed password.

- [ ] **Step 5: Write failing page tests for the complete UI handoff and error states**

```ts
expect(renderToStaticMarkup(createElement(Invite))).toContain('personId');
expect(renderToStaticMarkup(createElement(ProfilePage, { params: Promise.resolve({ token: 'expired' }) }))).toContain('ссылка');
```

Use component-level dependency injection or a mocked API-client module only at the network boundary; assert user-visible behavior, not mock calls.

- [ ] **Step 6: Implement the route components**

Make `/person` a client form that calls `registerPerson` and navigates to `/invite?personId=<id>`. Make `/invite` explain manual invocation of `POST /internal/links`, accept a token or full `profileUrl`, normalize it, and navigate to `/profile/<token>`. Make `/profile/[token]` a client form that first validates the token, shows explicit 404/410 states, submits the three fields, and shows the saved confirmation. Update home navigation to link to Person and Invite.

- [ ] **Step 7: Run web unit tests and lint, then commit the web flow**

Run: `npx vitest run apps/web/app/api/person.spec.ts apps/web/app/api/profile.spec.ts apps/web/app/\(pages\)/invite/page.spec.ts apps/web/app/\(pages\)/profile/\[token\]/page.spec.ts`

Expected: PASS.

Run: `npm run lint`

Workdir: `apps/web`

Expected: PASS.

```bash
git add apps/web/app
git commit -m "feat(web): add manual onboarding flow"
```

### Task 5: Final integration verification and handoff notes

**Files:**
- Modify: `README.md`
- Modify: `apps/web/README.md`
- Test: `apps/person/test/register.e2e-spec.ts`
- Test: `apps/profile/test/profiles.e2e-spec.ts`

**Interfaces:**
- Consumes: all HTTP endpoints and pages from Tasks 1–4.
- Produces: documented manual walkthrough and explicit boundary to the future Hatchet task.

- [ ] **Step 1: Write the manual walkthrough in the READMEs**

Document service URLs, Swagger URLs, required `PERSON_DATABASE_URL`, `PROFILE_DATABASE_URL`, `PERSON_API_URL`, `WEB_ORIGIN`, and browser API URL variables. Include exact manual sequence: register, copy `personId`, issue link with Profile Swagger/curl, paste token into Invite, complete the profile, retrieve Person and see `isProfileCompleted: true`.

- [ ] **Step 2: Add a failing cross-service integration test for direct completion**

The test starts both Nest apps with test databases, registers one user, issues a link, submits profile data, and asserts Person is completed. Keep Hatchet out of setup and assertions.

- [ ] **Step 3: Run the integration test to verify the full direct HTTP flow**

Run: `npx vitest run apps/person/test/register.e2e-spec.ts apps/profile/test/profiles.e2e-spec.ts`

Expected: PASS with the Profile service configured to call the test Person API.

- [ ] **Step 4: Run repository and web verification, then commit docs**

Run: `npm test`

Expected: PASS; if pre-existing unrelated failing tests remain, report each by path and error before handoff.

Run: `npm run build`

Workdir: `apps/web`

Expected: PASS; if blocked by external font download, report the network failure distinctly from application failures.

```bash
git add README.md apps/web/README.md
git commit -m "docs: explain manual onboarding prerequisites"
```

## Plan Self-Review

- Spec coverage: Tasks 1–3 implement data and API contracts; Task 4 implements all three web pages and clients; Task 5 documents and verifies the manual path. Hatchet, email, authentication, and retry logic remain explicitly excluded.
- Step scan: every task begins with a failing test and contains focused implementation, verification, and commit steps.
- Type consistency: `personId`, token URL, `ProfileLinksService`, `PersonClient`, `registerPerson`, `getProfileLink`, and `submitProfile` are defined once and consumed by later tasks.
- Review focus: duplicate email is Task 2; link race/reuse/expiry are Tasks 1 and 3; Person failure is Task 3; browser errors are Task 4.
- Proportion: five independently reviewable deliverables cover persistence, each service boundary, UI, and final verification without prescribing implementation bodies.
