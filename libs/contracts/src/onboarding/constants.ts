// TypeScript-представления payload'ов саги. Они используются в обработчиках
// задач; runtime-проверка входящих данных находится в schemas.ts.
export type OnboardingInput = { personId: string; email: string };

export type IssueLinkOutput = { token: string; profileUrl: string };

export type AwaitProfileOutput =
  { timedOut: false; profileId: string } | { timedOut: true; profileId: null };

export type MarkCompletedOutput = { isProfileCompleted: boolean };
export type SendReminderOutput = { reminded: boolean };
export type SendWelcomeOutput = { welcomed: boolean };
