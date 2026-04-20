import { describe, expect, it } from 'vitest';
import {
  normalizeEligibilityNote,
  normalizeEligibilityRealName,
  normalizeEligibilityStatus,
  normalizeEligibilityStudentId
} from './member-eligibility.normalization';

describe('member eligibility normalization', () => {
  it('normalizes student ID and real name by trimming outer spaces', () => {
    expect(normalizeEligibilityStudentId(' 202400000001 ')).toBe('202400000001');
    expect(normalizeEligibilityRealName('  Alice  Zhang  ')).toBe('Alice Zhang');
  });

  it('normalizes status with blocked as explicit opt-out', () => {
    expect(normalizeEligibilityStatus('blocked')).toBe('blocked');
    expect(normalizeEligibilityStatus('allowed')).toBe('allowed');
    expect(normalizeEligibilityStatus(undefined)).toBe('allowed');
  });

  it('normalizes optional note and removes empty strings', () => {
    expect(normalizeEligibilityNote('  keep this  ')).toBe('keep this');
    expect(normalizeEligibilityNote('   ')).toBeUndefined();
    expect(normalizeEligibilityNote(undefined)).toBeUndefined();
  });
});
