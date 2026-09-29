import { buildOnboardingWorkflow, STEP, type AwaitProfileOutput, type StepImpls } from '@contracts';

import type { PersonsService } from '../persons/persons.service.js';
import { hatchet } from './client';
import { issueProfileLink } from './issue-profile-link';
import { markProfileCompleted } from './mark-profile-completed';

/**
 * Только шаги, которыми владеет сервис Person.
 *
 * Общая схема workflow (все пять шагов и их зависимости) объявлена в
 * `libs/contracts`. Profile-воркер зарегистрирует точно ту же схему, но
 * передаст реализации только своих шагов.
 */
export function createPersonOnboardingWorkflow(persons: PersonsService) {
const personSteps: StepImpls = {
  /**
   * Первый шаг саги.
   *
   * Person не создаёт ссылку сам: он вызывает внутренний API Profile.
   * Этот шаг настроен с retry в общем builder'е, поэтому `issueProfileLink`
   * обязан быть идемпотентным: повторный вызов для того же personId должен
   * вернуть уже существующую активную ссылку.
   */
  [STEP.issueLink]: async (input) => {
    return issueProfileLink(input.personId);
  },

  /**
   * Выполняется после Profile-шагa `await-and-save-profile`.
   *
   * `parentOutput` читает результат именно родительской задачи из Hatchet.
   * Если пользователь не заполнил профиль до таймаута, это штатный исход:
   * Person не меняем и возвращаем понятный результат для истории run'а.
   */
  [STEP.markCompleted]: async (input, ctx) => {
    const profileResult = await ctx.parentOutput<AwaitProfileOutput>(STEP.awaitProfile);

    if (profileResult.timedOut) {
      return { isProfileCompleted: false };
    }

    return markProfileCompleted(persons, input.personId);
  },

  /**
   * В учебном проекте это намеренно только лог.
   * Напоминание посылается лишь при таймауте ожидания профиля; при успешном
   * заполнении оно ничего не делает.
   */
  [STEP.sendReminder]: async (_input, ctx) => {
    const profileResult = await ctx.parentOutput<AwaitProfileOutput>(STEP.awaitProfile);

    if (profileResult.timedOut) {
      console.log('Profile was not completed in time');
    }
    return { reminded: profileResult.timedOut };
  },

  /**
   * Финальный шаг успешной ветки. Пока это заглушка вместо реальной почты.
   */
  [STEP.sendWelcome]: async (input) => {
    console.log(`Welcome, ${input.email}`);
    return { welcomed: true };
  },
};

// Экспортируется та же DAG, что и у Profile. Запускает её person-worker.ts.
return buildOnboardingWorkflow(
  hatchet,
  personSteps,
);
}
