import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional } from 'class-validator';
import { TeamEventStatus } from '@lecpunch/shared';

const parseIntegerWithFallback = (value: unknown, fallback: number) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export class ListTeamEventsMemberQueryDto {
  @IsOptional()
  @IsIn(['planned', 'done', 'cancelled'])
  status?: TeamEventStatus;

  @Transform(({ value }) => parseIntegerWithFallback(value, 20))
  @IsInt()
  limit = 20;
}
