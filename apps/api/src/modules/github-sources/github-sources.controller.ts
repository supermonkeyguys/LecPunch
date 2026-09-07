import { Body, Controller, Delete, Get, Put, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthUser } from '../auth/types/auth-user.type';
import { UpdateGitHubSourceDto } from './dto/update-github-source.dto';
import { GitHubSourcesService } from './github-sources.service';

@Controller('github-source')
@UseGuards(JwtAuthGuard)
export class GitHubSourcesController {
  constructor(private readonly githubSourcesService: GitHubSourcesService) {}

  @Get('me')
  async getMine(@CurrentUser() user: AuthUser) {
    const source = await this.githubSourcesService.findForUser(user.userId);
    return { item: source ? this.githubSourcesService.toItem(source) : null };
  }

  @Put('me')
  async putMine(@CurrentUser() user: AuthUser, @Body() dto: UpdateGitHubSourceDto) {
    const source = await this.githubSourcesService.upsertForUser(user.userId, dto);
    return { item: this.githubSourcesService.toItem(source) };
  }

  @Delete('me')
  async deleteMine(@CurrentUser() user: AuthUser) {
    await this.githubSourcesService.deleteForUser(user.userId);
    return { success: true };
  }
}
