import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { WeeklyReportWeekQueryDto } from './weekly-report-week-query.dto';

describe('WeeklyReportWeekQueryDto', () => {
  it('accepts the ISO week wire format', async () => {
    expect(await validate(Object.assign(new WeeklyReportWeekQueryDto(), { week: '2026-W36' }))).toHaveLength(0);
    expect(await validate(Object.assign(new WeeklyReportWeekQueryDto(), { week: '2026-09-01' }))).not.toHaveLength(0);
  });
});
