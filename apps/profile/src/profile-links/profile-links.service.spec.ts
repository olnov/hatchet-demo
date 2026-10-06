import { describe, expect, it, vi } from 'vitest';

import { ProfileLinksService } from './profile-links.service.js';

describe('ProfileLinksService', () => {
  it('returns the same active link for a repeated personId', async () => {
    const existingLink = {
      token: 'existing-token',
      personId: 'person-1',
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    };
    const prisma = {
      profileLink: {
        findUnique: vi.fn().mockResolvedValue(existingLink),
        create: vi.fn(),
      },
    };
    const service = new ProfileLinksService(prisma as never, {
      get: vi.fn().mockReturnValue('http://localhost:3000'),
    } as never);

    const first = await service.issue('person-1');
    const second = await service.issue('person-1');

    expect(first.token).toBe('existing-token');
    expect(second.token).toBe(first.token);
    expect(prisma.profileLink.create).not.toHaveBeenCalled();
  });

  it('rejects an expired token as gone', async () => {
    const prisma = {
      profileLink: {
        findUnique: vi.fn().mockResolvedValue({
          token: 'expired-token',
          personId: 'person-1',
          expiresAt: new Date(Date.now() - 60_000),
          usedAt: null,
        }),
      },
    };
    const service = new ProfileLinksService(prisma as never, {} as never);

    await expect(service.requireActive('expired-token')).rejects.toMatchObject({
      status: 410,
    });
  });
});
