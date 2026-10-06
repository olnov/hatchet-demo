import { z } from 'zod';

export const NewUserSchema = z.object({
  email: z.email(),
  passwordHash: z.string().min(8),
  onboardingRunId: z.string().optional(),
});

export type NewUserDto = z.infer<typeof NewUserSchema>;

export const UserSchema = z.object({
  id: z.string(),
  email: z.email(),
  passwordHash: z.string(),
  isProfileCompleted: z.boolean(),
  onboardingRunId: z.string().optional().nullable(),
  createdAt: z.date(),
});

export type UserDto = z.infer<typeof UserSchema>;