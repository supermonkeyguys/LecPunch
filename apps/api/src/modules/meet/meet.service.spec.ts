import { JwtService } from '@nestjs/jwt';
import { describe, expect, it } from 'vitest';
import type { AuthUser } from '../auth/types/auth-user.type';
import { MeetService, MEET_TOKEN_TTL_SECONDS } from './meet.service';

const appId = 'lecpunch-lan-meet';
const meetSecret = 'f'.repeat(64);
const user: AuthUser = {
  userId: 'member-123',
  teamId: 'team-1',
  role: 'member',
  username: 'member',
  displayName: 'Member',
  enrollYear: 2026
};

describe('MeetService', () => {
  it('issues a five-minute HS256 token with the Jitsi room and authenticated user claims', async () => {
    const jwtService = new JwtService();
    const configService = {
      getOrThrow: (key: string) => ({
        MEET_JWT_APP_ID: appId,
        MEET_JWT_SECRET: meetSecret
      })[key]
    };
    const service = new MeetService(jwtService, configService as any);

    const result = await service.issueToken(user, 'team-weekly-2026-w36');
    const payload = await jwtService.verifyAsync(result.token, {
      secret: meetSecret,
      algorithms: ['HS256'],
      issuer: appId,
      audience: appId
    });

    expect(payload).toMatchObject({
      sub: appId,
      room: 'team-weekly-2026-w36',
      context: { user: { id: user.userId } }
    });
    expect(payload.exp - payload.iat).toBeLessThanOrEqual(MEET_TOKEN_TTL_SECONDS);
    expect(result).toMatchObject({
      room: 'team-weekly-2026-w36',
      expiresInSeconds: MEET_TOKEN_TTL_SECONDS
    });
  });
});
