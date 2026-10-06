import { z } from 'zod';

// Вход каждого запуска саги. Person создаёт его после регистрации.
export const OnboardingInputSchema = z.object({
  personId: z.string(),
  email: z.email(),
});

// Результат первого шага: ссылка, которую фронтенд покажет пользователю.
export const IssueLinkOutputSchema = z.object({
  token: z.string(),
  profileUrl: z.url(),
});

// У durable Profile-шага есть два штатных результата: профиль сохранён
// или ожидание истекло. Таймаут — не ошибка workflow.
export const AwaitProfileOutputSchema = z.union([
  z.object({ timedOut: z.literal(false), profileId: z.string() }),
  z.object({ timedOut: z.literal(true), profileId: z.null() }),
]);

// Результат idempotent-обновления Person после сохранения профиля.
export const MarkCompletedOutputSchema = z.object({
  isProfileCompleted: z.boolean(),
});