import { IsString, Matches } from 'class-validator';

export class WeeklyReportWeekQueryDto {
  @IsString()
  @Matches(/^\d{4}-W\d{2}$/, { message: 'week must use ISO format YYYY-Www' })
  week!: string;
}
