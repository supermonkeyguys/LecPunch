import { Body, Controller, ForbiddenException, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/types/auth-user.type';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { AdminUpdateMemberDto } from './dto/admin-update-member.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('admin/members')
  async listTeamMembers(@CurrentUser() user: AuthUser) {
    this.assertAdmin(user);
    const members = await this.usersService.listTeamMembers(user.teamId);
    return { items: members.map((member) => this.mapUser(member)) };
  }

  @Patch('admin/members/:userId')
  async adminUpdateMember(
    @CurrentUser() user: AuthUser,
    @Param('userId') userId: string,
    @Body() dto: AdminUpdateMemberDto
  ) {
    this.assertAdmin(user);
    const member = await this.usersService.adminUpdateMember(user, userId, dto);
    return this.mapUser(member);
  }

  @Patch('me')
  async updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    const updated = await this.usersService.updateProfile(user.userId, dto);
    return this.mapUser(updated);
  }

  @Patch('me/password')
  async updatePassword(@CurrentUser() user: AuthUser, @Body() dto: UpdatePasswordDto) {
    await this.usersService.updatePassword(user.userId, dto.oldPassword, dto.newPassword);
    return { success: true };
  }

  private assertAdmin(user: AuthUser) {
    if (user.role !== 'admin') {
      throw new ForbiddenException({ message: '需要管理员权限' });
    }
  }

  private mapUser(user: any) {
    return {
      id: user.id,
      teamId: user.teamId,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      status: user.status,
      enrollYear: user.enrollYear,
      studentId: user.studentId,
      realName: user.realName,
      avatarBase64: user.avatarBase64,
      avatarColor: user.avatarColor,
      avatarEmoji: user.avatarEmoji,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }
}
