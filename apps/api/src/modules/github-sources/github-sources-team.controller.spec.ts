import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GitHubSourcesTeamController } from './github-sources-team.controller';

describe('GitHubSourcesTeamController', () => {
  const githubSourcesService = { listEnabledForTeam: vi.fn() };
  let controller: GitHubSourcesTeamController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new GitHubSourcesTeamController(githubSourcesService as any);
  });

  it('lists sources using only the authenticated team', async () => {
    const user = { userId: 'user-1', teamId: 'team-1' } as any;
    githubSourcesService.listEnabledForTeam.mockResolvedValue({ items: [] });

    await expect(controller.listTeamSources(user)).resolves.toEqual({ items: [] });
    expect(githubSourcesService.listEnabledForTeam).toHaveBeenCalledWith('team-1');
  });
});
