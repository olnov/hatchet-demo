import { z } from 'zod';

export const IssueProfileLinkSchema = z.object({
  personId: z.string().uuid(),
});

export type IssueProfileLinkDto = z.infer<typeof IssueProfileLinkSchema>;
