export interface HttpResponse<T = any> {
  status: number;
  body: T;
}

/**
 * Клиент к УЖЕ ЗАПУЩЕННОМУ сервису по сети.
 *
 * Отличие от createTestApp принципиальное: здесь сервис живёт отдельным
 * процессом. Для саги это и проверяется — что шаги исполняют разные
 * воркеры в разных процессах, а не один процесс сам с собой.
 */
export function httpClient(baseUrl: string) {
  const call = async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: body === undefined ? headers : { 'content-type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return {
      status: res.status,
      body: text ? (JSON.parse(text) as unknown) : undefined,
    } as HttpResponse;
  };

  return {
    post: (path: string, body?: unknown, headers?: Record<string, string>) =>
      call('POST', path, body ?? {}, headers),
    get: (path: string, headers?: Record<string, string>) =>
      call('GET', path, undefined, headers),
  };
}

export const personApi = () => httpClient(process.env.PERSON_URL ?? 'http://localhost:3001');
export const profileApi = () => httpClient(process.env.PROFILE_URL ?? 'http://localhost:3002');
