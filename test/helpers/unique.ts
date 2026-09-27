import { randomUUID } from 'node:crypto';

/**
 * Делает email уникальным для прогона: 'a@example.com' -> 'a+3f2c1e9d@example.com'.
 *
 * Тесты идут против реальной базы и не чистят её за собой. Без этого
 * второй прогон падал бы на уникальности email, а тест, создавший
 * 'a@example.com', ломал бы любой следующий с тем же адресом.
 */
export function unique(email: string): string {
  const [local, domain] = email.split('@');
  return `${local}+${randomUUID().slice(0, 8)}@${domain}`;
}
