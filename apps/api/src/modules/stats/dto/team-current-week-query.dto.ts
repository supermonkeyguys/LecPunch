import { IsIn, IsOptional } from 'class-validator';

export class TeamCurrentWeekQueryDto {
  @IsOptional()
  @IsIn(['true', 'false'])
  sameGrade?: 'true' | 'false';
}
