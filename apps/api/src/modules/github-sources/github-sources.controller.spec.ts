import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GitHubSourcesController } from './github-sources.controller';

describe('GitHubSourcesController', () => {
  const githubSourcesService = {
    findForUser: vi.fn(),
    upsertForUser: vi.fn(),
    deleteForUser: vi.fn(),
    listEnabledForTeam: vi.fn(),
    toItem: vi.fn()
  };
  let controller: GitHubSourcesController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new GitHubSourcesController(githubSourcesService as any);
  });

  it('reads and writes with the authenticated user ID only', async () => {
    const user = { userId: 'user-1' } as any;
    const dto = { repoUrl: 'https://github.com/example/daily-log' };
    githubSourcesService.upsertForUser.mockResolvedValue({ id: 'source-1' });
    githubSourcesService.toItem.mockReturnValue({ userId: 'user-1' });

    await expect(controller.putMine(user, dto)).resolves.toEqual({ item: { userId: 'user-1' } });

    expect(githubSourcesService.upsertForUser).toHaveBeenCalledWith('user-1', dto);
    expect(githubSourcesService.upsertForUser).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ userId: expect.anything() }));
  });

  it('returns a null item when the current user has no source', async () => {
    githubSourcesService.findForUser.mockResolvedValue(null);

    await expect(controller.getMine({ userId: 'user-1' } as any)).resolves.toEqual({ item: null });
    expect(githubSourcesService.findForUser).toHaveBeenCalledWith('user-1');
  });

});
