import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { MemberEligibilityStatus } from '@lecpunch/shared';

const parseIntegerWithFallback = (value: unknown, fallback: number) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export class ListMemberEligibilityEntriesQueryDto {
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsIn(['allowed', 'blocked'])
  status?: MemberEligibilityStatus;

  @Transform(({ value }) => parseIntegerWithFallback(value, 100))
  @IsInt()
  limit = 100;
}

export class CreateMemberEligibilityEntryDto {
  @IsString()
  @Matches(/^\d{12}$/, { message: 'studentId must be exactly 12 digits' })
  studentId!: string;

  @IsString()
  @MinLength(2)
  realName!: string;

  @IsOptional()
  @IsIn(['allowed', 'blocked'])
  status?: MemberEligibilityStatus;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateMemberEligibilityEntryDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{12}$/, { message: 'studentId must be exactly 12 digits' })
  studentId?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  realName?: string;

  @IsOptional()
  @IsIn(['allowed', 'blocked'])
  status?: MemberEligibilityStatus;

  @IsOptional()
  @IsString()
  note?: string;
}
