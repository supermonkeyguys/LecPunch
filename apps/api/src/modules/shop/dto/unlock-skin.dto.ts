import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { SKIN_ID_REGEX } from '../shop.constants';

export class UnlockSkinDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  @Matches(SKIN_ID_REGEX, {
    message: 'skinId must contain only letters, numbers, hyphens, or underscores'
  })
  skinId!: string;
}
