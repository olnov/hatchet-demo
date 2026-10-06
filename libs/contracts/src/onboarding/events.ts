import { z } from 'zod';

export const PROFILE_COMPLETED_EVENT = 'profile.completed';

export const ProfileCompletedSchema = z.object({
  personId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  personalStatement: z.string(),
});

export type ProfileCompleted = z.infer<typeof ProfileCompletedSchema>;

export function profileScope(personId: string): string {
  return `person:${personId}`;
}
