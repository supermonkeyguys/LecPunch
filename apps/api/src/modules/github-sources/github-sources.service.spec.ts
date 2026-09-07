import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GitHubSourcesService } from './github-sources.service';

describe('GitHubSourcesService', () => {
  const findOne = vi.fn();
  const findOneAndUpdate = vi.fn();
  const deleteOne = vi.fn();
  const find = vi.fn();
  const usersService = { listTeamMembers: vi.fn() };
  const model = { findOne, findOneAndUpdate, deleteOne, find } as any;
  let service: GitHubSourcesService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GitHubSourcesService(model, usersService as any);
  });

  it('uses the authenticated user ID and public defaults when upserting a source', async () => {
    const source = {
      userId: 'user-1',
      repoUrl: 'https://github.com/example/daily-log',
      branch: 'main',
      indexPath: 'lecpunch/index.json',
      accessMode: 'public',
      enabled: true,
      siteUrl: null
    };
    findOneAndUpdate.mockReturnValue({ exec: vi.fn().mockResolvedValue(source) });

    await service.upsertForUser('user-1', { repoUrl: 'https://github.com/example/daily-log' });

    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { userId: 'user-1' },
      expect.objectContaining({
        $set: expect.objectContaining({
          repoUrl: 'https://github.com/example/daily-log',
          branch: 'main',
          indexPath: 'lecpunch/index.json',
          accessMode: 'public',
          enabled: true,
          siteUrl: null
        }),
        $setOnInsert: { userId: 'user-1', verifiedAt: null }
      }),
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  });

  it('only queries and deletes the current user source', async () => {
    findOne.mockReturnValue({ exec: vi.fn().mockResolvedValue(null) });
    deleteOne.mockReturnValue({ exec: vi.fn().mockResolvedValue({ deletedCount: 1 }) });

    await service.findForUser('user-1');
    await service.deleteForUser('user-1');

    expect(findOne).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(deleteOne).toHaveBeenCalledWith({ userId: 'user-1' });
  });

  it('lists only enabled sources for members in the requested team', async () => {
    usersService.listTeamMembers.mockResolvedValue([
      { id: 'member-1', displayName: '赵一' },
      { id: 'member-2', displayName: '钱二' }
    ]);
    find.mockReturnValue({
      exec: vi.fn().mockResolvedValue([
        {
          userId: 'member-2',
          repoUrl: 'https://github.com/example/two',
          siteUrl: 'https://two.example.com'
        },
        {
          userId: 'member-1',
          repoUrl: 'https://github.com/example/one',
          siteUrl: null
        },
        {
          userId: 'other-team-member',
          repoUrl: 'https://github.com/example/other',
          siteUrl: 'https://other.example.com'
        }
      ])
    });

    await expect(service.listEnabledForTeam('team-1')).resolves.toEqual({
      items: [
        { displayName: '钱二', repoUrl: 'https://github.com/example/two', siteUrl: 'https://two.example.com' },
        { displayName: '赵一', repoUrl: 'https://github.com/example/one', siteUrl: null }
      ]
    });

    expect(usersService.listTeamMembers).toHaveBeenCalledWith('team-1');
    expect(find).toHaveBeenCalledWith({ userId: { $in: ['member-1', 'member-2'] }, enabled: true });
  });
});
