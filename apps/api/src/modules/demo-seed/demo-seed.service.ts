import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { TeamsService } from '../teams/teams.service';

interface SeedResult {
  teamName: string;
  createdUsers: string[];
}

@Injectable()
export class DemoSeedService {
  constructor(
    private readonly usersService: UsersService,
    private readonly teamsService: TeamsService
  ) {}

  async seed(): Promise<SeedResult> {
    const team = await this.teamsService.ensureDefaultTeam('FocusTeam');
    const createdUsers: string[] = [];

    const accounts = [
      { username: 'demo-admin', displayName: 'Demo Admin', role: 'admin' as const },
      { username: 'demo-member', displayName: 'Demo Member', role: 'member' as const }
    ];

    for (const account of accounts) {
      const existing = await this.usersService.findByUsername(account.username);
      if (existing) {
        continue;
      }

      const passwordHash = await bcrypt.hash('123456', 10);
      await this.usersService.create({
        username: account.username,
        displayName: account.displayName,
        passwordHash,
        teamId: team.id,
        role: account.role
      });
      createdUsers.push(account.username);
    }

    return {
      teamName: team.name,
      createdUsers
    };
  }
}
