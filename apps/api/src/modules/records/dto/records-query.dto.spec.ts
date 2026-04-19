import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { ListRecordsQueryDto } from './records-query.dto';

describe('ListRecordsQueryDto', () => {
  it('parses page and pageSize as integers', () => {
    const dto = plainToInstance(ListRecordsQueryDto, { page: '3', pageSize: '40' });
    const errors = validateSync(dto);

    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(3);
    expect(dto.pageSize).toBe(40);
  });

  it('falls back to defaults when page and pageSize are invalid strings', () => {
    const dto = plainToInstance(ListRecordsQueryDto, { page: 'abc', pageSize: 'xyz' });
    const errors = validateSync(dto);

    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(1);
    expect(dto.pageSize).toBe(20);
  });
});
