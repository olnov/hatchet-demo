import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { InfoController } from './info.controller.js';
import { InfoService } from './info.service.js';

describe('InfoController', () => {
  let controller: InfoController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InfoController],
      providers: [
        {
          provide: InfoService,
          useValue: {
            getProfile: vi.fn().mockResolvedValue({
              personId: 'person-1',
              expiresAt: new Date('2026-10-01T00:00:00.000Z'),
            }),
            submit: vi.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<InfoController>(InfoController);
  });

  it('returns the active profile-link metadata for a token', async () => {
    await expect(controller.getProfile('active-token')).resolves.toEqual({
      personId: 'person-1',
      expiresAt: new Date('2026-10-01T00:00:00.000Z'),
    });
  });
});
