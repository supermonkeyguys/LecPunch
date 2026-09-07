import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { MeetTokenQueryDto } from './meet-token-query.dto';

describe('MeetTokenQueryDto', () => {
  it('accepts a bounded room name', async () => {
    const errors = await validate(plainToInstance(MeetTokenQueryDto, { room: 'team-weekly_2026-36' }));
    expect(errors).toHaveLength(0);
  });

  it.each(['', '*', '../room', 'https://example.com', 'room space'])('rejects an unsafe room name: %s', async (room) => {
    const errors = await validate(plainToInstance(MeetTokenQueryDto, { room }));
    expect(errors.length).toBeGreaterThan(0);
  });
});
