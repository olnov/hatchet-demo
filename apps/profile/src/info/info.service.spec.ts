import { describe, expect, it, vi } from 'vitest';

import { InfoService } from './info.service.js';

describe('InfoService', () => {
  it('returns the profile-link metadata for an active token', async () => {
    const links = {
      requireActive: vi.fn().mockResolvedValue({
        personId: 'person-1',
        expiresAt: new Date('2026-10-01T00:00:00.000Z'),
      }),
    };
    const service = new InfoService({} as never, links as never, {} as never);

    await expect(service.getProfile('active-token')).resolves.toEqual({
      personId: 'person-1',
      expiresAt: new Date('2026-10-01T00:00:00.000Z'),
    });
  });

  it('saves Info with the link personId and completes the Person', async () => {
    const links = {
      requireActive: vi.fn().mockResolvedValue({ personId: 'person-1' }),
      markUsed: vi.fn().mockResolvedValue(undefined),
    };
    const personClient = { markProfileCompleted: vi.fn().mockResolvedValue(undefined) };
    const prisma = { info: { create: vi.fn().mockResolvedValue({ id: 'profile-1' }) } };
    const service = new InfoService(prisma as never, links as never, personClient as never);

    const result = await service.submit('token-1', {
      firstName: 'Ada',
      lastName: 'Lovelace',
      personalStatement: 'Engineer',
    });

    expect(result).toEqual({ profileId: 'profile-1', personId: 'person-1' });
    expect(personClient.markProfileCompleted).toHaveBeenCalledWith('person-1');
  });
});
