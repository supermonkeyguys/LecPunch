import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { UpsertWeeklyReportReferenceDto } from './upsert-weekly-report-reference.dto';

describe('UpsertWeeklyReportReferenceDto', () => {
  it('requires a safe GitHub reference for generated reports', async () => {
    const valid = Object.assign(new UpsertWeeklyReportReferenceDto(), {
      status: 'generated',
      githubPath: 'lecpunch/reports/2026-W36.md',
      rawUrl: 'https://raw.githubusercontent.com/example/daily-log/main/lecpunch/reports/2026-W36.md',
      commitSha: 'abcdef1234567',
      dailyLogCount: 5
    });
    expect(await validate(valid)).toHaveLength(0);

    const unsafe = Object.assign(new UpsertWeeklyReportReferenceDto(), {
      status: 'generated',
      githubPath: '../secret.md',
      rawUrl: 'https://example.com/secret.md'
    });
    expect(await validate(unsafe)).not.toHaveLength(0);
  });
});
