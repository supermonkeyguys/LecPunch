import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { UpdateGitHubSourceDto } from './update-github-source.dto';

describe('UpdateGitHubSourceDto', () => {
  it('accepts a public GitHub repository with safe branch and index path', async () => {
    const dto = Object.assign(new UpdateGitHubSourceDto(), {
      repoUrl: 'https://github.com/example/daily-log',
      branch: 'feature/daily-log',
      indexPath: 'lecpunch/index.json',
      accessMode: 'public',
      enabled: true,
      siteUrl: 'https://blog.example.com'
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it.each([
    { repoUrl: 'https://github.com/example/daily-log/issues' },
    { repoUrl: 'https://github.com/alice/.' },
    { repoUrl: 'https://github.com/alice/..' },
    { repoUrl: 'http://github.com/example/daily-log' },
    { repoUrl: 'https://github.com/example/daily-log.git' },
    { repoUrl: 'https://github.com/example/daily-log', branch: '../main' },
    { repoUrl: 'https://github.com/example/daily-log', indexPath: '../index.json' }
  ])('rejects unsafe repository configuration %#', async (input) => {
    const dto = Object.assign(new UpdateGitHubSourceDto(), input);
    expect(await validate(dto)).not.toHaveLength(0);
  });

  it.each([
    { siteUrl: 'http://blog.example.com' },
    { siteUrl: 'https://user:pass@blog.example.com' },
    { siteUrl: `https://blog.example.com/${'a'.repeat(232)}` }
  ])('rejects an unsafe or oversized site URL %#', async (input) => {
    const dto = Object.assign(new UpdateGitHubSourceDto(), {
      repoUrl: 'https://github.com/example/daily-log',
      ...input
    });
    expect(await validate(dto)).not.toHaveLength(0);
  });

  it('accepts an omitted or null site URL', async () => {
    const omitted = Object.assign(new UpdateGitHubSourceDto(), {
      repoUrl: 'https://github.com/example/daily-log'
    });
    const nullable = Object.assign(new UpdateGitHubSourceDto(), {
      repoUrl: 'https://github.com/example/daily-log',
      siteUrl: null
    });

    expect(await validate(omitted)).toHaveLength(0);
    expect(await validate(nullable)).toHaveLength(0);
  });
});
