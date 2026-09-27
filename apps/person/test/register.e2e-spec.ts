import { describe, it, expect } from 'vitest';
import { prisma, post, unique } from './utils';

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