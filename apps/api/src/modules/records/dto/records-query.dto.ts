import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString } from 'class-validator';

const parseIntegerWithFallback = (value: unknown, fallback: number) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export class RecordFiltersQueryDto {
  @IsOptional()
  @IsString()
  weekKey?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}

export class ListRecordsQueryDto extends RecordFiltersQueryDto {
  @Transform(({ value }) => parseIntegerWithFallback(value, 1))
  @IsInt()
  page = 1;

  @Transform(({ value }) => parseIntegerWithFallback(value, 20))
  @IsInt()
  pageSize = 20;
}
