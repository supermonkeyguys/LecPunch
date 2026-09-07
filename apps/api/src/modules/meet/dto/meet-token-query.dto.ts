import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

// Kept intentionally narrow so a token can only be used for one predictable
// Jitsi room and cannot smuggle a path, URL, or wildcard into the claim.
export const MEET_ROOM_REGEX = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

export class MeetTokenQueryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  @Matches(MEET_ROOM_REGEX, {
    message: 'room must contain only letters, numbers, hyphens, or underscores'
  })
  room!: string;
}
