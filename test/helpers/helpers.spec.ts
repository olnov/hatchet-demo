import { unique, pollUntil } from './index.js';

describe('unique', () => {
  it('сохраняет домен и делает локальную часть разной', () => {
    const a = unique('user@example.com');
    const b = unique('user@example.com');

    expect(a).toMatch(/^user\+[0-9a-f]{8}@example\.com$/);
    expect(a).not.toBe(b);
  });
});

describe('pollUntil', () => {
  it('возвращает первое состояние, удовлетворяющее условию', async () => {
    const states = [1, 2, 3];
    let i = 0;

    const result = await pollUntil(async () => states[i++], (v) => v === 3, 5_000, 1);

    expect(result).toBe(3);
  });

  it('падает по таймауту и показывает последнее состояние', async () => {
    await expect(
      pollUntil(async () => ({ status: 'pending' }), () => false, 50, 10),
    ).rejects.toThrow(/не дождались.*pending/s);
  });
});
