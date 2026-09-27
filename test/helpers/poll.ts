export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Опрашивает `probe`, пока `done` не вернёт true, либо пока не выйдет время.
 *
 * Нужен потому, что почти всё в этом проекте асинхронно: сага не
 * завершается к моменту ответа HTTP. Таймаут обязателен — тест, который
 * висит, хуже теста, который падает.
 */
export async function pollUntil<T>(
  probe: () => Promise<T>,
  done: (value: T) => boolean,
  timeoutMs: number,
  intervalMs = 500,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last: T = await probe();

  while (!done(last)) {
    if (Date.now() >= deadline) {
      throw new Error(
        `не дождались за ${timeoutMs}ms; последнее состояние: ${JSON.stringify(last)}`,
      );
    }
    await sleep(intervalMs);
    last = await probe();
  }

  return last;
}
