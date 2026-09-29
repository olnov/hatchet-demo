import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module';
import { type TestApp, createTestApp, unique } from '../../../test/helpers';

let app: TestApp;

beforeAll(async () => {
  app = await createTestApp(AppModule);
});

afterAll(async () => {
  await app.close();
});

describe('persons API', () => {
  it('returns a safe person representation and marks profile completion', async () => {
    const registration = await app.post('/register', {
      email: unique('person@example.com'),
      password: 'correct horse battery staple',
    });
    const personId = registration.body.personId as string;

    const person = await app.get(`/persons/${personId}`);
    expect(person.status).toBe(200);
    expect(person.body).toMatchObject({
      id: personId,
      isProfileCompleted: false,
    });
    expect(person.body).not.toHaveProperty('passwordHash');

    const completed = await app.patch(`/persons/${personId}/profile-completed`);
    expect(completed.status).toBe(200);
    expect(completed.body.isProfileCompleted).toBe(true);
  });
});
