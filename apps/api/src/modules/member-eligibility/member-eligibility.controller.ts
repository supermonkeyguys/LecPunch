import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types/auth-user.type';
import { MemberEligibilityService } from './member-eligibility.service';
import {
  CreateMemberEligibilityEntryDto,
  ListMemberEligibilityEntriesQueryDto,
  UpdateMemberEligibilityEntryDto
} from './dto/member-eligibility-admin.dto';

@Controller('member-eligibility')
@UseGuards(JwtAuthGuard)
export class MemberEligibilityController {
  constructor(private readonly memberEligibilityService: MemberEligibilityService) {}

  @Get('admin/entries')
  async listEntries(@CurrentUser() user: AuthUser, @Query() query: ListMemberEligibilityEntriesQueryDto) {
    this.assertAdmin(user);
    const items = await this.memberEligibilityService.listEntries(user.teamId, query);
    return { items: items.map((item) => this.mapEntry(item)) };
  }

  @Post('admin/entries')
  async createEntry(@CurrentUser() user: AuthUser, @Body() dto: CreateMemberEligibilityEntryDto) {
    this.assertAdmin(user);
    const item = await this.memberEligibilityService.createEntry({
      teamId: user.teamId,
      studentId: dto.studentId,
      realName: dto.realName,
      status: dto.status,
      note: dto.note
    });
    return this.mapEntry(item);
  }

  @Patch('admin/entries/:entryId')
  async updateEntry(
    @CurrentUser() user: AuthUser,
    @Param('entryId') entryId: string,
    @Body() dto: UpdateMemberEligibilityEntryDto
  ) {
    this.assertAdmin(user);
    const item = await this.memberEligibilityService.updateEntry(user.teamId, entryId, dto);
    return this.mapEntry(item);
  }

  @Delete('admin/entries/:entryId')
  async deleteEntry(@CurrentUser() user: AuthUser, @Param('entryId') entryId: string) {
    this.assertAdmin(user);
    await this.memberEligibilityService.deleteEntry(user.teamId, entryId);
    return { success: true };
  }

  private assertAdmin(user: AuthUser) {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Only admins can manage member eligibility');
    }
  }

  private mapEntry(item: any) {
    return {
      id: item.id,
      teamId: item.teamId,
      studentId: item.studentId,
      realName: item.realName,
      status: item.status,
      note: item.note,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    };
  }
}
