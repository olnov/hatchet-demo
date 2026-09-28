import { z } from 'zod';

export const NewInfoSchema = z.object({
  firstName: z.string().max(30),
  lastName: z.string().max(30),
  personalStatement: z.string().max(1500),
});

export type NewInfoDto = z.infer<typeof NewInfoSchema>;

export const InfoSchema = z.object({
  id: z.string(),
  firstName: z.string().max(30),
  lastName: z.string().max(30),
  personalStatement: z.string().max(1500),
  createdAt: z.date(),
});

export type InfoDto = z.infer<typeof InfoSchema>;