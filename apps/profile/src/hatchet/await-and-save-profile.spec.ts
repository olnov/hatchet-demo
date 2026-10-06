import { describe, expect, it, vi } from 'vitest';

import { awaitAndSaveProfile } from './await-and-save-profile.js';

describe('awaitAndSaveProfile', () => {
  it('waits for this person event and saves the received profile', async () => {
    const waitForEvent = vi.fn().mockResolvedValue({
      personId: 'person-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      personalStatement: 'First programmer',
    });
    const saveProfile = vi.fn().mockResolvedValue({ id: 'profile-1' });

    const result = await awaitAndSaveProfile(
      { personId: 'person-1', email: 'ada@example.com' },
      { waitForEvent } as never,
      saveProfile,
    );

    expect(waitForEvent).toHaveBeenCalledWith(
      'profile.completed',
      "input.personId == 'person-1'",
      expect.anything(),
      'person:person-1',
      '25h',
    );
    expect(saveProfile).toHaveBeenCalledWith('person-1', {
      firstName: 'Ada',
      lastName: 'Lovelace',
      personalStatement: 'First programmer',
    });
    expect(result).toEqual({ timedOut: false, profileId: 'profile-1' });
  });
});
