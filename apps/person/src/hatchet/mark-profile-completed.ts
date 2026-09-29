import type { MarkCompletedOutput } from '@contracts';
import type { PersonsService } from '../persons/persons.service.js';

/** Keeps the database operation in Nest's PersonsService and its Prisma DI. */
export async function markProfileCompleted(
  persons: PersonsService,
  personId: string,
): Promise<MarkCompletedOutput> {
  const person = await persons.markProfileCompleted(personId);
  return { isProfileCompleted: person.isProfileCompleted };
}
