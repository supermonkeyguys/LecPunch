import { IsString, MinLength } from 'class-validator';

export class UpdatePasswordDto {
  @IsString()
  oldPassword!: string;

  @IsString()
  @MinLength(6)
  newPassword!: string;
}
