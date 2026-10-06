import { describe, expect, it, vi } from 'vitest';

const { pushEvent } = vi.hoisted(() => ({ pushEvent: vi.fn() }));

vi.mock('../hatchet/client.js', () => ({
  hatchet: { events: { push: pushEvent } },
}));

import { InfoService } from './info.service.js';

describe('InfoService', () => {
  it('returns the profile-link metadata for an active token', async () => {
    const links = {
      requireActive: vi.fn().mockResolvedValue({
        personId: 'person-1',
        expiresAt: new Date('2026-10-01T00:00:00.000Z'),
      }),
    };
    const service = new InfoService({} as never, links as never);

    await expect(service.getProfile('active-token')).resolves.toEqual({
      personId: 'person-1',
      expiresAt: new Date('2026-10-01T00:00:00.000Z'),
    });
  });

  it('publishes profile.completed for the person from the active link', async () => {
    const links = {
      requireActive: vi.fn().mockResolvedValue({ personId: 'person-1' }),
    };
    const service = new InfoService({} as never, links as never);

    const result = await service.submit('token-1', {
      firstName: 'Ada',
      lastName: 'Lovelace',
      personalStatement: 'Engineer',
    });

    expect(result).toEqual({ personId: 'person-1' });
    expect(pushEvent).toHaveBeenCalledWith(
      'profile.completed',
      {
        personId: 'person-1',
        firstName: 'Ada',
        lastName: 'Lovelace',
        personalStatement: 'Engineer',
      },
      { scope: 'person:person-1' },
    );
  });
});
