import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, MinLength } from 'class-validator';
import { TeamEventStatus } from '@lecpunch/shared';

const parseIntegerWithFallback = (value: unknown, fallback: number) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export class ListTeamEventsQueryDto {
  @IsOptional()
  @IsIn(['planned', 'done', 'cancelled'])
  status?: TeamEventStatus;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @Transform(({ value }) => parseIntegerWithFallback(value, 100))
  @IsInt()
  limit = 100;
}

export class CreateTeamEventDto {
  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsISO8601()
  eventAt!: string;

  @IsOptional()
  @IsIn(['planned', 'done', 'cancelled'])
  status?: TeamEventStatus;
}

export class UpdateTeamEventDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsISO8601()
  eventAt?: string;

  @IsOptional()
  @IsIn(['planned', 'done', 'cancelled'])
  status?: TeamEventStatus;
}
