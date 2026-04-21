import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { TeamLedgerEntryStatus, TeamLedgerType } from '@lecpunch/shared';

const parseIntegerWithFallback = (value: unknown, fallback: number) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export class ListTeamLedgerEntriesQueryDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsIn(['income', 'expense'])
  type?: TeamLedgerType;

  @IsOptional()
  @IsIn(['active', 'voided', 'all'])
  status?: TeamLedgerEntryStatus | 'all';

  @IsOptional()
  @IsString()
  category?: string;

  @Transform(({ value }) => parseIntegerWithFallback(value, 100))
  @IsInt()
  limit = 100;
}

export class GetTeamLedgerSummaryQueryDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsIn(['active', 'voided', 'all'])
  status?: TeamLedgerEntryStatus | 'all';
}

export class GetTeamLedgerTrendQueryDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsIn(['active', 'voided', 'all'])
  status?: TeamLedgerEntryStatus | 'all';

  @IsOptional()
  @IsIn(['day', 'week'])
  granularity: 'day' | 'week' = 'day';
}

export class CreateTeamLedgerEntryDto {
  @IsISO8601()
  occurredAt!: string;

  @IsIn(['income', 'expense'])
  type!: TeamLedgerType;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(1)
  amountCents!: number;

  @IsString()
  @MinLength(1)
  category!: string;

  @IsOptional()
  @IsString()
  counterparty?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  proofFileName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  proofFileMimeType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(7_340_032)
  proofFileBase64?: string;
}

export class VoidTeamLedgerEntryDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreateTeamLedgerReversalDto {
  @IsOptional()
  @IsISO8601()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
