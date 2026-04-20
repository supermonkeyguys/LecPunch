import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthUser } from '../auth/types/auth-user.type';
import {
  CreateTeamLedgerEntryDto,
  CreateTeamLedgerReversalDto,
  GetTeamLedgerSummaryQueryDto,
  ListTeamLedgerEntriesQueryDto,
  VoidTeamLedgerEntryDto
} from './dto/team-ledger-admin.dto';
import { TeamLedgerService } from './team-ledger.service';

@Controller('team-ledger')
@UseGuards(JwtAuthGuard)
export class TeamLedgerController {
  constructor(private readonly teamLedgerService: TeamLedgerService) {}

  @Get('admin/entries')
  async listEntries(@CurrentUser() user: AuthUser, @Query() query: ListTeamLedgerEntriesQueryDto) {
    this.assertAdmin(user);
    const items = await this.teamLedgerService.listEntries(user.teamId, query);
    return { items: items.map((item) => this.mapEntry(item)) };
  }

  @Post('admin/entries')
  async createEntry(@CurrentUser() user: AuthUser, @Body() dto: CreateTeamLedgerEntryDto) {
    this.assertAdmin(user);
    const item = await this.teamLedgerService.createEntry({
      teamId: user.teamId,
      occurredAt: dto.occurredAt,
      type: dto.type,
      amountCents: dto.amountCents,
      category: dto.category,
      counterparty: dto.counterparty,
      note: dto.note,
      createdBy: user.userId
    });
    return this.mapEntry(item);
  }

  @Patch('admin/entries/:entryId/void')
  async voidEntry(@CurrentUser() user: AuthUser, @Param('entryId') entryId: string, @Body() dto: VoidTeamLedgerEntryDto) {
    this.assertAdmin(user);
    const item = await this.teamLedgerService.voidEntry(user.teamId, entryId, {
      voidedBy: user.userId,
      reason: dto.reason
    });
    return this.mapEntry(item);
  }

  @Post('admin/entries/:entryId/reversal')
  async createReversal(
    @CurrentUser() user: AuthUser,
    @Param('entryId') entryId: string,
    @Body() dto: CreateTeamLedgerReversalDto
  ) {
    this.assertAdmin(user);
    const item = await this.teamLedgerService.createReversal(user.teamId, entryId, {
      createdBy: user.userId,
      occurredAt: dto.occurredAt,
      note: dto.note
    });
    return this.mapEntry(item);
  }

  @Get('admin/summary')
  async getSummary(@CurrentUser() user: AuthUser, @Query() query: GetTeamLedgerSummaryQueryDto) {
    this.assertAdmin(user);
    return this.teamLedgerService.summarize(user.teamId, query);
  }

  @Get('admin/export')
  async getExportContract(@CurrentUser() user: AuthUser, @Query() query: ListTeamLedgerEntriesQueryDto) {
    this.assertAdmin(user);
    return {
      status: 'not_implemented',
      format: 'csv',
      endpoint: '/team-ledger/admin/export',
      acceptedQuery: {
        from: query.from,
        to: query.to,
        type: query.type,
        status: query.status,
        category: query.category
      }
    };
  }

  private assertAdmin(user: AuthUser) {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Only admins can manage team ledger');
    }
  }

  private mapEntry(item: any) {
    return {
      id: item.id,
      teamId: item.teamId,
      occurredAt: item.occurredAt instanceof Date ? item.occurredAt.toISOString() : item.occurredAt,
      type: item.type,
      status: item.status,
      amountCents: item.amountCents,
      category: item.category,
      counterparty: item.counterparty,
      note: item.note,
      reversalOfEntryId: item.reversalOfEntryId,
      voidedAt: item.voidedAt instanceof Date ? item.voidedAt.toISOString() : item.voidedAt,
      voidedBy: item.voidedBy,
      voidReason: item.voidReason,
      createdBy: item.createdBy,
      createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt,
      updatedAt: item.updatedAt instanceof Date ? item.updatedAt.toISOString() : item.updatedAt
    };
  }
}
