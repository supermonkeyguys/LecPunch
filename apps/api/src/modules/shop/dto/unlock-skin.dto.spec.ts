import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { UnlockSkinDto } from './unlock-skin.dto';

describe('UnlockSkinDto', () => {
  it('accepts a bounded safe skin id', async () => {
    await expect(validate(plainToInstance(UnlockSkinDto, { skinId: 'user-doro_9a0b1c2d' }))).resolves.toHaveLength(0);
  });

  it.each(['', '../doro', 'https://example.com', 'skin id', 'a'.repeat(65)])('rejects an unsafe skin id: %s', async (skinId) => {
    const errors = await validate(plainToInstance(UnlockSkinDto, { skinId }));
    expect(errors.length).toBeGreaterThan(0);
  });
});
