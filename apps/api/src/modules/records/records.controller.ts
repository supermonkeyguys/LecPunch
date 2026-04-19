import { Body, Controller, Delete, Get, Param, Patch, Query, Res, UseGuards } from '@nestjs/common';
import { RecordsService, type TeamRecordExportRow } from './records.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/types/auth-user.type';
import type { Response } from 'express';
import { DateTime } from 'luxon';
import { TIMEZONE } from '@lecpunch/shared';
import { AdminUpdateRecordMarkDto } from './dto/admin-update-record-mark.dto';
import { ListRecordsQueryDto, RecordFiltersQueryDto } from './dto/records-query.dto';

@Controller('records')
@UseGuards(JwtAuthGuard)
export class RecordsController {
  constructor(private readonly recordsService: RecordsService) {}

  @Get('me')
  async myRecords(
    @CurrentUser() user: AuthUser,
    @Query() query: ListRecordsQueryDto
  ) {
    const pageNum = Math.max(query.page, 1);
    const sizeNum = Math.min(Math.max(query.pageSize, 1), 100);
    const records = await this.recordsService.listMyRecords(
      user.userId,
      { weekKey: query.weekKey, startDate: query.startDate, endDate: query.endDate },
      pageNum,
      sizeNum
    );
    return { items: records.map(this.mapSession), page: pageNum, pageSize: sizeNum };
  }

  @Get('member/:memberKey')
  async memberRecords(
    @CurrentUser() user: AuthUser,
    @Param('memberKey') memberKey: string,
    @Query() query: ListRecordsQueryDto
  ) {
    const pageNum = Math.max(query.page, 1);
    const sizeNum = Math.min(Math.max(query.pageSize, 1), 100);
    const records = await this.recordsService.listMemberRecords(
      user,
      memberKey,
      { weekKey: query.weekKey, startDate: query.startDate, endDate: query.endDate },
      pageNum,
      sizeNum
    );
    return { items: records.map(this.mapSession), page: pageNum, pageSize: sizeNum };
  }

  @Patch('admin/:recordId/mark')
  async adminUpdateRecordMark(
    @CurrentUser() user: AuthUser,
    @Param('recordId') recordId: string,
    @Body() dto: AdminUpdateRecordMarkDto
  ) {
    const record = await this.recordsService.adminUpdateRecordMark(user, recordId, dto.isMarked);
    return this.mapSession(record);
  }

  @Delete('admin/:recordId')
  async adminDeleteRecord(@CurrentUser() user: AuthUser, @Param('recordId') recordId: string) {
    await this.recordsService.adminDeleteRecord(user, recordId);
    return { success: true };
  }

  @Get('admin/export')
  async exportTeamRecords(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) response: Response,
    @Query() filters: RecordFiltersQueryDto
  ) {
    const rows = await this.recordsService.exportTeamRecords(user, filters);
    const filename = this.buildExportFilename(filters);

    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    return this.buildCsv(rows);
  }

  private mapSession(session: any) {
    return {
      id: session.id,
      checkInAt: session.checkInAt,
      checkOutAt: session.checkOutAt,
      durationSeconds: session.durationSeconds,
      status: session.status,
      invalidReason: session.invalidReason,
      isMarked: Boolean(session.isMarked),
      weekKey: session.weekKey
    };
  }

  private buildExportFilename(filters: { weekKey?: string; startDate?: string; endDate?: string }) {
    if (filters.weekKey) {
      return `team-records-${filters.weekKey}.csv`;
    }

    if (filters.startDate || filters.endDate) {
      const start = filters.startDate ?? 'start';
      const end = filters.endDate ?? 'end';
      return `team-records-${start}_to_${end}.csv`;
    }

    return 'team-records-all.csv';
  }

  private buildCsv(rows: TeamRecordExportRow[]) {
    const headers = [
      '记录ID',
      '周标识',
      '成员ID',
      '用户名',
      '显示名',
      '真实姓名',
      '学号',
      '年级',
      '上卡时间',
      '下卡时间',
      '有效时长秒数',
      '状态',
      '作废原因'
    ];

    const lines = rows.map((row) =>
      [
        row.sessionId,
        row.weekKey,
        row.userId,
        row.username,
        row.displayName,
        row.realName,
        row.studentId,
        row.enrollYear,
        this.formatCsvDate(row.checkInAt),
        this.formatCsvDate(row.checkOutAt),
        row.durationSeconds,
        row.status,
        row.invalidReason
      ]
        .map((value) => this.escapeCsvValue(value))
        .join(',')
    );

    return `\uFEFF${[headers.join(','), ...lines].join('\n')}`;
  }

  private formatCsvDate(value: unknown) {
    if (!(value instanceof Date)) {
      return '';
    }

    return DateTime.fromJSDate(value).setZone(TIMEZONE).toFormat('yyyy-LL-dd HH:mm:ss');
  }

  private escapeCsvValue(value: unknown) {
    if (value === undefined || value === null) {
      return '';
    }

    const normalized = String(value);
    if (!/[",\n]/.test(normalized)) {
      return normalized;
    }

    return `"${normalized.replace(/"/g, '""')}"`;
  }
}
