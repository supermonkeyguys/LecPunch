import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthUser } from '../auth/types/auth-user.type';
import { GitHubSourcesService } from './github-sources.service';

@Controller('github-sources')
@UseGuards(JwtAuthGuard)
export class GitHubSourcesTeamController {
  constructor(private readonly githubSourcesService: GitHubSourcesService) {}

  @Get('team')
  listTeamSources(@CurrentUser() user: AuthUser) {
    return this.githubSourcesService.listEnabledForTeam(user.teamId);
  }
}
