import { IsIn, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class AdjustCurrentWeekDurationDto {
  @IsString()
  @MinLength(1)
  username!: string;

  @IsIn(['add', 'subtract'])
  operation!: 'add' | 'subtract';

  @IsInt()
  @Min(1)
  durationSeconds!: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
