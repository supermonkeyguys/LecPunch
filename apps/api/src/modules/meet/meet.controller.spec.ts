import { GUARDS_METADATA } from '@nestjs/common/constants';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { MeetController } from './meet.controller';

describe('MeetController', () => {
  const meetService = { issueToken: vi.fn() };
  let controller: MeetController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new MeetController(meetService as any);
  });

  it('uses only the authenticated caller and requested room', async () => {
    meetService.issueToken.mockResolvedValue({ token: 'token', room: 'room-1' });

    await expect(controller.getToken({ userId: 'user-1' } as any, { room: 'room-1' })).resolves.toEqual({
      token: 'token',
      room: 'room-1'
    });
    expect(meetService.issueToken).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1' }), 'room-1');
  });

  it('requires the normal JWT guard, so unauthenticated requests are rejected before the handler', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, MeetController)).toContain(JwtAuthGuard);
  });
});
