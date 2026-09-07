import { Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit, UnsupportedMediaTypeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { mkdir, rm, writeFile } from 'fs/promises';
import { basename, isAbsolute, relative, resolve } from 'path';
import { Model } from 'mongoose';
import type { AuthUser } from '../auth/types/auth-user.type';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import type { CreateReportDto } from './dto/create-report.dto';
import type { ReportImage } from './schemas/report.schema';
import { Report, type ReportDocument } from './schemas/report.schema';

const CLEANUP_INTERVAL_MS = 60_000;
const MAX_REPORT_IMAGES = 3;
const ALLOWED_IMAGE_TYPES = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp']
]);

export interface UploadedReportImage {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

export interface ReportImageFile {
  absolutePath: string;
  contentType: string;
  sizeBytes: number;
}

@Injectable()
export class ReportsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReportsService.name);
  private readonly imageDirectory: string;
  private readonly retentionHours: number;
  private readonly maxImageBytes: number;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    @InjectModel(Report.name) private readonly reportModel: Model<ReportDocument>,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
    configService: ConfigService
  ) {
    this.imageDirectory = resolve(configService.get<string>('REPORT_IMAGES_DIR') ?? './data/report-images');
    this.retentionHours = configService.get<number>('REPORT_IMAGE_RETENTION_HOURS') ?? 3;
    this.maxImageBytes = configService.get<number>('REPORT_IMAGE_MAX_BYTES') ?? 3 * 1024 * 1024;
  }

  async onModuleInit() {
    await mkdir(this.imageDirectory, { recursive: true });
    await this.cleanupExpiredImages();
    this.cleanupTimer = setInterval(() => {
      void this.cleanupExpiredImages();
    }, CLEANUP_INTERVAL_MS);
    this.cleanupTimer.unref();
  }

  onModuleDestroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }

  async createReport(user: AuthUser, dto: CreateReportDto, files: UploadedReportImage[]) {
    const description = dto.description.trim();
    if (files.length > MAX_REPORT_IMAGES) {
      throw new UnsupportedMediaTypeException(`At most ${MAX_REPORT_IMAGES} images can be uploaded`);
    }

    this.validateImages(files);
    const images = await this.persistImages(files);
    const imagesExpireAt = images.length > 0 ? this.getImagesExpireAt() : null;

    let report: ReportDocument;
    try {
      report = await this.reportModel.create({
        teamId: user.teamId,
        reporterUserId: user.userId,
        reporterUsername: user.username,
        reporterDisplayName: user.displayName,
        description,
        images,
        imagesExpireAt,
        imagesPurgedAt: null
      });

    } catch (error) {
      await this.deleteImages(images);
      throw error;
    }

    const adminUserIds = await this.usersService.findActiveAdminIds(user.teamId);
    await this.notificationsService.createForReportSubmitted({
      teamId: user.teamId,
      adminUserIds,
      reportId: report.id,
      reporterUserId: user.userId,
      reporterDisplayName: user.displayName,
      imageCount: images.length,
      imagesExpireAt
    });

    return this.toReportItem(report);
  }

  async listTeamReports(teamId: string, page: number, pageSize: number) {
    const [reports, total] = await Promise.all([
      this.reportModel
        .find({ teamId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .exec(),
      this.reportModel.countDocuments({ teamId }).exec()
    ]);

    return {
      items: reports.map((report) => this.toReportItem(report)),
      page,
      pageSize,
      total
    };
  }

  async getImageForAdmin(teamId: string, reportId: string, imageId: string): Promise<ReportImageFile> {
    const report = await this.reportModel.findOne({ _id: reportId, teamId }).exec();
    if (!report) {
      throw new NotFoundException('Report not found');
    }

    if (report.imagesExpireAt && report.imagesExpireAt.getTime() <= Date.now()) {
      await this.purgeReportImages(report);
      throw new NotFoundException('Report image has expired');
    }

    const image = report.images.find((candidate) => candidate.id === imageId);
    if (!image) {
      throw new NotFoundException('Report image not found');
    }

    return {
      absolutePath: this.getImageAbsolutePath(image.filename),
      contentType: image.contentType,
      sizeBytes: image.sizeBytes
    };
  }

  async cleanupExpiredImages() {
    try {
      const reports = await this.reportModel
        .find({ imagesExpireAt: { $ne: null, $lte: new Date() }, imagesPurgedAt: null })
        .limit(100)
        .exec();
      await Promise.all(reports.map((report) => this.purgeReportImages(report)));
    } catch (error) {
      this.logger.error('Failed to clean expired report images', error instanceof Error ? error.stack : undefined);
    }
  }

  private validateImages(files: UploadedReportImage[]) {
    for (const file of files) {
      const expectedExtension = ALLOWED_IMAGE_TYPES.get(file.mimetype);
      if (!expectedExtension || file.size <= 0 || file.size > this.maxImageBytes || !this.hasExpectedFileSignature(file)) {
        throw new UnsupportedMediaTypeException('Only JPEG, PNG, or WebP images up to the configured size are allowed');
      }
    }
  }

  private async persistImages(files: UploadedReportImage[]): Promise<ReportImage[]> {
    if (files.length === 0) {
      return [];
    }

    await mkdir(this.imageDirectory, { recursive: true });
    const images: ReportImage[] = [];
    try {
      for (const file of files) {
        const id = randomUUID();
        const extension = ALLOWED_IMAGE_TYPES.get(file.mimetype)!;
        const filename = `${id}${extension}`;
        await writeFile(this.getImageAbsolutePath(filename), file.buffer, { flag: 'wx' });
        images.push({ id, filename, contentType: file.mimetype, sizeBytes: file.size });
      }
      return images;
    } catch (error) {
      await this.deleteImages(images);
      throw error;
    }
  }

  private async purgeReportImages(report: Pick<ReportDocument, 'id' | 'images'>) {
    await this.deleteImages(report.images);
    await this.reportModel
      .findByIdAndUpdate(report.id, { $set: { images: [], imagesPurgedAt: new Date() } })
      .exec();
  }

  private async deleteImages(images: ReportImage[]) {
    await Promise.all(
      images.map(async (image) => {
        await rm(this.getImageAbsolutePath(image.filename), { force: true });
      })
    );
  }

  private getImageAbsolutePath(filename: string) {
    if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(filename)) {
      throw new Error('Invalid report image filename');
    }

    const absolutePath = resolve(this.imageDirectory, basename(filename));
    const relativePath = relative(this.imageDirectory, absolutePath);
    if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
      throw new Error('Invalid report image path');
    }
    return absolutePath;
  }

  private getImagesExpireAt() {
    return new Date(Date.now() + this.retentionHours * 60 * 60 * 1_000);
  }

  private hasExpectedFileSignature(file: UploadedReportImage) {
    const header = file.buffer.subarray(0, 12);
    switch (file.mimetype) {
      case 'image/jpeg':
        return header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
      case 'image/png':
        return header.length >= 8 && header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
      case 'image/webp':
        return header.length >= 12 && header.subarray(0, 4).equals(Buffer.from('RIFF')) && header.subarray(8, 12).equals(Buffer.from('WEBP'));
      default:
        return false;
    }
  }

  private toReportItem(report: ReportDocument) {
    return {
      id: report.id,
      teamId: report.teamId,
      reporter: {
        userId: report.reporterUserId,
        username: report.reporterUsername,
        displayName: report.reporterDisplayName
      },
      description: report.description,
      images: report.images.map((image) => ({
        id: image.id,
        contentType: image.contentType,
        sizeBytes: image.sizeBytes,
        downloadPath: `/reports/admin/${report.id}/images/${image.id}`
      })),
      imagesExpireAt: report.imagesExpireAt?.toISOString() ?? null,
      imagesPurgedAt: report.imagesPurgedAt?.toISOString() ?? null,
      createdAt: report.createdAt.toISOString()
    };
  }
}
