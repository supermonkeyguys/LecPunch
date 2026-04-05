import { IsOptional, IsString, MinLength, Matches } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  displayName?: string;

  @IsOptional()
  @IsString()
  avatarBase64?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'avatarColor must be a valid hex color' })
  avatarColor?: string;

  @IsOptional()
  @IsString()
  avatarEmoji?: string;
}
