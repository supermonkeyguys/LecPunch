import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { NotFoundException, UnsupportedMediaTypeException } from '@nestjs/common';
import { ReportsService } from './reports.service';

const user = {
  userId: 'member-1',
  teamId: 'team-1',
  username: 'member',
  displayName: '成员甲',
  role: 'member' as const,
  enrollYear: 2024
};

describe('ReportsService', () => {
  let directory: string;
  let service: ReportsService;
  const create = vi.fn();
  const find = vi.fn();
  const findOne = vi.fn();
  const findByIdAndUpdate = vi.fn();
  const countDocuments = vi.fn();
  const reportModel = { create, find, findOne, findByIdAndUpdate, countDocuments } as any;
  const usersService = { findActiveAdminIds: vi.fn() };
  const notificationsService = { createForReportSubmitted: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    directory = await mkdtemp(join(tmpdir(), 'lecpunch-report-images-'));
    const configService = {
      get: vi.fn((key: string) => {
        const values: Record<string, string | number> = {
          REPORT_IMAGES_DIR: directory,
          REPORT_IMAGE_RETENTION_HOURS: 3,
          REPORT_IMAGE_MAX_BYTES: 3 * 1024 * 1024
        };
        return values[key];
      })
    };
    service = new ReportsService(reportModel, usersService as any, notificationsService as any, configService as any);
  });

  afterEach(async () => {
    service.onModuleDestroy();
    await rm(directory, { recursive: true, force: true });
  });

  it('stores a valid image, records a three-hour expiry, and notifies every active admin', async () => {
    create.mockImplementation(async (input: any) => ({
      ...input,
      id: 'report-1',
      createdAt: new Date('2026-09-01T10:00:00.000Z')
    }));
    usersService.findActiveAdminIds.mockResolvedValue(['admin-1', 'admin-2']);
    notificationsService.createForReportSubmitted.mockResolvedValue([]);
    const image = Buffer.from([0xff, 0xd8, 0xff, 0xdb]);

    const result = await service.createReport(user, { description: '  举报说明  ' }, [
      { buffer: image, mimetype: 'image/jpeg', size: image.length }
    ]);

    expect(result.description).toBe('举报说明');
    expect(result.images).toHaveLength(1);
    expect(result.imagesExpireAt).not.toBeNull();
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: 'team-1',
        reporterUserId: 'member-1',
        description: '举报说明',
        images: [expect.objectContaining({ contentType: 'image/jpeg', sizeBytes: image.length })]
      })
    );
    const filename = create.mock.calls[0][0].images[0].filename;
    await expect(readFile(join(directory, filename))).resolves.toEqual(image);
    expect(notificationsService.createForReportSubmitted).toHaveBeenCalledWith(
      expect.objectContaining({
        adminUserIds: ['admin-1', 'admin-2'],
        reportId: 'report-1',
        imageCount: 1
      })
    );
  });

  it('rejects a file that only claims to be an image', async () => {
    await expect(
      service.createReport(user, { description: '举报说明' }, [
        { buffer: Buffer.from('not an image'), mimetype: 'image/png', size: 12 }
      ])
    ).rejects.toBeInstanceOf(UnsupportedMediaTypeException);

    expect(create).not.toHaveBeenCalled();
  });

  it('deletes expired files and clears image metadata while retaining the report', async () => {
    const filename = '123e4567-e89b-12d3-a456-426614174000.jpg';
    await writeFile(join(directory, filename), Buffer.from([0xff, 0xd8, 0xff]));
    const expiredReport = {
      id: 'report-1',
      images: [{ id: 'image-1', filename, contentType: 'image/jpeg', sizeBytes: 3 }]
    };
    const exec = vi.fn().mockResolvedValue([expiredReport]);
    const limit = vi.fn().mockReturnValue({ exec });
    find.mockReturnValue({ limit });
    findByIdAndUpdate.mockReturnValue({ exec: vi.fn().mockResolvedValue(undefined) });

    await service.cleanupExpiredImages();

    await expect(readFile(join(directory, filename))).rejects.toMatchObject({ code: 'ENOENT' });
    expect(findByIdAndUpdate).toHaveBeenCalledWith(
      'report-1',
      expect.objectContaining({ $set: expect.objectContaining({ images: [], imagesPurgedAt: expect.any(Date) }) })
    );
  });

  it('does not return an image after its expiry time', async () => {
    const expiredReport = {
      id: 'report-1',
      imagesExpireAt: new Date(Date.now() - 1_000),
      images: [{ id: 'image-1', filename: '123e4567-e89b-12d3-a456-426614174000.jpg', contentType: 'image/jpeg', sizeBytes: 3 }]
    };
    findOne.mockReturnValue({ exec: vi.fn().mockResolvedValue(expiredReport) });
    findByIdAndUpdate.mockReturnValue({ exec: vi.fn().mockResolvedValue(undefined) });

    await expect(service.getImageForAdmin('team-1', 'report-1', 'image-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
