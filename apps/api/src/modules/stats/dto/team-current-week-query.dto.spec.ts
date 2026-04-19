import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { TeamCurrentWeekQueryDto } from './team-current-week-query.dto';

describe('TeamCurrentWeekQueryDto', () => {
  it('accepts sameGrade=true', () => {
    const dto = plainToInstance(TeamCurrentWeekQueryDto, { sameGrade: 'true' });
    const errors = validateSync(dto);

    expect(errors).toHaveLength(0);
    expect(dto.sameGrade).toBe('true');
  });

  it('rejects non-boolean-like sameGrade value', () => {
    const dto = plainToInstance(TeamCurrentWeekQueryDto, { sameGrade: '1' });
    const errors = validateSync(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
