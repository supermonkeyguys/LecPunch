import { IsString, MinLength, Matches } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(3)
  username!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  @MinLength(2)
  displayName!: string;

  @IsString()
  @Matches(/^\d{12}$/, { message: 'studentId must be exactly 12 digits' })
  studentId!: string;

  @IsString()
  @MinLength(2)
  realName!: string;
}
