import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AuthUser } from '../auth/types/auth-user.type';

export const MEET_TOKEN_TTL_SECONDS = 5 * 60;

@Injectable()
export class MeetService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  async issueToken(user: AuthUser, room: string) {
    const appId = this.configService.getOrThrow<string>('MEET_JWT_APP_ID');
    const secret = this.configService.getOrThrow<string>('MEET_JWT_SECRET');
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + MEET_TOKEN_TTL_SECONDS * 1000);

    const token = await this.jwtService.signAsync(
      {
        // Jitsi reserves `sub` for its meeting application/domain. The
        // LecPunch user identity belongs in context.user, not in `sub`.
        sub: appId,
        room,
        context: {
          user: {
            id: user.userId
          }
        }
      },
      {
        secret,
        algorithm: 'HS256',
        expiresIn: MEET_TOKEN_TTL_SECONDS,
        issuer: appId,
        audience: appId
      }
    );

    return {
      token,
      room,
      expiresAt: expiresAt.toISOString(),
      expiresInSeconds: MEET_TOKEN_TTL_SECONDS
    };
  }
}
