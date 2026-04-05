import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import * as bcrypt from 'bcrypt';

describe('UsersService', () => {
  const findByIdAndUpdate = vi.fn();
  const findById = vi.fn();

  const userModel = {
    create: vi.fn(),
    findOne: vi.fn(),
    findById,
    find: vi.fn(),
    findByIdAndUpdate,
  } as any;

  let service: UsersService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new UsersService(userModel);
  });

  describe('updateProfile - avatar mutual exclusion', () => {
    beforeEach(() => {
      findByIdAndUpdate.mockReturnValue({
        exec: vi.fn().mockResolvedValue({ id: 'user1' }),
      });
    });

    it('setting avatarBase64 should unset avatarColor and avatarEmoji', async () => {
      await service.updateProfile('user1', { avatarBase64: 'data:image/jpeg;base64,...' });
      expect(findByIdAndUpdate).toHaveBeenCalledWith(
        'user1',
        expect.objectContaining({ $unset: { avatarColor: 1, avatarEmoji: 1 } }),
        { new: true },
      );
    });

    it('setting avatarEmoji should unset avatarBase64 and avatarColor', async () => {
      await service.updateProfile('user1', { avatarEmoji: '🦊' });
      expect(findByIdAndUpdate).toHaveBeenCalledWith(
        'user1',
        expect.objectContaining({ $unset: { avatarBase64: 1, avatarColor: 1 } }),
        { new: true },
      );
    });

    it('setting avatarColor should unset avatarBase64 and avatarEmoji', async () => {
      await service.updateProfile('user1', { avatarColor: '#6366f1' });
      expect(findByIdAndUpdate).toHaveBeenCalledWith(
        'user1',
        expect.objectContaining({ $unset: { avatarBase64: 1, avatarEmoji: 1 } }),
        { new: true },
      );
    });

    it('setting only displayName should not include $unset', async () => {
      await service.updateProfile('user1', { displayName: 'New Name' });
      const updateArg = findByIdAndUpdate.mock.calls[0][1];
      expect(updateArg.$unset).toBeUndefined();
    });
  });

  describe('updatePassword', () => {
    it('should throw BadRequestException with code WRONG_PASSWORD when old password is incorrect', async () => {
      const hash = await bcrypt.hash('correctpassword', 10);
      findById.mockReturnValue({
        exec: vi.fn().mockResolvedValue({ id: 'user1', passwordHash: hash }),
      });

      await expect(
        service.updatePassword('user1', 'wrongpassword', 'newpassword123'),
      ).rejects.toThrow(BadRequestException);

      try {
        await service.updatePassword('user1', 'wrongpassword', 'newpassword123');
      } catch (e: any) {
        expect(e.response?.code).toBe('WRONG_PASSWORD');
      }
    });

    it('should update password hash when old password is correct', async () => {
      const hash = await bcrypt.hash('correctpassword', 10);
      findById.mockReturnValue({
        exec: vi.fn().mockResolvedValue({ id: 'user1', passwordHash: hash }),
      });
      findByIdAndUpdate.mockReturnValue({
        exec: vi.fn().mockResolvedValue(null),
      });

      await expect(
        service.updatePassword('user1', 'correctpassword', 'newpassword123'),
      ).resolves.not.toThrow();

      expect(findByIdAndUpdate).toHaveBeenCalledWith(
        'user1',
        expect.objectContaining({
          $set: expect.objectContaining({ passwordHash: expect.any(String) }),
        }),
      );
    });
  });
});
